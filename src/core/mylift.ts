// Port fidèle des fonctions pures de v40-reference/app.jsx (MyLift v40).
// RÈGLE ABSOLUE (CLAUDE.md) : logique identique à app.jsx, ne rien "améliorer".
// Chaque fonction est vérifiée par un test différentiel qui exécute le vrai
// app.jsx et compare les sorties (src/core/__tests__/mylift.parity.test.ts).

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Any = Record<string, any>;

/* --- utilities --------------------------------------------------- */
export const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n);
export const iso = (d: Date) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
export const todayIso = () => iso(new Date());
export function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
export function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

/* --- muscle groups & sous-groupes --------------------------------- */
export const MUSCLE_GROUPS_DEFAULT = ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Quadriceps', 'Ischios', 'Fessiers', 'Mollets', 'Adducteurs', 'Abdos'];

export const SUB_GROUPS_DEFAULT: Record<string, string[]> = {
  Pectoraux: ['Haut', 'Milieu', 'Bas'],
  Dos: ['Trapèze', 'Grand dorsal', 'Lombaires'],
  Épaules: ['Antérieur', 'Latéral', 'Arrière'],
};

export const SUB_GROUP_DEFAULT_SPLIT: Record<string, Record<string, number>> = {
  Pectoraux: { Haut: 40, Milieu: 40, Bas: 20 },
  Dos: { Trapèze: 25, 'Grand dorsal': 60, Lombaires: 15 },
  Épaules: { Antérieur: 25, Latéral: 50, Arrière: 25 },
};

// Répartition du volume d'un muscle parent sur ses sous-groupes
// Retourne { subGroup: sériesArrondies } respectant totalSets
export function splitVolumeBySubGroups(
  muscleGroup: string,
  totalSets: number,
  customPct?: Record<string, number> | null,
  customSubGroupsDict?: Record<string, string[]> | null
): Record<string, number> | null {
  const dict = customSubGroupsDict || SUB_GROUPS_DEFAULT;
  const subs = dict[muscleGroup];
  if (!subs || !subs.length || totalSets <= 0) return null;
  const pct = customPct || SUB_GROUP_DEFAULT_SPLIT[muscleGroup] || {};
  // Complète les sous-groupes manquants avec part équitable du reste
  const defined = subs.filter((s) => pct[s] !== undefined);
  const undefinedSubs = subs.filter((s) => pct[s] === undefined);
  const definedTotal = defined.reduce((a, s) => a + (pct[s] || 0), 0);
  const remain = Math.max(0, 100 - definedTotal);
  const pctFull: Record<string, number> = { ...pct };
  undefinedSubs.forEach((s) => {
    pctFull[s] = undefinedSubs.length ? remain / undefinedSubs.length : 0;
  });

  // Calcul float puis arrondi avec conservation du total (largest remainder)
  const raw = subs.map((s) => ({ sub: s, val: (totalSets * (pctFull[s] || 0)) / 100 }));
  const floored = raw.map((r) => ({ ...r, floor: Math.floor(r.val), frac: r.val - Math.floor(r.val) }));
  const used = floored.reduce((a, r) => a + r.floor, 0);
  const deficit = totalSets - used;
  floored.sort((a, b) => b.frac - a.frac);
  const out: Record<string, number> = {};
  floored.forEach((r, i) => {
    out[r.sub] = r.floor + (i < deficit ? 1 : 0);
  });
  return out;
}

