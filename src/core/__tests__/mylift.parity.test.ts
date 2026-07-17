// Test différentiel de parité : exécute le VRAI code v40 (v40-reference/app.jsx,
// évalué dans Node avec des stubs navigateur) et compare ses sorties à celles du
// port TypeScript (src/core/mylift.ts) sur les mêmes inputs.
// Lancer : npm run test:core
import * as fs from 'fs';
import * as path from 'path';
import * as ported from '../mylift';

type Any = Record<string, any>;

/* ------------------------------------------------------------------ */
/* 1. Évaluation du vrai app.jsx dans Node                             */
/* ------------------------------------------------------------------ */
function loadV40(): Any {
  const src = fs.readFileSync(path.join(__dirname, '../../../v40-reference/app.jsx'), 'utf-8');
  const noop = () => {};
  const ReactStub = {
    createElement: (..._a: any[]) => null,
    useState: (v: any) => [v, noop],
    useEffect: noop,
    useMemo: (f: any) => f(),
    useCallback: (f: any) => f,
    useRef: (v: any) => ({ current: v }),
  };
  const ReactDOMStub = { createRoot: () => ({ render: noop }) };
  const store: Record<string, string> = {};
  const localStorageStub = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
  const documentStub = {
    getElementById: () => null,
    head: { appendChild: noop },
    createElement: () => ({ style: {}, setAttribute: noop, textContent: '' }),
    addEventListener: noop,
  };
  const windowStub = { addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop }) };
  const navigatorStub = {};

  const wrapper = new Function(
    'React',
    'ReactDOM',
    'document',
    'window',
    'navigator',
    'localStorage',
    src +
      `;return { exoKey, exoKeyNoModel, e1RM, isValidSet, topSetOf, exoScore, tonnageExo,
        tonnageSession, setsCountSession, scanExoPRs, exoTimeline, progressionSummary,
        muscleIndexTimeline, muscleIndexSummary, computeVolumeTargets, splitVolumeBySubGroups,
        recommendedSession, hydrateSessionExos, exoMuscleGroup, norm, iso, daysAgo };`
  );
  return wrapper(ReactStub, ReactDOMStub, documentStub, windowStub, navigatorStub, localStorageStub);
}

/* ------------------------------------------------------------------ */
/* 2. deepEqual insensible à l'ordre des clés, NaN === NaN             */
/* ------------------------------------------------------------------ */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number' && isNaN(a) && isNaN(b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a),
    kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

let passed = 0;
let failed = 0;
function check(label: string, expected: any, actual: any) {
  if (deepEqual(expected, actual)) {
    passed++;
  } else {
    failed++;
    console.error(`✗ ${label}`);
    console.error(`  v40    : ${JSON.stringify(expected)?.slice(0, 400)}`);
    console.error(`  ported : ${JSON.stringify(actual)?.slice(0, 400)}`);
  }
}

/* ------------------------------------------------------------------ */
/* 3. Fixtures — cas limites choisis à la main                         */
/* ------------------------------------------------------------------ */
const v40 = loadV40();

const LIB: Any[] = [
  { id: 'seed-dc-barre', name: 'Développé couché barre', muscleGroup: 'Pectoraux', subGroup: 'Milieu', compound: true, priority: 10, models: [] },
  { id: 'seed-squat', name: 'Squat libre', muscleGroup: 'Quadriceps', subGroup: null, compound: true, priority: 10, models: [] },
  {
    id: 'ex-legext',
    name: 'Leg extension',
    muscleGroup: 'Quadriceps',
    subGroup: null,
    compound: false,
    priority: 6,
    models: [
      { id: 'mod-hammer', name: 'Hammer', setting: 'S3' },
      { id: 'mod-techno', name: 'Technogym', setting: null },
    ],
  },
  { id: 'ex-lat', name: 'Élévation latérale haltères', muscleGroup: 'Épaules', subGroup: 'Latéral', compound: false, priority: 9, models: [] },
];

// Historique construit relativement à aujourd'hui pour tomber dans la période 28j.
const d = (n: number) => v40.iso(v40.daysAgo(n));

