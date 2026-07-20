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
// Dernier état "hors repos" connu — on y revient quand le timer s'arrête,
// pour que l'île reste vivante (progression) au lieu d'un état générique.
let lastProgressState: { title: string; subtitle: string; progress: number } | null = null;

export function isLiveActivitySupported(): boolean {
  return !!LA;
}

/* Commandes timer venues de l'écran verrouillé / l'île (deep links
   mylift://timer/start|stop|reset, route app/timer/[action]). Bufferisées
   si l'écran de séance n'est pas encore monté au moment du tap. */
export type TimerCommand = "start" | "stop" | "reset";
let timerCmdHandler: ((c: TimerCommand) => void) | null = null;
let pendingTimerCmd: TimerCommand | null = null;

export function emitTimerCommand(c: TimerCommand): void {
  if (timerCmdHandler) timerCmdHandler(c);
  else pendingTimerCmd = c;
}

export function onTimerCommand(h: (c: TimerCommand) => void): () => void {
  timerCmdHandler = h;
  if (pendingTimerCmd) {
    const c = pendingTimerCmd;
    pendingTimerCmd = null;
    h(c);
  }
  return () => {
    if (timerCmdHandler === h) timerCmdHandler = null;
  };
}

const withMachine = (base: string, machine?: string | null) => (machine ? `${base} · ${machine}` : base);

/** Démarre la Live Activity au lancement de la séance. */
export function startSessionActivity(sessionName: string): void {
  if (!LA) return;
  try {
    baseTitle = sessionName || "Séance en cours";
    lastProgressState = null;
    // Une seule activité à la fois : si une traîne (relance d'app), on repart
    if (activityId) {
      try {
        LA.stopActivity(activityId, { title: baseTitle });
      } catch {}
      activityId = null;
    }
    activityId =
      LA.startActivity(
        { title: baseTitle, subtitle: "Séance en cours", progressBar: { progress: 0 } },
        CONFIG
      ) || null;
  } catch {
    activityId = null;
  }
}

/** Progression de séance (hors repos) : appelée à chaque série validée et à
 *  chaque changement d'exo — l'île vit au rythme de la séance.
 *  done/total = séries validées / total, la barre de l'île avance avec toi. */
export function updateSessionProgress(
  exName: string,
  doneSets: number,
  totalSets: number,
  nextWeight: number | string | null,
  machineName?: string | null
): void {
  if (!LA || !activityId) return;
  try {
    // Écran verrouillé (hors repos) : exo (titre) · Cible N kg · machine.
    // Jamais « Série X/Y » — Maxime préfère l'info actionnable. La barre
    // porte quand même la progression réelle (doneSets/totalSets).
    const w = nextWeight !== null && nextWeight !== undefined && nextWeight !== "" ? `Cible ${nextWeight} kg` : "En cours";
    const state = {
      title: exName || baseTitle,
      subtitle: withMachine(w, machineName),
      progress: totalSets > 0 ? Math.min(1, doneSets / totalSets) : 0,
    };
    lastProgressState = state;
    LA.updateActivity(activityId, { title: state.title, subtitle: state.subtitle, progressBar: { progress: state.progress } });
  } catch {}
}

/** Timer de repos démarré/ajusté : décompte système jusqu'à endMs.
 *  Écran verrouillé : nom de l'exo en cours + cible de la prochaine série. */
export function updateRestTimer(
  exName: string,
  targetWeight: number | string | null,
  endMs: number,
  startMs: number,
  machineName?: string | null
): void {
  if (!LA || !activityId) return;
  try {
    const w = targetWeight !== null && targetWeight !== undefined && targetWeight !== "" ? `Cible ${targetWeight} kg` : null;
    LA.updateActivity(activityId, {
      title: exName || baseTitle,
      subtitle: withMachine(w ?? "Repos", machineName),
      // date = fin (barre/anneau vers la cible) · startDate = début du repos
      // (timer qui compte VERS LE HAUT = temps de repos pris)
      progressBar: { date: endMs, startDate: startMs } as any,
    });
  } catch {}
}

/** Repos arrêté/terminé : retour à l'état de progression (l'île reste vivante). */
export function clearRestTimer(exName?: string | null): void {
  if (!LA || !activityId) return;
  try {
    if (lastProgressState) {
      LA.updateActivity(activityId, {
        title: lastProgressState.title,
        subtitle: lastProgressState.subtitle,
        progressBar: { progress: lastProgressState.progress },
      });
    } else {
      LA.updateActivity(activityId, { title: exName || baseTitle, subtitle: "Séance en cours" });
    }
  } catch {}
}

/** Fin (ou annulation) de séance : l'activité disparaît. */
export function endSessionActivity(): void {
  if (!LA || !activityId) return;
  try {
    LA.stopActivity(activityId, { title: baseTitle, subtitle: "Séance terminée", progressBar: { progress: 1 } });
  } catch {}
  activityId = null;
}