/* --- core formulas ----------------------------------------------- */
export const parseSetVals = (s: Any) => ({ w: parseFloat(s.weight) || 0, r: parseInt(s.reps) || 0 });
// w>=0 (poids 0 OK pour exos poids du corps), mais on exige que weight ait été explicitement saisi
// (chaîne non vide), pour ne pas confondre "0 saisi" avec "pas encore rempli".
export const isValidSet = (s: Any) => {
  const { w, r } = parseSetVals(s);
  const weightSet = s && s.weight !== '' && s.weight !== null && s.weight !== undefined;
  return weightSet && w >= 0 && r > 0 && r <= 50 && w <= 1000;
};
export const e1RM = (w: any, r: any) => {
  const W = parseFloat(w) || 0,
    R = parseInt(r) || 0;
  return W <= 0 || R <= 0 ? 0 : W * (1 + R / 30);
};
export const topSetOf = (ex: Any): Any | null => {
  const sets = (ex.sets || []).filter(isValidSet);
  if (!sets.length) return null;
  return sets.reduce((a: Any, b: Any) => (e1RM(b.weight, b.reps) > e1RM(a.weight, a.reps) ? b : a));
};
export const exoScore = (ex: Any) => {
  const t = topSetOf(ex);
  if (!t) return 0;
  const top = e1RM(t.weight, t.reps);
  const thr = top * 0.93;
  const n = (ex.sets || []).filter((s: Any) => e1RM(s.weight, s.reps) >= thr).length;
  return top * (1 + 0.02 * Math.max(0, n - 1));
};
export const tonnageExo = (ex: Any) => (ex.sets || []).reduce((a: number, s: Any) => a + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
export const tonnageSession = (s: Any) => (s.exercises || []).reduce((a: number, ex: Any) => a + tonnageExo(ex), 0);
export const setsCountSession = (s: Any) => (s.exercises || []).reduce((a: number, ex: Any) => a + (ex.sets || []).filter(isValidSet).length, 0);
export const scoreSession = (s: Any) => (s.exercises || []).reduce((a: number, ex: Any) => a + exoScore(ex), 0);

/* --- exo matching key (across sessions) -------------------------- */
export const norm = (t: any) =>
  (t || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
// Inclut le modelId si présent : un PR sur "Leg ext / Hammer" est différent d'un PR sur "Leg ext / Technogym".
// Accepte 'modelId' (logs persistés) OU 'activeModelId' (séance en cours) — c'est le même concept,
// juste le nom du champ qui diffère selon le contexte.
export const exoKey = (ex: Any) => {
  const base = ex.exId ? 'lib:' + ex.exId : 'name:' + norm(ex.exName || ex.name || '');
  const mid = ex.modelId || ex.activeModelId;
  return mid ? base + '/m:' + mid : base;
};
// Variante "tous modèles confondus" — utilisée pour la vue agrégée optionnelle
export const exoKeyNoModel = (ex: Any) => (ex.exId ? 'lib:' + ex.exId : 'name:' + norm(ex.exName || ex.name || ''));

/* --- muscle group of an exercise --------------------------------- */
export function exoMuscleGroup(ex: Any, lib: Any[]): string {
  if (ex.exId) {
    const L = lib.find((l) => l.id === ex.exId);
    if (L?.muscleGroup) return L.muscleGroup;
  }
  if (ex.muscleGroup) return ex.muscleGroup;
  // try matching by name
  const nm = norm(ex.exName || ex.name || '');
  const L = lib.find((l) => norm(l.name) === nm);
  return L?.muscleGroup || 'Autre';
}

/* ====================================================================
   PROGRESSION INTELLIGENTE
   ==================================================================== */

/**
 * Scanne l'historique d'un exo dans l'ordre chronologique et flag chaque set
 * comme all-time PR et/ou rep PR selon les définitions :
 *   - All-Time PR : nouveau poids max (jamais touché auparavant)
 *   - Rep PR : à un poids déjà touché, plus de reps que jamais à ce poids exact
 * La toute première série ever sur cet exo n'est jamais un PR (pas de baseline).
 */
export function scanExoPRs(journalLogs: Any[], keyResolver: (ex: Any) => string, targetKey: string): Any[] {
  // Aplatit toutes les séries de cet exo en respectant l'ordre temporel
  const flatSets: Any[] = [];
  const sessions = [...journalLogs].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  sessions.forEach((session) => {
    (session.exercises || []).forEach((ex: Any) => {
      if (keyResolver(ex) !== targetKey) return;
      (ex.sets || []).forEach((s: Any, setIdx: number) => {
        if (!isValidSet(s)) return;
        flatSets.push({
          date: session.date,
          sessionId: session.id,
          exId: ex.exId,
          exName: ex.exName,
          modelId: ex.modelId || null,
          setIdx,
          weight: parseFloat(s.weight),
          reps: parseInt(s.reps),
        });
      });
    });
  });

  // Scan chronologique en maintenant l'état "déjà vu"
  const EPS = 0.05;
  let maxWeightEver = 0;
  let everSeenAny = false; // false tant qu'aucun set n'a encore été observé pour cet exo
  const maxRepsAtWeight: Record<string, number> = {}; // weight (string) → max reps observé à ce poids
  return flatSets.map((set) => {
    const wKey = set.weight.toFixed(2);
    const sameWBefore = maxRepsAtWeight[wKey];

    // All-Time : nouveau poids max strict. La toute première série ever sur cet exo
    // n'est jamais un PR (pas de baseline).
    const isAllTime = everSeenAny && set.weight > maxWeightEver + EPS;
    // Rep PR : poids déjà touché ET plus de reps qu'avant
    const isRep = sameWBefore !== undefined && set.reps > sameWBefore;

    // Mise à jour de l'état après évaluation
    if (set.weight > maxWeightEver) maxWeightEver = set.weight;
    if (sameWBefore === undefined || set.reps > sameWBefore) {
      maxRepsAtWeight[wKey] = set.reps;
    }
    everSeenAny = true;

    return { ...set, isAllTimePR: isAllTime, isRepPR: isRep };
  });
}

/* Timeline e1RM par séance pour un exo donné */
// Si modelFilter est fourni : 'all' → pas de filtre, 'none' → seulement les séries sans modelId,
// '<id>' → seulement les séries de ce modèle. Sinon (undefined), on prend tout (back-compat).
export function exoTimeline(journalLogs: Any[], key: string, modelFilter?: string): Any[] {
  // key peut contenir /m:<modelId> (clé spécifique) ou pas (clé générique exo).
  // Si modelFilter est fourni, on ignore la part modèle de la clé et on filtre via modelFilter.
  const baseKey = key.split('/m:')[0];

  // Pour matcher les séries d'un log dans la bonne portée (avec/sans modèle)
  const matchesScope = (ex: Any) => {
    if (exoKeyNoModel(ex) !== baseKey) return false;
    if (modelFilter !== undefined && modelFilter !== 'all') {
      const exModel = ex.modelId || 'none';
      return exModel === modelFilter;
    } else if (modelFilter === undefined) {
      return exoKey(ex) === key;
    }
    return true; // 'all'
  };

  // Scan complet de l'historique pour calculer les vrais PRs (all-time + rep PR)
  // sur les séries qui matchent le scope (modèle filtré ou pas).
  const SCOPE_KEY = '__scope__';
  const allPRFlags = scanExoPRs(journalLogs, (ex) => (matchesScope(ex) ? SCOPE_KEY : 'nope'), SCOPE_KEY);
  // Construit un index par (sessionId, setIdx) → flags PR pour lookup rapide
  const prFlagsBySetKey: Record<string, Any> = {};
  allPRFlags.forEach((p) => {
    const k = p.sessionId + '|' + p.setIdx + '|' + (p.modelId || '') + '|' + p.weight.toFixed(2) + '|' + p.reps;
    prFlagsBySetKey[k] = { isAllTimePR: p.isAllTimePR, isRepPR: p.isRepPR };
  });

  const points: Any[] = [];
  journalLogs.forEach((session) => {
    (session.exercises || []).forEach((ex: Any) => {
      if (!matchesScope(ex)) return;
      const t = topSetOf(ex);
      if (!t) return;
      // Enrichit chaque set avec ses flags PR
      const enrichedSets = (ex.sets || []).filter(isValidSet).map((s: Any, idx: number) => {
        const w = parseFloat(s.weight);
        const r = parseInt(s.reps);
        const k = session.id + '|' + idx + '|' + (ex.modelId || '') + '|' + w.toFixed(2) + '|' + r;
        const flags = prFlagsBySetKey[k] || { isAllTimePR: false, isRepPR: false };
        return { w, r, rir: s.rir, isAllTimePR: flags.isAllTimePR, isRepPR: flags.isRepPR };
      });
      // Une séance est marquée PR si au moins une de ses séries est un PR (all-time ou rep)
      const sessionHasAnyPR = enrichedSets.some((s: Any) => s.isAllTimePR || s.isRepPR);
      const sessionHasAllTime = enrichedSets.some((s: Any) => s.isAllTimePR);
      const sessionHasRep = enrichedSets.some((s: Any) => s.isRepPR);

      points.push({
        date: session.date,
        sessionId: session.id,
        exName: ex.exName || ex.name,
        modelId: ex.modelId || null,
        weight: parseFloat(t.weight),
        reps: parseInt(t.reps),
        e1rm: e1RM(t.weight, t.reps),
        allSets: enrichedSets,
        hasAllTimePR: sessionHasAllTime,
        hasRepPR: sessionHasRep,
        hasAnyPR: sessionHasAnyPR,
      });
    });
  });
  points.sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));
  let maxE1RM = 0;
  return points.map((p, i) => {
    const prev = points[i - 1];
    const delta = prev ? p.e1rm - prev.e1rm : 0;
    let kind = 'first';
    if (prev) {
      if (delta >= 0.3) kind = 'up';
      else if (delta <= -0.3) kind = 'down';
      else kind = 'flat';
    }
    // isPR reflète un VRAI PR utilisateur (all-time ou rep), pas une projection e1RM
    const isPR = p.hasAnyPR;
    if (p.e1rm > maxE1RM) maxE1RM = p.e1rm;
    return { ...p, delta, kind, isPR };
  });
}