const LOGS: Any[] = [
  {
    id: 'log-01',
    date: d(40), // hors période 28j — sert de baseline PR
    programId: 'prog-1',
    sessionId: 'sess-a',
    durationSec: 3600,
    prs: [],
    exercises: [
      { id: 'le-1', exId: 'seed-dc-barre', exName: 'Développé couché barre', muscleGroup: 'Pectoraux', modelId: null, sets: [
        { weight: '80', reps: '8', rir: '2' },
        { weight: '80', reps: '6', rir: '1' },
      ] },
      { id: 'le-2', exId: 'ex-legext', exName: 'Leg extension', muscleGroup: 'Quadriceps', modelId: 'mod-hammer', sets: [
        { weight: '50', reps: '12', rir: '2' },
      ] },
    ],
  },
  {
    id: 'log-02',
    date: d(20),
    programId: 'prog-1',
    sessionId: 'sess-a',
    durationSec: 3500,
    prs: [],
    exercises: [
      // All-time PR (82.5 > 80) + un set invalide ignoré
      { id: 'le-3', exId: 'seed-dc-barre', exName: 'Développé couché barre', muscleGroup: 'Pectoraux', modelId: null, sets: [
        { weight: '82.5', reps: '7', rir: '1' },
        { weight: '', reps: '10' }, // invalide : weight vide
        { weight: '80', reps: '9' }, // rep PR à 80 (9 > 8)
      ] },
      // Changement de machine : nouvelle baseline Technogym
      { id: 'le-4', exId: 'ex-legext', exName: 'Leg extension', muscleGroup: 'Quadriceps', modelId: 'mod-techno', sets: [
        { weight: '45', reps: '12' },
      ] },
      // Exo hors lib, matché par nom (avec accents)
      { id: 'le-5', exId: null, exName: 'élévation LATÉRALE haltères ', muscleGroup: null, modelId: null, sets: [
        { weight: '10', reps: '15' },
      ] },
    ],
  },
  {
    id: 'log-03',
    date: d(10),
    programId: 'prog-1',
    sessionId: 'sess-b',
    durationSec: 3400,
    prs: [{ type: 'allTime' }],
    exercises: [
      // EPS : 82.52 n'est PAS un all-time PR (délta ≤ 0.05), 82.56 l'est
      { id: 'le-6', exId: 'seed-dc-barre', exName: 'Développé couché barre', muscleGroup: 'Pectoraux', modelId: null, sets: [
        { weight: '82.52', reps: '5' },
        { weight: '82.56', reps: '5' },
      ] },
      { id: 'le-7', exId: 'ex-legext', exName: 'Leg extension', muscleGroup: 'Quadriceps', modelId: 'mod-techno', sets: [
        { weight: '50', reps: '12' },
      ] },
      // Poids du corps : weight '0' explicite = set valide
      { id: 'le-8', exId: null, exName: 'Traction pronation', muscleGroup: 'Dos', modelId: null, sets: [
        { weight: '0', reps: '10' },
      ] },
    ],
  },
  {
    id: 'log-04',
    date: d(2),
    programId: 'prog-1',
    sessionId: 'sess-a',
    durationSec: 3700,
    prs: [],
    exercises: [
      { id: 'le-9', exId: 'seed-squat', exName: 'Squat libre', muscleGroup: 'Quadriceps', modelId: null, sets: [
        { weight: '100', reps: '5', rir: '2' },
        { weight: '100', reps: '5', rir: '1' },
        { weight: '105', reps: '3', rir: '0' },
      ] },
      { id: 'le-10', exId: 'ex-legext', exName: 'Leg extension', muscleGroup: 'Quadriceps', modelId: 'mod-hammer', sets: [
        { weight: '55', reps: '10' },
      ] },
    ],
  },
];

