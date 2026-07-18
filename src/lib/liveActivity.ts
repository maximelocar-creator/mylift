// Live Activity de séance — Dynamic Island + écran verrouillé (Phase 5).
// Bibliothèque : expo-live-activity (Software Mansion Labs) — le plugin génère
// l'extension WidgetKit au prebuild EAS ; requireOptionalNativeModule renvoie
// null si le natif est absent (Expo Go, build antérieur) → chaque appel est
// gardé, jamais de crash, dégradation silencieuse.
//
// CONTRAINTE (CLAUDE.md Phase 5) : le décompte du repos est rendu par le
// SYSTÈME (progressBar.date → ProgressView(timerInterval:) natif). On pousse
// UNE date de fin, iOS anime le compte à rebours tout seul — jamais de tick
// seconde par seconde depuis le JS (ne survivrait pas à l'arrière-plan).
//
// Tap sur l'île / la bannière verrouillée → deepLinkUrl "journal" →
// mylift://journal → l'écran de séance en cours (le Journal reprend la séance
// active automatiquement).
import { C } from "./theme";

type LAModule = typeof import("expo-live-activity");

let LA: LAModule | null = null;
try {
  // requireOptionalNativeModule interne : null si natif absent — pas de throw
  LA = require("expo-live-activity");
  // Certains chemins jettent seulement à l'appel : sonde startActivity
  if (typeof LA?.startActivity !== "function") LA = null;
} catch {
  LA = null;
}

const CONFIG = {
  backgroundColor: C.bg1,
  titleColor: C.ink0,
  subtitleColor: C.ink2,
  progressViewTint: C.accent,
  progressViewLabelColor: C.ink1,
  timerType: "digital" as const,
  deepLinkUrl: "journal", // widgetURL = <scheme>://journal
};

let activityId: string | null = null;
let baseTitle = "Séance en cours";

export function isLiveActivitySupported(): boolean {
  return !!LA;
}

/** Démarre la Live Activity au lancement de la séance. */
export function startSessionActivity(sessionName: string): void {
  if (!LA) return;
  try {
    baseTitle = sessionName || "Séance en cours";
    // Une seule activité à la fois : si une traîne (relance d'app), on repart
    if (activityId) {
      try {
        LA.stopActivity(activityId, { title: baseTitle });
      } catch {}
      activityId = null;
    }
    activityId = LA.startActivity({ title: baseTitle, subtitle: "Séance en cours" }, CONFIG) || null;
  } catch {
    activityId = null;
  }
}

/** Timer de repos démarré/ajusté : décompte système jusqu'à endMs.
 *  Écran verrouillé : nom de l'exo en cours + cible de la prochaine série. */
export function updateRestTimer(exName: string, targetWeight: number | string | null, endMs: number): void {
  if (!LA || !activityId) return;
  try {
    const w = targetWeight !== null && targetWeight !== undefined && targetWeight !== "" ? `${targetWeight} kg` : null;
    LA.updateActivity(activityId, {
      title: exName || baseTitle,
      subtitle: w ? `Repos · prochaine série ${w}` : "Repos",
      progressBar: { date: endMs },
    });
  } catch {}
}

/** Repos arrêté/terminé : retour à l'état séance (sans décompte). */
export function clearRestTimer(exName?: string | null): void {
  if (!LA || !activityId) return;
  try {
    LA.updateActivity(activityId, { title: exName || baseTitle, subtitle: "Séance en cours" });
  } catch {}
}

/** Fin (ou annulation) de séance : l'activité disparaît. */
export function endSessionActivity(): void {
  if (!LA || !activityId) return;
  try {
    LA.stopActivity(activityId, { title: baseTitle, subtitle: "Séance terminée" });
  } catch {}
  activityId = null;
}