/* Surcharge progressive résumée sur période (défaut 28j) */
export function progressionSummary(journalLogs: Any[], lib: Any[], periodDays = 28) {
  const cutIso = iso(daysAgo(periodDays));
  // Tous les exos travaillés dans la période — clé sans modèle pour ne pas dupliquer
  const keysSeen = new Set<string>();
  journalLogs.forEach((s) => {
    if (s.date < cutIso) return;
    (s.exercises || []).forEach((ex: Any) => keysSeen.add(exoKeyNoModel(ex)));
  });
  const items: Any[] = [];
  keysSeen.forEach((baseKey) => {
    // Timeline complète (avec flags PR enrichis) pour cet exo, tous modèles
    const tl = exoTimeline(journalLogs, baseKey, 'all');
    if (tl.length < 1) return;
    const inPeriod = tl.filter((t) => t.date >= cutIso);
    if (inPeriod.length === 0) return;

    // === Calcul indice % d'amélioration (même logique que muscles) ===
    // Groupé par modèle : baseline = 1ère séance dans la période = 100, indices ensuite.
    // Par date : moyenne des indices observés ce jour-là (cross-modèles).
    const byModel: Record<string, Any[]> = {};
    inPeriod.forEach((p) => {
      const mid = p.modelId || 'none';
      if (!byModel[mid]) byModel[mid] = [];
      byModel[mid].push(p);
    });
    const indexPointsByDate: Record<string, number[]> = {};
    Object.values(byModel).forEach((pts) => {
      pts.sort((a, b) => a.date.localeCompare(b.date));
      const base = pts[0].e1rm;
      if (base <= 0) return;
      pts.forEach((p) => {
        const idx = (p.e1rm / base) * 100;
        if (!indexPointsByDate[p.date]) indexPointsByDate[p.date] = [];
        indexPointsByDate[p.date].push(idx);
      });
    });
    const dates = Object.keys(indexPointsByDate).sort();
    if (dates.length === 0) return;
    const rawIndex = dates.map((d) => indexPointsByDate[d].reduce((a, x) => a + x, 0) / indexPointsByDate[d].length);
    // Lissage moyenne mobile 7 points (séances)
    const smoothIndex = rawIndex.map((v, i) => {
      const start = Math.max(0, i - 6);
      const sl = rawIndex.slice(start, i + 1);
      return sl.reduce((a, x) => a + x, 0) / sl.length;
    });
    const finalIndex = smoothIndex[smoothIndex.length - 1];
    const deltaPct = finalIndex - 100;

    // === Flags PR ===
    const hasAllTimePR = inPeriod.some((p) => p.hasAllTimePR);
    // Rep PR significatif = un PR de rep range qui n'est PAS aussi un all-time
    const hasRepPRonly = !hasAllTimePR && inPeriod.some((p) => p.hasRepPR);

    // === Last performance (top set de la dernière séance dans la période) ===
    const last = inPeriod[inPeriod.length - 1];
    const first = inPeriod[0];

    // === Muscle group ===
    const muscleGroup = (function () {
      for (const s of journalLogs) {
        const ex = (s.exercises || []).find((e: Any) => exoKeyNoModel(e) === baseKey);
        if (ex) return exoMuscleGroup(ex, lib);
      }
      return 'Autre';
    })();

    items.push({
      key: baseKey,
      name: last.exName,
      muscleGroup,
      deltaPct,
      finalIndex,
      // Flags PR explicites pour l'UI
      hasAllTimePR,
      hasRepPRonly,
      isPR: hasAllTimePR || hasRepPRonly, // retro-compat
      // Classification : up/down/flat sur la base de deltaPct (seuil 0.5% pour éviter le bruit)
      kind: deltaPct > 0.5 ? 'up' : deltaPct < -0.5 ? 'down' : 'flat',
      // Top set de la dernière séance (utilisé dans la sub-meta)
      lastWeight: last.weight,
      lastReps: last.reps,
      // Conserve l'ancien deltaE1RM pour rétro-compat éventuelle (kg brut, peut être trompeur cross-modèles)
      deltaE1RM: last.e1rm - first.e1rm,
      lastE1RM: last.e1rm,
      baselineE1RM: first.e1rm,
      prevWeight: first.weight,
      prevReps: first.reps,
      count: inPeriod.length,
    });
  });
  // Tri par deltaPct desc (progression réelle), plus de bias PR-first
  items.sort((a, b) => b.deltaPct - a.deltaPct);
  const up = items.filter((i) => i.deltaPct > 0).length;
  const prs = items.filter((i) => i.hasAllTimePR).length;
  return { items, total: items.length, up, prs, pct: items.length ? Math.round((100 * up) / items.length) : 0 };
}

/* ==========================================================================
   INDICE DE PROGRESSION PAR MUSCLE
   Pour chaque exo×modèle dans la période : sa 1ère séance = base 100,
   chaque séance suivante : indice = e1RM / e1RM_base × 100.
   Par date : moyenne des indices observés ce jour-là.
   ========================================================================== */

/**
 * Construit la timeline d'indice pour un muscle (filtré optionnellement par sous-muscle).
 * @returns {raw, smooth, exoCount, exoWithDelta, positives, finalIndex, deltaPct}
 */
