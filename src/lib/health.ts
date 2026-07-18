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
import type { Any } from "../core/mylift";

const IN_EXPO_GO = Constants.appOwnership === "expo";

function loadHealthKit(): Any | null {
  if (IN_EXPO_GO || Platform.OS !== "ios") return null;
  try {
    const mod = require("react-native-health");
    const hk = mod?.default ?? mod;
    return hk && typeof hk.initHealthKit === "function" ? hk : null;
  } catch {
    return null;
  }
}

export function healthAvailable(): boolean {
  return !!loadHealthKit();
}

/** Demande la permission Santé (lecture + écriture du poids). true si ok. */
export function initHealth(): Promise<boolean> {
  const hk = loadHealthKit();
  if (!hk) return Promise.resolve(false);
  const perms = {
    permissions: {
      read: [hk.Constants.Permissions.Weight],
      write: [hk.Constants.Permissions.Weight],
    },
  };
  return new Promise((resolve) => {
    try {
      hk.initHealthKit(perms, (err: Any) => resolve(!err));
    } catch {
      resolve(false);
    }
  });
}

/** Poids Santé des `days` derniers jours — dernier échantillon par jour, kg. */
export function readHealthWeights(days = 365): Promise<Array<{ date: string; weight: number }>> {
  const hk = loadHealthKit();
  if (!hk) return Promise.resolve([]);
  const start = new Date(Date.now() - days * 86400_000).toISOString();
  return new Promise((resolve) => {
    try {
      hk.getWeightSamples({ unit: "gram", startDate: start, ascending: true }, (err: Any, results: Any[]) => {
        if (err || !Array.isArray(results)) return resolve([]);
        const byDay: Record<string, number> = {};
        for (const s of results) {
          const day = String(s.startDate ?? "").slice(0, 10);
          const kg = Math.round((Number(s.value) / 1000) * 10) / 10;
          if (day && kg > 0) byDay[day] = kg; // ascending → le dernier du jour gagne
        }
        resolve(Object.entries(byDay).map(([date, weight]) => ({ date, weight })));
      });
    } catch {
      resolve([]);
    }
  });
}

/** Écrit une pesée MyLift dans Santé (grammes, datée midi pour rester ce jour-là). */
export function writeHealthWeight(weightKg: number, dateIso: string): Promise<boolean> {
  const hk = loadHealthKit();
  if (!hk) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      hk.saveWeight(
        { value: Math.round(weightKg * 1000), unit: "gram", startDate: new Date(dateIso + "T12:00:00").toISOString() },
        (err: Any) => resolve(!err)
      );
    } catch {
      resolve(false);
    }
  });
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
