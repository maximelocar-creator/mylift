// Données RICHES des stickers Instagram — locales à l'appareil, jamais
// envoyées au serveur (elles ne transitent pas par lift_ref) : c'est ce qui
// permet d'y faire figurer le NOM DE MACHINE, qui reste interdit dans un post
// du feed (exercise_models strictement privé — décision verrouillée).
import { isValidSet, e1RM, type Any } from "../core/mylift";

export type BestSet = { weight: number; reps: number; rir: number | null };
export type StickerExo = { exName: string; machineName: string | null; sets: number; best: BestSet | null };
export type CurvePoint = { x: number; y: number };

export type SessionSticker = {
  kind: "session";
  sessionName: string;
  durationSec: number;
  tonnage: number;
  prCount: number;
  exoCount: number;
  setCount: number;
  prList: Any[];
  exos: StickerExo[];
  prevTonnage: number | null; // tonnage de la dernière fois (même séance)
  strengthPct: number | null; // % de FORCE vs la séance précédente (e1RM, exos communs)
  strengthBasis: number; // nb d'exos comparés (transparence)
  curve: CurvePoint[]; // tonnage des dernières fois que CETTE séance a été faite
  curveLabel: string;
};

export type LiftSticker = {
  kind: "lift";
  exName: string;
  machineName: string | null;
  isPR: boolean; // n'affiche « Nouveau record » que si c'en est un
  best: BestSet;
  curve: CurvePoint[]; // e1RM sur 30 jours
  curveLabel: string;
  progress30Pct: number | null; // % e1RM sur 30 jours
};

const num = (v: Any): number | null => (v === null || v === undefined || String(v) === "" ? null : Number(v));

/** Nom de la machine d'un exo loggué (résolu dans la lib courante). */
export function machineNameOf(ex: Any, exerciseLib: Any[]): string | null {
  if (!ex?.modelId) return null;
  const lib = ex.exId ? exerciseLib.find((l) => l.id === ex.exId) : null;
  const m = (lib?.models || []).find((x: Any) => x.id === ex.modelId);
  return m?.name ?? null;
}

/** Meilleure série d'un exo : poids max, puis reps max à ce poids. */
export function bestSetOf(ex: Any): BestSet | null {
  const sets = (ex.sets || []).filter(isValidSet);
  if (!sets.length) return null;
  const best = sets.reduce((a: Any, b: Any) => {
    const wa = parseFloat(a.weight) || 0;
    const wb = parseFloat(b.weight) || 0;
    if (wb > wa) return b;
    if (wb === wa && (parseInt(b.reps) || 0) > (parseInt(a.reps) || 0)) return b;
    return a;
  });
  return { weight: parseFloat(best.weight) || 0, reps: parseInt(best.reps) || 0, rir: num(best.rir) };
}

/** e1RM MOYEN sur TOUTES les séries valides d'un exo (pas seulement la
 *  meilleure) — base du % de force : une séance où toutes les séries montent
 *  compte davantage qu'une où seul le top set a progressé. */
export function meanE1RMOf(ex: Any): number | null {
  const sets = (ex.sets || []).filter(isValidSet);
  if (!sets.length) return null;
  const vals = sets
    .map((s: Any) => {
      const w = parseFloat(s.weight) || 0;
      const r = parseInt(s.reps) || 0;
      return w > 0 && r > 0 ? e1RM(w, r) : null;
    })
    .filter((v: number | null): v is number => v !== null);
  if (!vals.length) return null;
  return vals.reduce((a: number, v: number) => a + v, 0) / vals.length;
}

const tonnageOf = (log: Any) =>
  (log.exercises || []).reduce(
    (a: number, ex: Any) => a + (ex.sets || []).filter(isValidSet).reduce((b: number, s: Any) => b + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0),
    0
  );

/** Sticker SÉANCE : détail par exo + courbe de tonnage sur les dernières
 *  occurrences de CETTE séance (progression vs la dernière fois). */