export function muscleIndexTimeline(journalLogs: Any[], lib: Any[], muscleGroup: string, cutIso: string, subGroupFilter?: string) {
  // 1) Récupère tous les exos×modèles du muscle dans la période, avec leurs séances
  // emKey = exoKey complet (avec modelId). Sépare Hammer/Technogym.
  const byEmKey = new Map<string, Any>(); // emKey -> {subGroup, points: [{date, e1rm}, ...]}
  journalLogs.forEach((session) => {
    if (session.date < cutIso) return;
    (session.exercises || []).forEach((ex: Any) => {
      if (exoMuscleGroup(ex, lib) !== muscleGroup) return;
      // SubGroup filter
      let sg: string | null = null;
      if (ex.exId) {
        const L = lib.find((l) => l.id === ex.exId);
        if (L?.subGroup) sg = L.subGroup;
      }
      if (!sg) {
        const nm = norm(ex.exName || ex.name || '');
        const L = lib.find((l) => norm(l.name) === nm);
        if (L?.subGroup) sg = L.subGroup;
      }
      if (subGroupFilter && subGroupFilter !== 'all' && sg !== subGroupFilter) return;
      const t = topSetOf(ex);
      if (!t) return;
      const w = parseFloat(t.weight),
        r = parseInt(t.reps);
      const e = e1RM(w, r);
      if (e <= 0) return;
      const emk = exoKey(ex);
      if (!byEmKey.has(emk)) byEmKey.set(emk, { subGroup: sg, points: [] });
      byEmKey.get(emk)!.points.push({ date: session.date, e1rm: e });
    });
  });

  // 2) Pour chaque exo×modèle : trier par date, baseline = premier point, indices ensuite
  // Les exos×modèles avec 1 seul point ont indice=100 sur leur date.
  // Pour le calcul du delta global, on n'inclut que ceux avec ≥2 points.
  const indexPointsByDate: Record<string, number[]> = {}; // date -> [indices ce jour]
  let nExoModelWithDelta = 0;
  let nPositives = 0;
  byEmKey.forEach(({ points }) => {
    points.sort((a: Any, b: Any) => a.date.localeCompare(b.date));
    const base = points[0].e1rm;
    if (base <= 0) return;
    points.forEach((p: Any) => {
      const idx = (p.e1rm / base) * 100;
      if (!indexPointsByDate[p.date]) indexPointsByDate[p.date] = [];
      indexPointsByDate[p.date].push(idx);
    });
    if (points.length >= 2) {
      nExoModelWithDelta += 1;
      if (points[points.length - 1].e1rm > base) nPositives += 1;
    }
  });

  // 3) Construire la timeline : moyenne des indices par date
  const dates = Object.keys(indexPointsByDate).sort();
  const raw = dates.map((d) => ({
    date: d,
    value: indexPointsByDate[d].reduce((a, x) => a + x, 0) / indexPointsByDate[d].length,
  }));

  // 4) Lissage moyenne mobile sur 7 points (séances). Pour les premiers points,
  // fenêtre rétrécie.
  const SMOOTH_WIN = 7;
  const smooth = raw.map((p, i) => {
    const start = Math.max(0, i - SMOOTH_WIN + 1);
    const slice = raw.slice(start, i + 1);
    return { date: p.date, value: slice.reduce((a, x) => a + x.value, 0) / slice.length };
  });

  // 5) Delta global = indice lissé final - 100. Lissé pour cohérence visuelle avec la courbe.
  const finalIndex = smooth.length ? smooth[smooth.length - 1].value : 100;
  const deltaPct = finalIndex - 100;

  return {
    raw,
    smooth,
    finalIndex,
    deltaPct,
    exoCount: byEmKey.size,
    exoWithDelta: nExoModelWithDelta,
    positives: nPositives,
  };
}

/**
 * Sommaire indice par muscle pour la vue liste Progrès.
 * Renvoie un tableau trié par deltaPct desc.
 */
export function muscleIndexSummary(journalLogs: Any[], lib: Any[], periodDays = 28) {
  const cutIso = iso(daysAgo(periodDays));
  // Tous les muscles ayant ≥1 séance dans la période
  const muscles = new Set<string>();
  journalLogs.forEach((s) => {
    if (s.date < cutIso) return;
    (s.exercises || []).forEach((ex: Any) => {
      const mg = exoMuscleGroup(ex, lib);
      if (mg) muscles.add(mg);
    });
  });
  // Compte des PRs par muscle (via progressionSummary — déjà solide via scanExoPRs)
  const { items } = progressionSummary(journalLogs, lib, periodDays);
  const prsByMuscle: Record<string, number> = {};
  items.forEach((it: Any) => {
    const g = it.muscleGroup || 'Autre';
    if (it.isPR) prsByMuscle[g] = (prsByMuscle[g] || 0) + 1;
  });
  const rows: Any[] = [];
  muscles.forEach((mg) => {
    const tl = muscleIndexTimeline(journalLogs, lib, mg, cutIso);
    rows.push({
      muscleGroup: mg,
      deltaPct: tl.deltaPct,
      exoCount: tl.exoCount,
      exoWithDelta: tl.exoWithDelta,
      positives: tl.positives,
      prs: prsByMuscle[mg] || 0,
    });
  });
  return rows.sort((a, b) => b.deltaPct - a.deltaPct);
}

/* Volume programme (static) — incluant sous-groupes */
export function programVolume(program: Any | null | undefined, lib: Any[]) {
  const total: Record<string, number> = {},
    perSession: Record<string, Any> = {},
    totalSub: Record<string, Record<string, number>> = {};
  (program?.sessions || []).forEach((s: Any) => {
    const ps: Record<string, number> = {};
    (s.exercises || []).forEach((ex: Any) => {
      const sets = parseInt(ex.sets) || 0;
      let g = ex.muscleGroup || 'Autre';
      let sg = ex.subGroup || null;
      const c = ex.choices?.[0];
      if (c?.exId) {
        const L = lib.find((l) => l.id === c.exId);
        if (L?.muscleGroup) g = L.muscleGroup;
        if (L?.subGroup) sg = L.subGroup;
      }
      ps[g] = (ps[g] || 0) + sets;
      total[g] = (total[g] || 0) + sets;
      if (sg) {
        if (!totalSub[g]) totalSub[g] = {};
        totalSub[g][sg] = (totalSub[g][sg] || 0) + sets;
      }
    });
    perSession[s.id] = ps;
  });
  return { total, perSession, totalSub };
}