const PROGRAM: Any = {
  id: 'prog-1',
  name: 'UL4',
  sessions: [
    {
      id: 'sess-a',
      name: 'Upper A',
      exercises: [
        {
          id: 'pex-1',
          sets: '4',
          muscleGroup: 'Pectoraux',
          choices: [{ exId: 'seed-dc-barre', weight: '80', machine: '' }],
          modelTargets: [],
        },
        {
          id: 'pex-2',
          sets: 3,
          muscleGroup: 'Quadriceps',
          choices: [{ exId: 'ex-legext', weight: '', machine: 'Hammer' }],
          modelTargets: [
            { modelId: 'mod-hammer', weight: 55 },
            { modelId: 'mod-disparu', weight: 40 }, // modèle supprimé → filtré
          ],
        },
        {
          id: 'pex-3',
          sets: '3',
          exName: 'Exo custom sans lib',
          muscleGroup: 'Dos',
          choices: [],
          modelTargets: [],
        },
      ],
    },
    { id: 'sess-b', name: 'Lower A', exercises: [] },
    { id: 'sess-c', name: 'Jamais faite', exercises: [] },
  ],
};

/* ------------------------------------------------------------------ */
/* 4. Cas limites unitaires                                            */
/* ------------------------------------------------------------------ */

// e1RM
[
  ['100', '10'],
  [80, 1],
  ['0', '10'],
  ['100', '0'],
  ['abc', '5'],
  ['62.5', '7.9'], // reps parseInt → 7
  [null, null],
].forEach(([w, r], i) => check(`e1RM #${i} (${w},${r})`, v40.e1RM(w, r), ported.e1RM(w, r)));

// isValidSet
[
  { weight: '0', reps: '10' },
  { weight: '', reps: '10' },
  { weight: null, reps: '10' },
  { weight: '100', reps: '0' },
  { weight: '100', reps: '51' },
  { weight: '1001', reps: '5' },
  { weight: '1000', reps: '50' },
  { weight: '80', reps: '8' },
].forEach((s, i) => check(`isValidSet #${i}`, v40.isValidSet(s), ported.isValidSet(s)));

// exoKey / exoKeyNoModel — modelId, activeModelId, nom accentué
[
  { exId: 'ex-1', modelId: 'm-1' },
  { exId: 'ex-1', activeModelId: 'm-2' },
  { exId: 'ex-1', modelId: 'm-1', activeModelId: 'm-2' }, // modelId prioritaire
  { exName: ' Développé INCLINÉ barre ' },
  { name: 'Élévation latérale' },
  { exName: '' },
  {},
].forEach((ex, i) => {
  check(`exoKey #${i}`, v40.exoKey(ex), ported.exoKey(ex));
  check(`exoKeyNoModel #${i}`, v40.exoKeyNoModel(ex), ported.exoKeyNoModel(ex));
});

// topSetOf / tonnage / exoScore
const exMixed = {
  sets: [
    { weight: '80', reps: '8' },
    { weight: '85', reps: '5' },
    { weight: '', reps: '12' },
    { weight: '82.5', reps: '7' },
  ],
};
check('topSetOf mixte', v40.topSetOf(exMixed), ported.topSetOf(exMixed));
check('topSetOf vide', v40.topSetOf({ sets: [] }), ported.topSetOf({ sets: [] }));
check('topSetOf sans sets', v40.topSetOf({}), ported.topSetOf({}));
check('tonnageExo', v40.tonnageExo(exMixed), ported.tonnageExo(exMixed));
check('exoScore', v40.exoScore(exMixed), ported.exoScore(exMixed));
LOGS.forEach((l, i) => {
  check(`tonnageSession log ${i}`, v40.tonnageSession(l), ported.tonnageSession(l));
  check(`setsCountSession log ${i}`, v40.setsCountSession(l), ported.setsCountSession(l));
});

// exoMuscleGroup — via exId, via champ direct, via nom, fallback Autre
[
  { exId: 'seed-dc-barre' },
  { exId: 'inconnu', muscleGroup: 'Dos' },
  { exName: 'leg EXTENSION' },
  { exName: 'Inconnu total' },
].forEach((ex, i) => check(`exoMuscleGroup #${i}`, v40.exoMuscleGroup(ex, LIB), ported.exoMuscleGroup(ex, LIB)));

