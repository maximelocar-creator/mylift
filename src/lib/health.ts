// Apple Santé (HealthKit) — sync bidirectionnelle du poids corporel.
// Build natif uniquement (entitlement com.apple.developer.healthkit +
// usage descriptions FR déclarés dans app.json). En Expo Go : totalement
// inerte. react-native-health est un module old-arch (interop Fabric) —
// chaque appel est gardé, aucun chemin ne peut crasher l'app.
//
// RÈGLES DE SYNC (décision simple et déterministe, l'écran Pesée reste la
// source UI — cf. feuille de route Phase 5) :
//   - IMPORT : chaque jour présent dans Santé mais absent de MyLift devient
//     une pesée locale (sans note — normal, vient d'ailleurs). Dernier
//     échantillon du jour s'il y en a plusieurs.
//   - EXPORT : chaque pesée MyLift dont le jour n'existe pas dans Santé y est
//     écrite (poids en grammes, converti).
//   - CONFLIT même jour : on ne touche à rien (MyLift fait foi à l'écran,
//     Santé garde son échantillon) — jamais d'écrasement silencieux.
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Any } from "../core/mylift";

// Préférence locale (par compte, jamais synchronisée — décision verrouillée
// sur les préférences UI) : la sync Santé ne tourne que si activée dans
// Réglages. Défaut : désactivée (opt-in explicite).
const enabledKey = (uid: string) => "mylift_health_enabled:" + uid;

export async function isHealthEnabled(uid: string): Promise<boolean> {
  return (await AsyncStorage.getItem(enabledKey(uid))) === "1";
}

export async function setHealthEnabled(uid: string, on: boolean): Promise<void> {
  if (on) await AsyncStorage.setItem(enabledKey(uid), "1");
  else await AsyncStorage.removeItem(enabledKey(uid));
}

const IN_EXPO_GO = Constants.appOwnership === "expo";
const BODY_MASS = "HKQuantityTypeIdentifierBodyMass" as const;

// Diagnostic : pourquoi Santé est indisponible/refusée — affiché dans le
// toggle de Réglages plutôt qu'un échec muet (debug sans Mac).
let lastHealthError: string | null = null;
export function healthDiagnostic(): string | null {
  return lastHealthError;
}

// Backend : @kingstinct/react-native-healthkit (Nitro modules, natif pour la
// nouvelle architecture RN). L'ancien react-native-health compilait mais ne
// se bridgait PAS sous bridgeless — « indisponible » constaté sur device.
function loadHealthKit(): Any | null {
  if (IN_EXPO_GO) {
    lastHealthError = "Expo Go (utiliser le build natif)";
    return null;
  }
  if (Platform.OS !== "ios") {
    lastHealthError = "iOS uniquement";
    return null;
  }
  try {
    const hk = require("@kingstinct/react-native-healthkit");
    if (typeof hk?.isHealthDataAvailable !== "function") {
      lastHealthError = "module Santé absent de ce build (installer le dernier build EAS)";
      return null;
    }
    if (!hk.isHealthDataAvailable()) {
      lastHealthError = "HealthKit indisponible sur cet appareil";
      return null;
    }
    lastHealthError = null;
    return hk;
  } catch (e: any) {
    lastHealthError = "chargement : " + (e?.message ?? String(e));
    return null;
  }
}

export function healthAvailable(): boolean {
  return !!loadHealthKit();
}

/** Demande la permission Santé (lecture + écriture du poids). true si ok. */
export async function initHealth(): Promise<boolean> {
  const hk = loadHealthKit();
  if (!hk) return false;
  try {
    const ok = await hk.requestAuthorization({ toShare: [BODY_MASS], toRead: [BODY_MASS] });
    if (!ok) lastHealthError = "autorisation refusée";
    return !!ok;
  } catch (e: any) {
    lastHealthError = "permission : " + (e?.message ?? String(e));
    return false;
  }
}

/** Poids Santé des `days` derniers jours — dernier échantillon par jour, kg. */
export async function readHealthWeights(days = 365): Promise<Array<{ date: string; weight: number }>> {
  const hk = loadHealthKit();
  if (!hk) return [];
  try {
    const samples: Any[] = await hk.queryQuantitySamples(BODY_MASS, {
      limit: 0, // tout
      ascending: true,
      unit: "kg",
      filter: { startDate: new Date(Date.now() - days * 86400_000) },
    });
    const byDay: Record<string, number> = {};
    for (const s of samples || []) {
      const day = new Date(s.startDate).toISOString().slice(0, 10);
      const kg = Math.round(Number(s.quantity) * 10) / 10;
      if (day && kg > 0) byDay[day] = kg; // ascending → le dernier du jour gagne
    }
    return Object.entries(byDay).map(([date, weight]) => ({ date, weight }));
  } catch {
    return [];
  }
}

/** Écrit une pesée MyLift dans Santé (kg, datée midi pour rester ce jour-là). */
export async function writeHealthWeight(weightKg: number, dateIso: string): Promise<boolean> {
  const hk = loadHealthKit();
  if (!hk) return false;
  try {
    const at = new Date(dateIso + "T12:00:00");
    const saved = await hk.saveQuantitySample(BODY_MASS, "kg", weightKg, at, at);
    return !!saved;
  } catch {
    return false;
  }
}

/** Sync complète (appelée à l'ouverture de l'écran Pesée sur build natif).
 *  Renvoie le nombre d'imports/exports effectués — 0/0 = déjà à jour. */
export async function syncHealthWeights(opts: {
  weights: Any[]; // pesées locales {date, weight, note}
  addWeight: (e: { date: string; weight: number; note?: string | null }) => Promise<void>;
}): Promise<{ imported: number; exported: number }> {
  if (!healthAvailable()) return { imported: 0, exported: 0 };
  const ok = await initHealth();
  if (!ok) return { imported: 0, exported: 0 };

  const hkDays = await readHealthWeights(365);
  const hkSet = new Set(hkDays.map((d) => d.date));
  const localByDay = new Set((opts.weights || []).map((w: Any) => String(w.date).slice(0, 10)));

  let imported = 0;
  for (const d of hkDays) {
    if (!localByDay.has(d.date)) {
      try {
        await opts.addWeight({ date: d.date, weight: d.weight, note: null });
        imported++;
      } catch {}
    }
  }

  let exported = 0;
  const yearAgo = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  for (const w of opts.weights || []) {
    const day = String(w.date).slice(0, 10);
    if (day >= yearAgo && !hkSet.has(day)) {
      if (await writeHealthWeight(parseFloat(w.weight), day)) exported++;
    }
  }
  return { imported, exported };
}