/* Volume actuel cette semaine */
export function weekActualVolume(journalLogs: Any[], lib: Any[], weekStart: Date): Record<string, number> {
  const s0 = iso(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const e0 = iso(end);
  const vol: Record<string, number> = {};
  journalLogs.forEach((ses) => {
    if (ses.date < s0 || ses.date > e0) return;
    (ses.exercises || []).forEach((ex: Any) => {
      const sets = (ex.sets || []).filter(isValidSet).length;
      if (!sets) return;
      const g = exoMuscleGroup(ex, lib);
      vol[g] = (vol[g] || 0) + sets;
    });
  });
  return vol;
}

/* KPI agrégés (7j ou période) */
export function periodKPI(journalLogs: Any[], days = 7) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = daysAgo(days - 1);
  const s0 = iso(start),
    e0 = iso(end);
  const sessions = journalLogs.filter((l) => l.date >= s0 && l.date <= e0);
  const prevStart = daysAgo(days * 2 - 1);
  const prevEnd = daysAgo(days);
  const prevSessions = journalLogs.filter((l) => l.date >= iso(prevStart) && l.date <= iso(prevEnd));
  const agg = (arr: Any[]) => ({
    sessions: arr.length,
    tonnage: arr.reduce((a, s) => a + tonnageSession(s), 0),
    duration: arr.reduce((a, s) => a + (s.durationSec || 0), 0),
    prs: arr.reduce((a, s) => a + (s.prs?.length || 0), 0),
    sets: arr.reduce((a, s) => a + setsCountSession(s), 0),
    score: arr.reduce((a, s) => a + scoreSession(s), 0),
  });
  return { curr: agg(sessions), prev: agg(prevSessions), rawSessions: sessions };
}