/* ------------------------------------------------------------------ */
/* 5. PR scan — le cœur critique                                       */
/* ------------------------------------------------------------------ */
const dcKey = 'lib:seed-dc-barre';
check('scanExoPRs DC barre', v40.scanExoPRs(LOGS, v40.exoKeyNoModel, dcKey), ported.scanExoPRs(LOGS, ported.exoKeyNoModel, dcKey));
const legHammerKey = 'lib:ex-legext/m:mod-hammer';
check('scanExoPRs LegExt/Hammer', v40.scanExoPRs(LOGS, v40.exoKey, legHammerKey), ported.scanExoPRs(LOGS, ported.exoKey, legHammerKey));
check('scanExoPRs clé absente', v40.scanExoPRs(LOGS, v40.exoKey, 'lib:nexiste-pas'), ported.scanExoPRs(LOGS, ported.exoKey, 'lib:nexiste-pas'));

// exoTimeline — les 3 modes de filtre modèle
check('exoTimeline all', v40.exoTimeline(LOGS, 'lib:ex-legext', 'all'), ported.exoTimeline(LOGS, 'lib:ex-legext', 'all'));
check('exoTimeline mod-hammer', v40.exoTimeline(LOGS, 'lib:ex-legext', 'mod-hammer'), ported.exoTimeline(LOGS, 'lib:ex-legext', 'mod-hammer'));
check('exoTimeline none', v40.exoTimeline(LOGS, 'lib:seed-dc-barre', 'none'), ported.exoTimeline(LOGS, 'lib:seed-dc-barre', 'none'));
check('exoTimeline undefined filter', v40.exoTimeline(LOGS, 'lib:ex-legext/m:mod-techno'), ported.exoTimeline(LOGS, 'lib:ex-legext/m:mod-techno'));

/* ------------------------------------------------------------------ */
/* 6. Agrégats : progression, index muscle                             */
/* ------------------------------------------------------------------ */
check('progressionSummary 28j', v40.progressionSummary(LOGS, LIB, 28), ported.progressionSummary(LOGS, LIB, 28));
check('progressionSummary 90j', v40.progressionSummary(LOGS, LIB, 90), ported.progressionSummary(LOGS, LIB, 90));

const cut28 = v40.iso(v40.daysAgo(28));
check('muscleIndexTimeline Quadriceps', v40.muscleIndexTimeline(LOGS, LIB, 'Quadriceps', cut28), ported.muscleIndexTimeline(LOGS, LIB, 'Quadriceps', cut28));
check('muscleIndexTimeline Pectoraux', v40.muscleIndexTimeline(LOGS, LIB, 'Pectoraux', cut28), ported.muscleIndexTimeline(LOGS, LIB, 'Pectoraux', cut28));
check(
  'muscleIndexTimeline Épaules + subGroup',
  v40.muscleIndexTimeline(LOGS, LIB, 'Épaules', cut28, 'Latéral'),
  ported.muscleIndexTimeline(LOGS, LIB, 'Épaules', cut28, 'Latéral')
);
check('muscleIndexSummary 28j', v40.muscleIndexSummary(LOGS, LIB, 28), ported.muscleIndexSummary(LOGS, LIB, 28));

/* ------------------------------------------------------------------ */
/* 7. Programme : recommandation, hydratation, volume                  */
/* ------------------------------------------------------------------ */
check('recommendedSession', v40.recommendedSession(PROGRAM, LOGS), ported.recommendedSession(PROGRAM, LOGS));
check('recommendedSession sans programme', v40.recommendedSession(null, LOGS), ported.recommendedSession(null, LOGS));
check('recommendedSession programme vide', v40.recommendedSession({ id: 'p', sessions: [] }, LOGS), ported.recommendedSession({ id: 'p', sessions: [] }, LOGS));
check('hydrateSessionExos', v40.hydrateSessionExos(PROGRAM.sessions[0], LIB, LOGS), ported.hydrateSessionExos(PROGRAM.sessions[0], LIB, LOGS));

// computeVolumeTargets — niveaux × statuts
[
  { level: 'debutant' },
  { level: 'intermediaire', priorities: ['Dos', 'Épaules'] },
  { level: 'confirme', focus: 'maintenance' },
  { level: 'confirme', muscleStatus: { Pectoraux: 'focus', Dos: 'maintenance' }, muscleGroups: ['Pectoraux', 'Dos', 'Mollets'] },
  { level: 'inconnu', muscleGroups: ['GroupePerso'] },
].forEach((cfg, i) => check(`computeVolumeTargets #${i}`, v40.computeVolumeTargets(cfg), ported.computeVolumeTargets(cfg)));