export function buildSessionSticker(log: Any, journalLogs: Any[], exerciseLib: Any[]): SessionSticker {
  const exos: StickerExo[] = (log.exercises || [])
    .map((ex: Any) => ({
      exName: ex.exName || "?",
      machineName: machineNameOf(ex, exerciseLib),
      sets: (ex.sets || []).filter(isValidSet).length,
      best: bestSetOf(ex),
    }))
    .filter((e: StickerExo) => e.sets > 0);

  // Historique de la même séance (même sessionId), chronologique, la courante incluse
  const sameSession = (journalLogs || [])
    .filter((l: Any) => l.sessionId && log.sessionId && l.sessionId === log.sessionId)
    .sort((a: Any, b: Any) => (a.date || "").localeCompare(b.date || ""));
  const withCurrent = sameSession.some((l: Any) => l.id === log.id) ? sameSession : [...sameSession, log];
  const last = withCurrent.slice(-6);
  const curve: CurvePoint[] = last.map((l: Any, i: number) => ({ x: i, y: tonnageOf(l) }));

  // PROGRESSION = % de FORCE (décision Maxime), pas de volume : le volume
  // s'effondrait dès qu'une séance était écourtée (le fameux -68%).
  // Méthode : pour chaque exo PRÉSENT DANS LES DEUX séances, on compare
  // l'e1RM (Epley) MOYEN sur TOUTES ses séries valides, puis on moyenne ces
  // variations. Toutes les séries comptent (pas seulement le top set), et les
  // exos faits une seule fois sont exclus → une séance plus courte ne
  // pénalise plus le score.
  const prevLog = withCurrent.length >= 2 ? withCurrent[withCurrent.length - 2] : null;
  let strengthPct: number | null = null;
  let strengthBasis = 0;
  if (prevLog) {
    const prevMean: Record<string, number> = {};
    (prevLog.exercises || []).forEach((ex: Any) => {
      const m = meanE1RMOf(ex);
      if (m && m > 0) prevMean[ex.exId || ex.exName] = m;
    });
    const ratios: number[] = [];
    (log.exercises || []).forEach((ex: Any) => {
      const now = meanE1RMOf(ex);
      if (!now || now <= 0) return;
      const before = prevMean[ex.exId || ex.exName];
      if (!before || before <= 0) return;
      ratios.push(now / before - 1);
    });
    strengthBasis = ratios.length;
    if (ratios.length) strengthPct = Math.round((ratios.reduce((a, r) => a + r, 0) / ratios.length) * 100);
  }

  const prevTonnage: number | null = curve.length >= 2 ? curve[curve.length - 2].y : null;
  const curveLabel =
    strengthPct !== null ? `${strengthPct >= 0 ? "+" : ""}${strengthPct}% de force vs la dernière fois` : "";

  return {
    kind: "session",
    sessionName: log.sessionName || "Séance",
    durationSec: log.durationSec || 0,
    tonnage: tonnageOf(log),
    prCount: (log.prs || []).length,
    exoCount: exos.length,
    setCount: exos.reduce((a, e) => a + e.sets, 0),
    prList: log.prs || [],
    exos,
    prevTonnage,
    strengthPct,
    strengthBasis,
    curve,
    curveLabel,
  };
}

/** Sticker LIFT : meilleure série + courbe e1RM sur 30 jours pour cet exo. */
export function buildLiftSticker(opts: {
  exName: string;
  exId?: string | null;
  modelId?: string | null;
  best: BestSet;
  isPR?: boolean;
  journalLogs: Any[];
  exerciseLib: Any[];
}): LiftSticker {
  const { exName, exId, modelId, best, isPR, journalLogs, exerciseLib } = opts;
  const lib = exId ? exerciseLib.find((l) => l.id === exId) : null;
  const machineName = modelId ? ((lib?.models || []).find((m: Any) => m.id === modelId)?.name ?? null) : null;

  const since = Date.now() - 30 * 86400_000;
  const pts: CurvePoint[] = [];
  (journalLogs || [])
    .filter((l: Any) => new Date(l.date).getTime() >= since)
    .sort((a: Any, b: Any) => (a.date || "").localeCompare(b.date || ""))
    .forEach((l: Any, i: number) => {
      (l.exercises || []).forEach((ex: Any) => {
        const sameExo = exId ? ex.exId === exId : ex.exName === exName;
        if (!sameExo) return;
        const m = meanE1RMOf(ex); // moyenne sur toutes les séries de l'exo
        if (!m || m <= 0) return;
        pts.push({ x: pts.length, y: Math.round(m) });
      });
    });

  let curveLabel = "";
  let progress30Pct: number | null = null;
  if (pts.length >= 2) {
    const first = pts[0].y;
    const now = pts[pts.length - 1].y;
    if (first > 0) {
      progress30Pct = Math.round(((now - first) / first) * 100);
      curveLabel = `${progress30Pct >= 0 ? "+" : ""}${progress30Pct}% de force sur 30 jours`;
    }
  }

  return { kind: "lift", exName, machineName, isPR: !!isPR, best, curve: pts, curveLabel, progress30Pct };
}