export function deltaPct(curr: number, prev: number): number | null {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

/* Next session recommendation (oldest-last logic) */
export function recommendedSession(program: Any | null | undefined, journalLogs: Any[]): Any | null {
  if (!program?.sessions?.length) return null;
  const lastBySession: Record<string, string> = {};
  journalLogs.forEach((l) => {
    if (l.programId === program.id && l.sessionId) {
      if (!lastBySession[l.sessionId] || l.date > lastBySession[l.sessionId]) {
        lastBySession[l.sessionId] = l.date;
      }
    }
  });
  // pick session with oldest date (or never done)
  let best = program.sessions[0],
    bestDate = lastBySession[best.id] || '0000';
  for (const s of program.sessions) {
    const d = lastBySession[s.id] || '0000';
    if (d < bestDate) {
      best = s;
      bestDate = d;
    }
  }
  return best;
}

/* Exo from program session, with last performance for the same exo */
export function hydrateSessionExos(session: Any, lib: Any[], journalLogs: Any[]): Any[] {
  return (session.exercises || []).map((progEx: Any) => {
    const c = progEx.choices?.[0];
    const libEx = c?.exId ? lib.find((l) => l.id === c.exId) : null;
    const name = libEx?.name || progEx.exName || '?';
    const muscleGroup = libEx?.muscleGroup || progEx.muscleGroup || 'Autre';
    const k = c?.exId ? 'lib:' + c.exId : 'name:' + norm(name);
    // find last performance
    let last: Any | null = null;
    for (let i = journalLogs.length - 1; i >= 0; i--) {
      const log = journalLogs[i];
      const found = (log.exercises || []).find((ex: Any) => exoKey(ex) === k && (ex.sets || []).some(isValidSet));
      if (found) {
        last = { date: log.date, sets: (found.sets || []).filter(isValidSet) };
        break;
      }
    }
    // Modèles de la lib + cibles programmées (filter sur les modèles encore existants)
    const libModels = libEx?.models || [];
    const programmedTargets = (progEx.modelTargets || []).filter((t: Any) => libModels.find((m: Any) => m.id === t.modelId));
    return {
      progId: progEx.id,
      exId: c?.exId || null,
      exName: name,
      muscleGroup,
      targetSets: parseInt(progEx.sets) || 0,
      targetWeight: c?.weight || '',
      machine: c?.machine || '',
      setting: libEx?.setting || '', // réglage global (utilisé si pas de modèle actif)
      variants: progEx.choices || [],
      libModels, // tous les modèles dispo dans la lib pour cet exo
      modelTargets: programmedTargets, // cibles spécifiques par modèle programmées dans le programme
      activeModelId: null, // modèle choisi pour cette séance (null tant que pas choisi)
      lastPerformance: last,
    };
  });
}

/* ====================================================================
   PROGRAM GENERATOR — volume targets
   ==================================================================== */

export const LEVEL_MULT: Record<string, number> = { debutant: 0.75, intermediaire: 1.0, confirme: 1.15 };
export const STATUS_MULT: Record<string, number> = { maintenance: 0.5, progression: 1.0, focus: 1.4 };
export const WEEKLY_HARD_CAP = 30; // cap Helms MRV / muscle

// Base weekly targets (intermediate baseline, progression) — calibré Helms moyenne basse MEV→MAV
export const BASE_VOLUME: Record<string, number> = {
  Pectoraux: 10,
  Dos: 12,
  Quadriceps: 10,
  Épaules: 8,
  Ischios: 8,
  Biceps: 6,
  Triceps: 6,
  Fessiers: 6,
  Mollets: 6,
  Abdos: 5,
  Adducteurs: 4,
};

// Legacy compat: construit muscleStatus depuis focus + priorities
export function resolveMuscleStatus({ muscleStatus, focus, priorities, muscleGroups }: Any): Record<string, string> {
  if (muscleStatus && typeof muscleStatus === 'object') return muscleStatus;
  const defaultStatus = focus === 'maintenance' ? 'maintenance' : 'progression';
  const out: Record<string, string> = {};
  (muscleGroups || Object.keys(BASE_VOLUME)).forEach((g: string) => {
    out[g] = priorities && priorities.includes(g) ? 'focus' : defaultStatus;
  });
  return out;
}

export function computeVolumeTargets({ level = 'intermediaire', muscleStatus, focus, priorities = [], muscleGroups }: Any): Record<string, number> {
  const lm = LEVEL_MULT[level] || 1;
  const groups = muscleGroups || Object.keys(BASE_VOLUME);
  const status = resolveMuscleStatus({ muscleStatus, focus, priorities, muscleGroups: groups });
  const targets: Record<string, number> = {};
  groups.forEach((g: string) => {
    const base = BASE_VOLUME[g] !== undefined ? BASE_VOLUME[g] : 6;
    const sm = STATUS_MULT[status[g]] !== undefined ? STATUS_MULT[status[g]] : 1;
    let t = base * lm * sm;
    t = Math.round(t);
    if (t > WEEKLY_HARD_CAP) t = WEEKLY_HARD_CAP;
    targets[g] = t;
  });
  return targets;
}

// Avertissements si config peu réaliste (Helms/Norton) — port fidèle v40
export function validateMuscleStatus({ muscleStatus, frequency, level, muscleGroups }: Any) {
  const groups = muscleGroups || Object.keys(BASE_VOLUME);
  const focusCount = groups.filter((g: string) => muscleStatus?.[g] === 'focus').length;
  const warnings: string[] = [];
  const focusCap = frequency <= 3 ? 2 : frequency <= 5 ? 3 : 4;
  if (focusCount > focusCap) {
    warnings.push(`${focusCount} muscles en focus simultanés — au-delà de ${focusCap} le MRV sera dépassé. Passe les moins prioritaires en "progression".`);
  }
  const targets = computeVolumeTargets({ level, muscleStatus, muscleGroups: groups });
  const totalSets = Object.values(targets).reduce((a: number, v: any) => a + v, 0);
  const MAX_SETS_PER_SESSION = 24;
  const weeklyCap = frequency * MAX_SETS_PER_SESSION;
  if (totalSets > weeklyCap * 1.1) {
    warnings.push(`Volume total (${totalSets} séries/sem) dépasse la capacité de ${frequency} séances. Augmente la fréquence ou passe des muscles en "maintenance".`);
  }
  return { warnings, focusCount, totalSets, weeklyCap };
}

/* ====================================================================
   PROGRAM GENERATOR — port fidèle de generateProgram (v40)
   ==================================================================== */

const genUid = () => 'id-' + Math.random().toString(36).slice(2, 9) + '-' + Date.now();

export const REP_COMPOUND = [6, 10];
export const REP_ACCESSORY = [10, 15];
export const MAX_SETS_PER_MUSCLE_PER_SESSION = 8;
export const MAX_EXOS_PER_SESSION = 9;
export const MAX_SETS_PER_SESSION = 24;
export const MAX_SETS_COMPOUND = 3; // jamais 4 sets d'un polyarticulaire
export const MAX_SETS_ACCESSORY = 4;
export const MIN_SETS_COMPOUND = 2;
export const MIN_SETS_ACCESSORY = 1;

export const SPLIT_TEMPLATES: Record<number, Any[]> = {
  2: [
    { name: 'Full Body A', focus: ['push', 'legs_quad', 'pull', 'calves', 'core'] },
    { name: 'Full Body B', focus: ['pull', 'legs_post', 'push', 'shoulders', 'calves'] },
  ],
  3: [
    { name: 'Full Body A', focus: ['push', 'legs_quad', 'pull', 'calves', 'core'] },
    { name: 'Full Body B', focus: ['pull', 'legs_post', 'shoulders', 'core'] },
    { name: 'Full Body C', focus: ['push', 'legs_quad', 'arms', 'calves'] },
  ],
  4: [
    { name: 'Upper A', focus: ['push', 'pull', 'shoulders', 'arms', 'core'] },
    { name: 'Lower A', focus: ['legs_quad', 'legs_post', 'calves', 'glutes'] },
    { name: 'Upper B', focus: ['pull', 'push', 'shoulders', 'arms'] },
    { name: 'Lower B', focus: ['legs_post', 'legs_quad', 'calves', 'glutes', 'core'] },
  ],
  5: [
    { name: 'Upper', focus: ['push', 'pull', 'shoulders', 'arms', 'core'] },
    { name: 'Lower A', focus: ['legs_quad', 'legs_post', 'calves'] },
    { name: 'Push', focus: ['push', 'shoulders', 'triceps'] },
    { name: 'Pull', focus: ['pull', 'biceps', 'rear_delt', 'core'] },
    { name: 'Lower B', focus: ['legs_post', 'legs_quad', 'calves', 'glutes'] },
  ],
  6: [
    { name: 'Push A', focus: ['push', 'shoulders', 'triceps'] },
    { name: 'Pull A', focus: ['pull', 'biceps', 'rear_delt', 'core'] },
    { name: 'Legs A', focus: ['legs_quad', 'legs_post', 'calves'] },
    { name: 'Push B', focus: ['push', 'shoulders', 'triceps', 'core'] },
    { name: 'Pull B', focus: ['pull', 'biceps', 'rear_delt'] },
    { name: 'Legs B', focus: ['legs_post', 'legs_quad', 'glutes', 'calves'] },
  ],
};

export const FOCUS_TO_GROUPS: Record<string, string[]> = {
  push: ['Pectoraux', 'Triceps', 'Épaules'],
  pull: ['Dos', 'Biceps'],
  shoulders: ['Épaules'],
  rear_delt: ['Épaules'],
  triceps: ['Triceps'],
  biceps: ['Biceps'],
  arms: ['Biceps', 'Triceps'],
  legs_quad: ['Quadriceps'],
  legs_post: ['Ischios', 'Fessiers'],
  calves: ['Mollets'],
  glutes: ['Fessiers'],
  core: ['Abdos', 'Lombaires'],
};

function sessionsForGroup(split: Any[], group: string): number[] {
  return split
    .map((sess, i) => {
      const groups = new Set<string>();
      (sess.focus || []).forEach((f: string) => (FOCUS_TO_GROUPS[f] || []).forEach((g) => groups.add(g)));
      return groups.has(group) ? i : null;
    })
    .filter((i): i is number => i !== null);
}

function exoBankByGroup(lib: Any[], muscleGroups: string[]) {
  const bank: Record<string, Any> = {};
  muscleGroups.forEach((g) => {
    const exos = lib.filter((l) => l.muscleGroup === g);
    const bySub: Record<string, Any[]> = {};
    exos.forEach((e) => {
      const k = e.subGroup || '_';
      if (!bySub[k]) bySub[k] = [];
      bySub[k].push(e);
    });
    Object.keys(bySub).forEach((k) => bySub[k].sort((a, b) => (b.priority || 5) - (a.priority || 5)));
    bank[g] = {
      compounds: exos.filter((l) => l.compound).sort((a, b) => (b.priority || 5) - (a.priority || 5)),
      accessories: exos.filter((l) => !l.compound).sort((a, b) => (b.priority || 5) - (a.priority || 5)),
      all: exos.sort((a, b) => (b.priority || 5) - (a.priority || 5)),
      bySub,
    };
  });
  return bank;
}

export function generateProgram({
  level = 'intermediaire',
  muscleStatus,
  focus,
  frequency = 4,
  priorities = [],
  subGroupSplit = {},
  lib,
  muscleGroups,
  name,
}: Any): Any {
  const tplSplit = SPLIT_TEMPLATES[frequency] || SPLIT_TEMPLATES[4];
  const groups: string[] = muscleGroups || MUSCLE_GROUPS_DEFAULT;
  const resolvedStatus = resolveMuscleStatus({ muscleStatus, focus, priorities, muscleGroups: groups });
  const targets = computeVolumeTargets({ level, muscleStatus: resolvedStatus, muscleGroups: groups });
  const bank = exoBankByGroup(lib, groups);

  // Cibles sous-groupes = split hebdo demandé (custom ou défaut)
  const subGroupTargets: Record<string, Record<string, number>> = {};
  groups.forEach((g) => {
    const customPct = subGroupSplit[g] || null;
    const split = splitVolumeBySubGroups(g, targets[g] || 0, customPct);
    if (split) subGroupTargets[g] = split;
  });

  // Tracker du volume déjà placé par sous-groupe sur tout le programme — biaise le picker
  const programSubUsed: Record<string, Record<string, number>> = {};

  const focusGroups = new Set(groups.filter((g) => resolvedStatus[g] === 'focus'));

  const sessionsByGroup: Record<string, number[]> = {};
  groups.forEach((g) => {
    sessionsByGroup[g] = sessionsForGroup(tplSplit, g);
  });

  const idealPerSession: Record<string, number[]> = {};
  groups.forEach((g) => {
    idealPerSession[g] = tplSplit.map(() => 0);
    const sIdxs = sessionsByGroup[g];
    const total = targets[g] || 0;
    if (total === 0 || sIdxs.length === 0) return;
    const perSession = Math.min(MAX_SETS_PER_MUSCLE_PER_SESSION, Math.ceil(total / sIdxs.length));
    let remaining = Math.min(total, perSession * sIdxs.length);
    sIdxs.forEach((si) => {
      if (remaining <= 0) return;
      const s = Math.min(perSession, remaining);
      idealPerSession[g][si] = s;
      remaining -= s;
    });
  });

  const MAJORS = new Set(['Pectoraux', 'Dos', 'Quadriceps', 'Ischios', 'Épaules']);
  const sessions = tplSplit.map((sessTpl, si) => {
    const groupsInSession = [...new Set<string>((sessTpl.focus || []).flatMap((f: string) => FOCUS_TO_GROUPS[f] || []))].filter(
      (g) => idealPerSession[g]?.[si] > 0 && groups.includes(g)
    );

    // Trier : focus d'abord, puis majors, puis autres (par cible décroissante)
    const ordered = [...groupsInSession].sort((a, b) => {
      const ap = focusGroups.has(a),
        bp = focusGroups.has(b);
      if (ap !== bp) return ap ? -1 : 1;
      const am = MAJORS.has(a),
        bm = MAJORS.has(b);
      if (am !== bm) return am ? -1 : 1;
      return (targets[b] || 0) - (targets[a] || 0);
    });

    // Scaling : focus + majors protégés, reste scalé
    const protectedGroups = ordered.filter((g) => focusGroups.has(g) || MAJORS.has(g));
    const secondaryGroups = ordered.filter((g) => !focusGroups.has(g) && !MAJORS.has(g));
    const protectedPlanned = protectedGroups.reduce((a, g) => a + idealPerSession[g][si], 0);
    const secondaryPlanned = secondaryGroups.reduce((a, g) => a + idealPerSession[g][si], 0);

    const adjusted: Record<string, number> = {};
    if (protectedPlanned > MAX_SETS_PER_SESSION) {
      const scale = MAX_SETS_PER_SESSION / (protectedPlanned + secondaryPlanned);
      ordered.forEach((g) => {
        adjusted[g] = Math.max(2, Math.round(idealPerSession[g][si] * scale));
      });
    } else {
      protectedGroups.forEach((g) => {
        adjusted[g] = idealPerSession[g][si];
      });
      const remaining = Math.max(0, MAX_SETS_PER_SESSION - protectedPlanned);
      const scaleSec = secondaryPlanned > 0 && remaining < secondaryPlanned ? remaining / secondaryPlanned : 1;
      secondaryGroups.forEach((g) => {
        const v = Math.round(idealPerSession[g][si] * scaleSec);
        adjusted[g] = v >= 1 ? v : 0;
      });
      // Pass de récupération : réinjecter 1 série min aux groupes skipped si budget restant
      let used = Object.values(adjusted).reduce((a, v) => a + v, 0);
      const dropped = secondaryGroups.filter((g) => adjusted[g] === 0);
      dropped.sort((a, b) => (targets[b] || 0) - (targets[a] || 0));
      for (const g of dropped) {
        if (used + 1 > MAX_SETS_PER_SESSION) break;
        adjusted[g] = 1;
        used += 1;
      }
    }

    const exercises: Any[] = [];
    let totalSessionSets = 0;
    const usedExoIds = new Set<string>();
    const lowFreq = frequency <= 3;

    for (const g of ordered) {
      if (exercises.length >= MAX_EXOS_PER_SESSION) break;
      const remaining = MAX_SETS_PER_SESSION - totalSessionSets;
      if (remaining < MIN_SETS_ACCESSORY) break;

      const setsForGroup = Math.min(adjusted[g] || 0, remaining, MAX_SETS_PER_MUSCLE_PER_SESSION);
      if (setsForGroup < MIN_SETS_ACCESSORY) continue;

      const b = bank[g];
      if (!b || b.all.length === 0) continue;

      let nExos: number;
      if (setsForGroup >= 8 && b.accessories.length >= 2) nExos = 3;
      else if (setsForGroup >= 5) nExos = 2;
      else nExos = 1;

      const picks: Any[] = [];
      const subGroupsUsed = new Set<string>();

      const subTgt = subGroupTargets[g] || {};
      const progUsed = programSubUsed[g] || {};
      const sortByDeficit = (list: Any[]) => {
        return [...list].sort((a, b) => {
          const aUsedNow = a.subGroup && subGroupsUsed.has(a.subGroup) ? 1 : 0;
          const bUsedNow = b.subGroup && subGroupsUsed.has(b.subGroup) ? 1 : 0;
          if (aUsedNow !== bUsedNow) return aUsedNow - bUsedNow;
          const aDef = a.subGroup ? (subTgt[a.subGroup] || 0) - (progUsed[a.subGroup] || 0) : 0;
          const bDef = b.subGroup ? (subTgt[b.subGroup] || 0) - (progUsed[b.subGroup] || 0) : 0;
          if (aDef !== bDef) return bDef - aDef;
          return (a.priority || 5) - (b.priority || 5);
        });
      };

      // 1er pick : compound prioritaire (biaisé par déficit sous-groupe)
      if (b.compounds.length > 0) {
        const sortedCompounds = sortByDeficit(b.compounds.filter((e: Any) => !usedExoIds.has(e.id)));
        const compound = sortedCompounds[0] || b.compounds[0];
        picks.push({ exo: compound, type: 'compound' });
        usedExoIds.add(compound.id);
        if (compound.subGroup) subGroupsUsed.add(compound.subGroup);
      } else if (b.accessories.length > 0) {
        const sortedAcc = sortByDeficit(b.accessories.filter((e: Any) => !usedExoIds.has(e.id)));
        const acc = sortedAcc[0] || b.accessories[0];
        picks.push({ exo: acc, type: 'accessory' });
        usedExoIds.add(acc.id);
        if (acc.subGroup) subGroupsUsed.add(acc.subGroup);
      }

      // 2e pick : si freq basse → 2e compound ; sinon accessoire d'un subGroup différent
      if (nExos >= 2 && picks.length === 1) {
        let second: Any | undefined = undefined;
        if (lowFreq && b.compounds.length >= 2) {
          const pool = sortByDeficit(b.compounds.filter((e: Any) => !usedExoIds.has(e.id)));
          second = pool[0];
        }
        if (!second && b.accessories.length > 0) {
          const pool = sortByDeficit(b.accessories.filter((e: Any) => !usedExoIds.has(e.id)));
          second = pool[0];
        }
        if (!second) {
          const pool = sortByDeficit([...b.accessories, ...b.compounds].filter((e: Any) => !usedExoIds.has(e.id)));
          second = pool[0];
        }
        if (second) {
          picks.push({ exo: second, type: second.compound ? 'compound' : 'accessory' });
          usedExoIds.add(second.id);
          if (second.subGroup) subGroupsUsed.add(second.subGroup);
        }
      }

      // 3e pick : accessoire d'un subGroup non encore travaillé
      if (nExos >= 3 && picks.length === 2 && b.accessories.length > 0) {
        const pool = sortByDeficit(b.accessories.filter((e: Any) => !usedExoIds.has(e.id)));
        const third = pool[0];
        if (third) {
          picks.push({ exo: third, type: 'accessory' });
          usedExoIds.add(third.id);
          if (third.subGroup) subGroupsUsed.add(third.subGroup);
        }
      }

      // Répartition des séries par pick (compounds prioritaires sur le budget)
      const compoundPicks = picks.filter((p) => p.type === 'compound');
      const accessoryPicks = picks.filter((p) => p.type === 'accessory');
      const compoundShare = compoundPicks.length * MAX_SETS_COMPOUND;
      let compoundBudget = Math.min(compoundShare, setsForGroup);
      if (compoundPicks.length > 0 && accessoryPicks.length > 0) {
        const minAccessory = Math.min(accessoryPicks.length, setsForGroup - compoundPicks.length * MIN_SETS_COMPOUND);
        compoundBudget = Math.min(compoundBudget, setsForGroup - Math.max(0, minAccessory));
      }
      let accessoryBudget = Math.max(0, setsForGroup - compoundBudget);

      const setsByPick = new Map<Any, number>();
      compoundPicks.forEach((p, i) => {
        const leftPicks = compoundPicks.length - i;
        let s = Math.round(compoundBudget / leftPicks);
        s = Math.max(MIN_SETS_COMPOUND, Math.min(MAX_SETS_COMPOUND, s));
        setsByPick.set(p, s);
        compoundBudget -= s;
      });
      accessoryPicks.forEach((p, i) => {
        const leftPicks = accessoryPicks.length - i;
        let s = Math.round(accessoryBudget / leftPicks);
        s = Math.max(MIN_SETS_ACCESSORY, Math.min(MAX_SETS_ACCESSORY, s));
        setsByPick.set(p, s);
        accessoryBudget -= s;
      });

      picks.forEach((pick) => {
        let sets = setsByPick.get(pick) || (pick.type === 'compound' ? MIN_SETS_COMPOUND : MIN_SETS_ACCESSORY);
        if (pick.type === 'compound') sets = Math.min(sets, MAX_SETS_COMPOUND);
        else sets = Math.min(sets, MAX_SETS_ACCESSORY);

        if (exercises.length >= MAX_EXOS_PER_SESSION) return;
        if (totalSessionSets + sets > MAX_SETS_PER_SESSION) {
          sets = MAX_SETS_PER_SESSION - totalSessionSets;
          const minOk = pick.type === 'compound' ? MIN_SETS_COMPOUND : MIN_SETS_ACCESSORY;
          if (sets < minOk) return;
        }
        exercises.push({
          id: genUid(),
          sets,
          muscleGroup: g,
          subGroup: pick.exo.subGroup || null,
          choices: [{ exId: pick.exo.id, weight: '', machine: '', muscleGroup: g, subGroup: pick.exo.subGroup || null }],
          repRange: pick.type === 'compound' ? REP_COMPOUND : REP_ACCESSORY,
          isCompound: pick.type === 'compound',
          history: [],
        });
        totalSessionSets += sets;
        if (pick.exo.subGroup) {
          if (!programSubUsed[g]) programSubUsed[g] = {};
          programSubUsed[g][pick.exo.subGroup] = (programSubUsed[g][pick.exo.subGroup] || 0) + sets;
        }
      });
    }

    return { id: genUid(), name: sessTpl.name, exercises };
  });

  return {
    id: genUid(),
    name: name || `Auto · ${frequency}j`,
    level,
    frequency,
    muscleStatus: resolvedStatus,
    priorities, // legacy compat
    focus, // legacy compat
    subGroupSplit, // répartition % custom par sous-groupe
    sessions,
    volumeTargets: {
      program: targets,
      subGroups: subGroupTargets,
      sessions: {},
    },
    createdAt: Date.now(),
    auto: true,
  };
}