// splitVolumeBySubGroups — défaut, custom, arrondi largest-remainder, groupe sans sous-groupes
[
  ['Pectoraux', 10, null],
  ['Pectoraux', 7, null],
  ['Dos', 13, null],
  ['Épaules', 9, { Antérieur: 10, Latéral: 70 }], // Arrière manquant → complété
  ['Quadriceps', 10, null], // pas de sous-groupes → null
  ['Pectoraux', 0, null],
].forEach(([g, n, pct], i) =>
  check(`splitVolumeBySubGroups #${i}`, v40.splitVolumeBySubGroups(g, n, pct), ported.splitVolumeBySubGroups(g as string, n as number, pct as any))
);

/* ------------------------------------------------------------------ */
/* 8. Fuzz déterministe — 30 historiques aléatoires                    */
/* ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

const fuzzExos = [
  { exId: 'seed-dc-barre', exName: 'Développé couché barre', models: [null] },
  { exId: 'ex-legext', exName: 'Leg extension', models: [null, 'mod-hammer', 'mod-techno'] },
  { exId: null, exName: 'Curl debout', models: [null] },
  { exId: 'seed-squat', exName: 'Squat libre', models: [null] },
  { exId: 'ex-lat', exName: 'Élévation latérale haltères', models: [null] },
];

for (let f = 0; f < 30; f++) {
  const nLogs = 1 + Math.floor(rnd() * 12);
  const logs: Any[] = [];
  for (let i = 0; i < nLogs; i++) {
    const nEx = 1 + Math.floor(rnd() * 4);
    const exercises: Any[] = [];
    for (let j = 0; j < nEx; j++) {
      const base = pick(fuzzExos);
      const nSets = 1 + Math.floor(rnd() * 4);
      const sets: Any[] = [];
      for (let k = 0; k < nSets; k++) {
        const invalid = rnd() < 0.15;
        sets.push(
          invalid
            ? { weight: '', reps: String(Math.floor(rnd() * 12)) }
            : { weight: (Math.round(rnd() * 400) / 4).toFixed(2), reps: String(1 + Math.floor(rnd() * 15)), rir: String(Math.floor(rnd() * 4)) }
        );
      }
      exercises.push({
        id: `f${f}-l${i}-e${j}`,
        exId: base.exId,
        exName: base.exName,
        modelId: pick(base.models),
        muscleGroup: null,
        sets,
      });
    }
    logs.push({
      id: `f${f}-log${i}`,
      date: d(Math.floor(rnd() * 60)),
      programId: 'prog-1',
      sessionId: pick(['sess-a', 'sess-b', 'sess-c']),
      durationSec: Math.floor(rnd() * 5000),
      prs: [],
      exercises,
    });
  }
  check(`fuzz#${f} progressionSummary`, v40.progressionSummary(logs, LIB, 28), ported.progressionSummary(logs, LIB, 28));
  check(`fuzz#${f} muscleIndexSummary`, v40.muscleIndexSummary(logs, LIB, 28), ported.muscleIndexSummary(logs, LIB, 28));
  check(`fuzz#${f} scanExoPRs`, v40.scanExoPRs(logs, v40.exoKey, 'lib:ex-legext/m:mod-hammer'), ported.scanExoPRs(logs, ported.exoKey, 'lib:ex-legext/m:mod-hammer'));
  check(`fuzz#${f} recommendedSession`, v40.recommendedSession(PROGRAM, logs), ported.recommendedSession(PROGRAM, logs));
  check(`fuzz#${f} hydrateSessionExos`, v40.hydrateSessionExos(PROGRAM.sessions[0], LIB, logs), ported.hydrateSessionExos(PROGRAM.sessions[0], LIB, logs));
}

/* ------------------------------------------------------------------ */
console.log(`\nParité v40 ↔ port TS : ${passed} OK, ${failed} échec(s)`);
if (failed > 0) process.exit(1);
