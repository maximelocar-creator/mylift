// Repo local : l'API de données des écrans. Lit et écrit UNIQUEMENT SQLite,
// dans les formes v40 (camelCase, structures imbriquées) attendues par
// src/core/mylift.ts. Les écritures enfilent une op de sync dans la même
// transaction (voir sync.ts pour le push vers Supabase).
import { getDb } from "./local";
import type { Any } from "../core/mylift";

export const uid = () => "id-" + Math.random().toString(36).slice(2, 9) + "-" + Date.now();

/* ------------------------------------------------------------------ */
/* Sync queue (enfilage — le flush est dans sync.ts)                   */
/* ------------------------------------------------------------------ */
type SyncOp = "insert" | "upsert" | "update" | "delete";

async function enqueue(db: Awaited<ReturnType<typeof getDb>>, table: string, op: SyncOp, pk: Any, payload: Any | null) {
  await db.runAsync(
    "INSERT INTO sync_queue (table_name, op, pk, payload, created_at) VALUES (?, ?, ?, ?, ?)",
    [table, op, JSON.stringify(pk), payload ? JSON.stringify(payload) : null, Date.now()]
  );
}

/* ------------------------------------------------------------------ */
/* Bibliothèque d'exercices (forme v40 : models imbriqués)             */
/* ------------------------------------------------------------------ */
export async function getExerciseLib(): Promise<Any[]> {
  const db = await getDb();
  const exos = await db.getAllAsync<Any>("SELECT * FROM exercises ORDER BY name");
  const models = await db.getAllAsync<Any>("SELECT * FROM exercise_models ORDER BY name");
  const byExo: Record<string, Any[]> = {};
  models.forEach((m) => {
    if (!byExo[m.exercise_id]) byExo[m.exercise_id] = [];
    byExo[m.exercise_id].push({ id: m.id, name: m.name, setting: m.setting, color: m.color });
  });
  return exos.map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscle_group,
    subGroup: e.sub_group,
    compound: !!e.compound,
    priority: e.priority ?? 5,
    isSeed: !!e.is_seed,
    models: byExo[e.id] || [],
  }));
}

export async function addExercise(userId: string, exo: { name: string; muscleGroup: string; subGroup?: string | null; compound?: boolean; priority?: number }): Promise<Any> {
  const db = await getDb();
  const row = {
    id: uid(),
    name: exo.name,
    muscle_group: exo.muscleGroup,
    sub_group: exo.subGroup ?? null,
    compound: exo.compound ? 1 : 0,
    priority: exo.priority ?? 5,
    is_seed: 0,
    owner_id: userId,
  };
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT INTO exercises (id, name, muscle_group, sub_group, compound, priority, is_seed, owner_id) VALUES (?,?,?,?,?,?,?,?)",
      [row.id, row.name, row.muscle_group, row.sub_group, row.compound, row.priority, row.is_seed, row.owner_id]
    );
    await enqueue(tx as any, "exercises", "upsert", { id: row.id }, { ...row, compound: !!row.compound, is_seed: false });
  });
  return { id: row.id, name: row.name, muscleGroup: row.muscle_group, subGroup: row.sub_group, compound: !!row.compound, priority: row.priority, models: [] };
}

export async function addExerciseModel(userId: string, exerciseId: string, model: { name: string; setting?: string | null; color?: string | null }): Promise<Any> {
  const db = await getDb();
  const row = { id: uid(), exercise_id: exerciseId, owner_id: userId, name: model.name, setting: model.setting ?? null, color: model.color ?? null };
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("INSERT INTO exercise_models (id, exercise_id, owner_id, name, setting, color) VALUES (?,?,?,?,?,?)", [
      row.id, row.exercise_id, row.owner_id, row.name, row.setting, row.color,
    ]);
    await enqueue(tx as any, "exercise_models", "upsert", { id: row.id }, row);
  });
  return { id: row.id, name: row.name, setting: row.setting, color: row.color };
}

/* ------------------------------------------------------------------ */
/* Programmes (forme v40 : sessions/exercises/modelTargets imbriqués)   */
/* ------------------------------------------------------------------ */
export async function getPrograms(): Promise<Any[]> {
  const db = await getDb();
  const progs = await db.getAllAsync<Any>("SELECT * FROM programs ORDER BY name");
  const sessions = await db.getAllAsync<Any>("SELECT * FROM program_sessions ORDER BY position");
  const pexs = await db.getAllAsync<Any>("SELECT * FROM program_exercises ORDER BY position");
  const mts = await db.getAllAsync<Any>("SELECT * FROM program_model_targets");

  const mtByPex: Record<string, Any[]> = {};
  mts.forEach((t) => {
    if (!mtByPex[t.program_exercise_id]) mtByPex[t.program_exercise_id] = [];
    mtByPex[t.program_exercise_id].push({ modelId: t.model_id, weight: t.weight });
  });
  const pexBySession: Record<string, Any[]> = {};
  pexs.forEach((px) => {
    if (!pexBySession[px.session_id]) pexBySession[px.session_id] = [];
    pexBySession[px.session_id].push({
      id: px.id,
      sets: px.sets,
      muscleGroup: px.muscle_group,
      isCompound: !!px.is_compound,
      choices: JSON.parse(px.choices || "[]"),
      history: JSON.parse(px.history || "[]"),
      modelTargets: mtByPex[px.id] || [],
    });
  });
  const sessByProg: Record<string, Any[]> = {};
  sessions.forEach((s) => {
    if (!sessByProg[s.program_id]) sessByProg[s.program_id] = [];
    sessByProg[s.program_id].push({ id: s.id, name: s.name, exercises: pexBySession[s.id] || [] });
  });
  return progs.map((p) => ({
    id: p.id,
    name: p.name,
    level: p.level,
    frequency: p.frequency,
    muscleStatus: JSON.parse(p.muscle_status || "{}"),
    priorities: JSON.parse(p.priorities || "[]"),
    subGroupSplit: JSON.parse(p.sub_group_split || "{}"),
    volumeTargets: JSON.parse(p.volume_targets || "{}"),
    auto: !!p.auto,
    sessions: sessByProg[p.id] || [],
  }));
}

/**
 * Popup "dépassement de cible" (séance live) : persiste la nouvelle cible dans
 * le programme. Si un modèle est actif → program_model_targets (le bon endroit,
 * cf. v40) ; sinon → choices[].weight (ancien système).
 */
export async function updateProgramExerciseTarget(
  pexId: string,
  opts: { targetModelId?: string | null; exId?: string | null; newWeight: number }
): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (opts.targetModelId) {
      await tx.runAsync(
        "INSERT OR REPLACE INTO program_model_targets (program_exercise_id, model_id, weight) VALUES (?,?,?)",
        [pexId, opts.targetModelId, opts.newWeight]
      );
      await enqueue(
        tx as any,
        "program_model_targets",
        "upsert",
        { program_exercise_id: pexId, model_id: opts.targetModelId },
        { program_exercise_id: pexId, model_id: opts.targetModelId, weight: opts.newWeight }
      );
    } else {
      const row = await tx.getFirstAsync<Any>("SELECT choices FROM program_exercises WHERE id = ?", [pexId]);
      if (!row) return;
      const choices = (JSON.parse(row.choices || "[]") as Any[]).map((c) =>
        c.exId === opts.exId ? { ...c, weight: opts.newWeight } : c
      );
      await tx.runAsync("UPDATE program_exercises SET choices = ? WHERE id = ?", [JSON.stringify(choices), pexId]);
      await enqueue(tx as any, "program_exercises", "update", { id: pexId }, { choices });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Journal (forme v40 : journalLogs avec exercises/sets/prs imbriqués)  */
/* ------------------------------------------------------------------ */
export async function getJournalLogs(): Promise<Any[]> {
  const db = await getDb();
  const logs = await db.getAllAsync<Any>("SELECT * FROM workout_logs ORDER BY date, id");
  const lexs = await db.getAllAsync<Any>("SELECT * FROM log_exercises ORDER BY position");
  const sets = await db.getAllAsync<Any>("SELECT * FROM log_sets ORDER BY position");
  const prs = await db.getAllAsync<Any>("SELECT * FROM workout_prs");

  const setsByLex: Record<string, Any[]> = {};
  sets.forEach((s) => {
    if (!setsByLex[s.log_exercise_id]) setsByLex[s.log_exercise_id] = [];
    // v40 stocke weight/reps/rir en chaînes saisies ; on restitue en chaînes
    // pour que isValidSet/parseFloat se comportent exactement pareil.
    setsByLex[s.log_exercise_id].push({
      weight: s.weight === null || s.weight === undefined ? "" : String(s.weight),
      reps: s.reps === null || s.reps === undefined ? "" : String(s.reps),
      rir: s.rir === null || s.rir === undefined ? "" : String(s.rir),
    });
  });
  const lexByLog: Record<string, Any[]> = {};
  lexs.forEach((le) => {
    if (!lexByLog[le.log_id]) lexByLog[le.log_id] = [];
    lexByLog[le.log_id].push({
      id: le.id,
      exId: le.ex_id,
      exName: le.ex_name,
      muscleGroup: le.muscle_group,
      modelId: le.model_id,
      sets: setsByLex[le.id] || [],
    });
  });
  const prsByLog: Record<string, Any[]> = {};
  prs.forEach((pr) => {
    if (!prsByLog[pr.log_id]) prsByLog[pr.log_id] = [];
    prsByLog[pr.log_id].push({ type: pr.type, exName: pr.ex_name, exId: pr.ex_id, modelId: pr.model_id, weight: pr.weight, reps: pr.reps });
  });
  return logs.map((l) => ({
    id: l.id,
    date: l.date,
    programId: l.program_id,
    sessionId: l.session_id,
    programName: l.program_name,
    sessionName: l.session_name,
    durationSec: l.duration_sec ?? 0,
    exercises: lexByLog[l.id] || [],
    prs: prsByLog[l.id] || [],
  }));
}

/**
 * Sauvegarde une séance validée : écriture locale + enfilage sync, tout dans
 * UNE transaction. Les logs sont immuables (trigger SQL côté serveur) : op
 * 'insert' → upsert ignoreDuplicates = ON CONFLICT DO NOTHING, aucun UPDATE émis.
 */
export async function saveWorkoutLog(userId: string, log: Any): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const logRow = {
      id: log.id,
      owner_id: userId,
      session_id: log.sessionId ?? null,
      program_id: log.programId ?? null,
      session_name: log.sessionName ?? null,
      program_name: log.programName ?? null,
      date: log.date,
      duration_sec: log.durationSec ?? 0,
    };
    await tx.runAsync(
      "INSERT OR REPLACE INTO workout_logs (id, owner_id, session_id, program_id, session_name, program_name, date, duration_sec) VALUES (?,?,?,?,?,?,?,?)",
      [logRow.id, logRow.owner_id, logRow.session_id, logRow.program_id, logRow.session_name, logRow.program_name, logRow.date, logRow.duration_sec]
    );
    await enqueue(tx as any, "workout_logs", "insert", { id: logRow.id }, logRow);

    for (let xi = 0; xi < (log.exercises || []).length; xi++) {
      const ex = log.exercises[xi];
      const lexRow = {
        id: ex.id,
        log_id: log.id,
        ex_id: ex.exId ?? null,
        ex_name: ex.exName ?? "",
        muscle_group: ex.muscleGroup ?? null,
        model_id: ex.modelId ?? null,
        position: xi,
      };
      await tx.runAsync(
        "INSERT OR REPLACE INTO log_exercises (id, log_id, ex_id, ex_name, muscle_group, model_id, position) VALUES (?,?,?,?,?,?,?)",
        [lexRow.id, lexRow.log_id, lexRow.ex_id, lexRow.ex_name, lexRow.muscle_group, lexRow.model_id, lexRow.position]
      );
      await enqueue(tx as any, "log_exercises", "insert", { id: lexRow.id }, lexRow);

      const validSets = ex.sets || [];
      for (let si = 0; si < validSets.length; si++) {
        const s = validSets[si];
        const setRow = {
          id: `${ex.id}-s${si}`,
          log_exercise_id: ex.id,
          weight: s.weight === "" || s.weight === null || s.weight === undefined ? null : parseFloat(s.weight),
          reps: s.reps === "" || s.reps === null || s.reps === undefined ? null : parseInt(s.reps),
          rir: s.rir === "" || s.rir === null || s.rir === undefined ? null : parseInt(s.rir),
          position: si,
        };
        await tx.runAsync("INSERT OR REPLACE INTO log_sets (id, log_exercise_id, weight, reps, rir, position) VALUES (?,?,?,?,?,?)", [
          setRow.id, setRow.log_exercise_id, setRow.weight, setRow.reps, setRow.rir, setRow.position,
        ]);
        await enqueue(tx as any, "log_sets", "insert", { id: setRow.id }, setRow);
      }
    }

    for (let pi = 0; pi < (log.prs || []).length; pi++) {
      const pr = log.prs[pi];
      const prRow = {
        id: `${log.id}-pr${pi}`,
        log_id: log.id,
        type: pr.type,
        ex_name: pr.exName,
        ex_id: pr.exId ?? null,
        model_id: pr.modelId ?? null,
        weight: pr.weight,
        reps: pr.reps,
      };
      await tx.runAsync("INSERT OR REPLACE INTO workout_prs (id, log_id, type, ex_name, ex_id, model_id, weight, reps) VALUES (?,?,?,?,?,?,?,?)", [
        prRow.id, prRow.log_id, prRow.type, prRow.ex_name, prRow.ex_id, prRow.model_id, prRow.weight, prRow.reps,
      ]);
      await enqueue(tx as any, "workout_prs", "insert", { id: prRow.id }, prRow);
    }
  });
}

/** Suppression d'une séance (le DELETE par l'owner est permis côté serveur). */
export async function deleteWorkoutLog(logId: string): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const lexs = await tx.getAllAsync<Any>("SELECT id FROM log_exercises WHERE log_id = ?", [logId]);
    for (const le of lexs) {
      await tx.runAsync("DELETE FROM log_sets WHERE log_exercise_id = ?", [le.id]);
    }
    await tx.runAsync("DELETE FROM log_exercises WHERE log_id = ?", [logId]);
    await tx.runAsync("DELETE FROM workout_prs WHERE log_id = ?", [logId]);
    await tx.runAsync("DELETE FROM workout_logs WHERE id = ?", [logId]);
    // Le DELETE en cascade est géré côté serveur par les FK ; on ne pousse que le parent.
    await enqueue(tx as any, "workout_logs", "delete", { id: logId }, null);
  });
}

/* ------------------------------------------------------------------ */
/* Pesées                                                              */
/* ------------------------------------------------------------------ */
export async function getWeights(): Promise<Any[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Any>("SELECT * FROM weights ORDER BY date");
  return rows.map((w) => ({ id: w.id, date: w.date, weight: w.weight, note: w.note, importedFrom: w.imported_from }));
}

export async function addWeight(userId: string, entry: { date: string; weight: number; note?: string | null }): Promise<Any> {
  const db = await getDb();
  const row = { id: uid(), owner_id: userId, date: entry.date, weight: entry.weight, note: entry.note ?? null, imported_from: null };
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("INSERT OR REPLACE INTO weights (id, owner_id, date, weight, note, imported_from) VALUES (?,?,?,?,?,?)", [
      row.id, row.owner_id, row.date, row.weight, row.note, row.imported_from,
    ]);
    await enqueue(tx as any, "weights", "upsert", { id: row.id }, row);
  });
  return { id: row.id, date: row.date, weight: row.weight, note: row.note };
}

export async function deleteWeight(weightId: string): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("DELETE FROM weights WHERE id = ?", [weightId]);
    await enqueue(tx as any, "weights", "delete", { id: weightId }, null);
  });
}

/* ------------------------------------------------------------------ */
/* Profil / programme courant / taxonomie                              */
/* ------------------------------------------------------------------ */
export async function getProfile(): Promise<Any | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Any>("SELECT * FROM profiles LIMIT 1");
  return row ? { id: row.id, username: row.username, currentProgramId: row.current_program_id } : null;
}

export async function setCurrentProgram(userId: string, programId: string | null): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("UPDATE profiles SET current_program_id = ? WHERE id = ?", [programId, userId]);
    await enqueue(tx as any, "profiles", "update", { id: userId }, { current_program_id: programId });
  });
}

export async function getMuscleGroups(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Any>("SELECT name FROM muscle_groups ORDER BY position");
  return rows.map((r) => r.name);
}

export async function getSubGroups(): Promise<Record<string, string[]>> {
  const db = await getDb();
  const rows = await db.getAllAsync<Any>("SELECT muscle_group, name FROM sub_groups ORDER BY position");
  const out: Record<string, string[]> = {};
  rows.forEach((r) => {
    if (!out[r.muscle_group]) out[r.muscle_group] = [];
    out[r.muscle_group].push(r.name);
  });
  return out;
}

/** Toutes les notes, clé "<programId>::<sessionId>" (même convention que v40). */
export async function getSessionNotes(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<Any>("SELECT session_id, note FROM session_notes");
  const out: Record<string, string> = {};
  rows.forEach((r) => {
    out[r.session_id] = r.note;
  });
  return out;
}

export async function getSessionNote(sessionKey: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Any>("SELECT note FROM session_notes WHERE session_id = ?", [sessionKey]);
  return row?.note ?? null;
}

export async function setSessionNote(userId: string, sessionKey: string, note: string | null): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (note && note.trim()) {
      await tx.runAsync("INSERT OR REPLACE INTO session_notes (owner_id, session_id, note) VALUES (?,?,?)", [userId, sessionKey, note.trim()]);
      await enqueue(tx as any, "session_notes", "upsert", { owner_id: userId, session_id: sessionKey }, { owner_id: userId, session_id: sessionKey, note: note.trim() });
    } else {
      await tx.runAsync("DELETE FROM session_notes WHERE owner_id = ? AND session_id = ?", [userId, sessionKey]);
      await enqueue(tx as any, "session_notes", "delete", { owner_id: userId, session_id: sessionKey }, null);
    }
  });
}

/* ------------------------------------------------------------------ */
/* CRUD programmes — édition v40 (updateCurrentProgram par copie mutée) */
/* ------------------------------------------------------------------ */

type FlatProgram = {
  program: Any;
  sessions: Any[];
  exercises: Any[];
  targets: Any[];
};

function flattenProgram(userId: string, p: Any): FlatProgram {
  const program = {
    id: p.id,
    owner_id: userId,
    name: p.name,
    level: p.level ?? null,
    frequency: p.frequency ?? null,
    muscle_status: JSON.stringify(p.muscleStatus ?? {}),
    priorities: JSON.stringify(p.priorities ?? []),
    sub_group_split: JSON.stringify(p.subGroupSplit ?? {}),
    volume_targets: JSON.stringify(p.volumeTargets ?? {}),
    auto: p.auto ? 1 : 0,
  };
  const sessions: Any[] = [];
  const exercises: Any[] = [];
  const targets: Any[] = [];
  (p.sessions || []).forEach((s: Any, si: number) => {
    sessions.push({ id: s.id, program_id: p.id, name: s.name, position: si });
    (s.exercises || []).forEach((ex: Any, ei: number) => {
      exercises.push({
        id: ex.id,
        session_id: s.id,
        position: ei,
        sets: parseInt(ex.sets) || 3,
        muscle_group: ex.muscleGroup ?? null,
        is_compound: ex.isCompound ? 1 : 0,
        choices: JSON.stringify(ex.choices ?? []),
        history: JSON.stringify(ex.history ?? []),
      });
      (ex.modelTargets || []).forEach((mt: Any) => {
        targets.push({ program_exercise_id: ex.id, model_id: mt.modelId, weight: mt.weight === "" || mt.weight === null || mt.weight === undefined ? null : parseFloat(mt.weight) });
      });
    });
  });
  return { program, sessions, exercises, targets };
}

/**
 * Écrit l'état complet d'un programme (forme v40) : diff contre l'état local,
 * upsert des lignes nouvelles/modifiées, delete des lignes disparues — le tout
 * en une transaction avec enfilage sync. Le serveur supprime en cascade
 * (sessions → exos → cibles), donc on ne pousse que les deletes de tête.
 */
export async function replaceProgram(userId: string, prog: Any): Promise<void> {
  const db = await getDb();
  const flat = flattenProgram(userId, prog);
  await db.withExclusiveTransactionAsync(async (tx) => {
    // État local actuel
    const oldSessions = await tx.getAllAsync<Any>("SELECT * FROM program_sessions WHERE program_id = ?", [prog.id]);
    const oldSessionIds = oldSessions.map((s) => s.id);
    const oldPexs = oldSessionIds.length
      ? await tx.getAllAsync<Any>(`SELECT * FROM program_exercises WHERE session_id IN (${oldSessionIds.map(() => "?").join(",")})`, oldSessionIds)
      : [];
    const oldPexIds = oldPexs.map((e) => e.id);
    const oldTargets = oldPexIds.length
      ? await tx.getAllAsync<Any>(`SELECT * FROM program_model_targets WHERE program_exercise_id IN (${oldPexIds.map(() => "?").join(",")})`, oldPexIds)
      : [];
    const oldProgram = await tx.getFirstAsync<Any>("SELECT * FROM programs WHERE id = ?", [prog.id]);

    const newSessionIds = new Set(flat.sessions.map((s) => s.id));
    const newPexIds = new Set(flat.exercises.map((e) => e.id));
    const targetKey = (t: Any) => t.program_exercise_id + "::" + t.model_id;
    const newTargetKeys = new Set(flat.targets.map(targetKey));

    // 1. Deletes (cibles → exos → séances) — local cascade + sync de tête seulement
    for (const t of oldTargets) {
      if (!newTargetKeys.has(targetKey(t))) {
        await tx.runAsync("DELETE FROM program_model_targets WHERE program_exercise_id = ? AND model_id = ?", [t.program_exercise_id, t.model_id]);
        // Ne pousse le delete que si le parent survit (sinon le cascade serveur s'en charge)
        if (newPexIds.has(t.program_exercise_id)) {
          await enqueue(tx as any, "program_model_targets", "delete", { program_exercise_id: t.program_exercise_id, model_id: t.model_id }, null);
        }
      }
    }
    for (const e of oldPexs) {
      if (!newPexIds.has(e.id)) {
        await tx.runAsync("DELETE FROM program_model_targets WHERE program_exercise_id = ?", [e.id]);
        await tx.runAsync("DELETE FROM program_exercises WHERE id = ?", [e.id]);
        if (newSessionIds.has(e.session_id)) {
          await enqueue(tx as any, "program_exercises", "delete", { id: e.id }, null);
        }
      }
    }
    for (const s of oldSessions) {
      if (!newSessionIds.has(s.id)) {
        await tx.runAsync("DELETE FROM program_sessions WHERE id = ?", [s.id]);
        await enqueue(tx as any, "program_sessions", "delete", { id: s.id }, null);
      }
    }

    // 2. Upserts — uniquement les lignes nouvelles ou modifiées
    const changed = (oldRow: Any | undefined, newRow: Any) => !oldRow || Object.keys(newRow).some((k) => String(oldRow[k] ?? "") !== String(newRow[k] ?? ""));

    if (changed(oldProgram ?? undefined, flat.program)) {
      await tx.runAsync(
        "INSERT OR REPLACE INTO programs (id, owner_id, name, level, frequency, muscle_status, priorities, sub_group_split, volume_targets, auto) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [flat.program.id, flat.program.owner_id, flat.program.name, flat.program.level, flat.program.frequency, flat.program.muscle_status, flat.program.priorities, flat.program.sub_group_split, flat.program.volume_targets, flat.program.auto]
      );
      await enqueue(tx as any, "programs", "upsert", { id: prog.id }, {
        ...flat.program,
        muscle_status: JSON.parse(flat.program.muscle_status),
        priorities: JSON.parse(flat.program.priorities),
        sub_group_split: JSON.parse(flat.program.sub_group_split),
        volume_targets: JSON.parse(flat.program.volume_targets),
        auto: !!flat.program.auto,
      });
    }

    const oldSessById = Object.fromEntries(oldSessions.map((s) => [s.id, s]));
    for (const s of flat.sessions) {
      if (changed(oldSessById[s.id], s)) {
        await tx.runAsync("INSERT OR REPLACE INTO program_sessions (id, program_id, name, position) VALUES (?,?,?,?)", [s.id, s.program_id, s.name, s.position]);
        await enqueue(tx as any, "program_sessions", "upsert", { id: s.id }, s);
      }
    }
    const oldPexById = Object.fromEntries(oldPexs.map((e) => [e.id, e]));
    for (const e of flat.exercises) {
      if (changed(oldPexById[e.id], e)) {
        await tx.runAsync(
          "INSERT OR REPLACE INTO program_exercises (id, session_id, position, sets, muscle_group, is_compound, choices, history) VALUES (?,?,?,?,?,?,?,?)",
          [e.id, e.session_id, e.position, e.sets, e.muscle_group, e.is_compound, e.choices, e.history]
        );
        await enqueue(tx as any, "program_exercises", "upsert", { id: e.id }, {
          ...e,
          is_compound: !!e.is_compound,
          choices: JSON.parse(e.choices),
          history: JSON.parse(e.history),
        });
      }
    }
    const oldTargetByKey = Object.fromEntries(oldTargets.map((t) => [targetKey(t), t]));
    for (const t of flat.targets) {
      if (changed(oldTargetByKey[targetKey(t)], t)) {
        await tx.runAsync("INSERT OR REPLACE INTO program_model_targets (program_exercise_id, model_id, weight) VALUES (?,?,?)", [t.program_exercise_id, t.model_id, t.weight]);
        await enqueue(tx as any, "program_model_targets", "upsert", { program_exercise_id: t.program_exercise_id, model_id: t.model_id }, t);
      }
    }
  });
}

export async function createProgram(userId: string, name: string): Promise<Any> {
  const prog = { id: uid(), name, sessions: [], volumeTargets: { program: {}, sessions: {} }, auto: false };
  await replaceProgram(userId, prog);
  return prog;
}

export async function deleteProgram(programId: string): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const sessions = await tx.getAllAsync<Any>("SELECT id FROM program_sessions WHERE program_id = ?", [programId]);
    for (const s of sessions) {
      const pexs = await tx.getAllAsync<Any>("SELECT id FROM program_exercises WHERE session_id = ?", [s.id]);
      for (const e of pexs) {
        await tx.runAsync("DELETE FROM program_model_targets WHERE program_exercise_id = ?", [e.id]);
      }
      await tx.runAsync("DELETE FROM program_exercises WHERE session_id = ?", [s.id]);
    }
    await tx.runAsync("DELETE FROM program_sessions WHERE program_id = ?", [programId]);
    await tx.runAsync("DELETE FROM programs WHERE id = ?", [programId]);
    // Cascade serveur : un seul delete de tête
    await enqueue(tx as any, "programs", "delete", { id: programId }, null);
  });
}

/* ------------------------------------------------------------------ */
/* CRUD groupes / sous-groupes musculaires (port ParamsMuscleGroups)   */
/* Contrainte v2 : les exos seed sont globaux (non modifiables par     */
/* RLS) — rename/delete de groupe refusés s'il contient des seeds.     */
/* ------------------------------------------------------------------ */

export async function addMuscleGroup(userId: string, name: string): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<Any>("SELECT MAX(position) AS p FROM muscle_groups");
    const position = (row?.p ?? -1) + 1;
    await tx.runAsync("INSERT OR REPLACE INTO muscle_groups (owner_id, name, position) VALUES (?,?,?)", [userId, name, position]);
    await enqueue(tx as any, "muscle_groups", "upsert", { owner_id: userId, name }, { owner_id: userId, name, position });
  });
}

/** Renvoie le nombre d'exos seed dans un groupe (0 = rename/delete permis). */
export async function seedCountInGroup(group: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM exercises WHERE muscle_group = ? AND is_seed = 1", [group]);
  return row?.n ?? 0;
}

export async function renameMuscleGroup(userId: string, oldName: string, newName: string): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const old = await tx.getFirstAsync<Any>("SELECT * FROM muscle_groups WHERE name = ?", [oldName]);
    const position = old?.position ?? 0;
    // PK = (owner_id, name) → rename = delete + insert, même position
    await tx.runAsync("DELETE FROM muscle_groups WHERE owner_id = ? AND name = ?", [userId, oldName]);
    await enqueue(tx as any, "muscle_groups", "delete", { owner_id: userId, name: oldName }, null);
    await tx.runAsync("INSERT OR REPLACE INTO muscle_groups (owner_id, name, position) VALUES (?,?,?)", [userId, newName, position]);
    await enqueue(tx as any, "muscle_groups", "upsert", { owner_id: userId, name: newName }, { owner_id: userId, name: newName, position });
    // Sous-groupes : déplacés vers le nouveau nom
    const subs = await tx.getAllAsync<Any>("SELECT * FROM sub_groups WHERE muscle_group = ? AND owner_id = ?", [oldName, userId]);
    for (const sg of subs) {
      await tx.runAsync("DELETE FROM sub_groups WHERE owner_id = ? AND muscle_group = ? AND name = ?", [userId, oldName, sg.name]);
      await enqueue(tx as any, "sub_groups", "delete", { owner_id: userId, muscle_group: oldName, name: sg.name }, null);
      await tx.runAsync("INSERT OR REPLACE INTO sub_groups (owner_id, muscle_group, name, position) VALUES (?,?,?,?)", [userId, newName, sg.name, sg.position]);
      await enqueue(tx as any, "sub_groups", "upsert", { owner_id: userId, muscle_group: newName, name: sg.name }, { owner_id: userId, muscle_group: newName, name: sg.name, position: sg.position });
    }
    // Exos persos du groupe (les seeds sont bloqués en amont par seedCountInGroup)
    const exos = await tx.getAllAsync<Any>("SELECT id FROM exercises WHERE muscle_group = ? AND is_seed = 0", [oldName]);
    for (const e of exos) {
      await tx.runAsync("UPDATE exercises SET muscle_group = ? WHERE id = ?", [newName, e.id]);
      await enqueue(tx as any, "exercises", "update", { id: e.id }, { muscle_group: newName });
    }
  });
}

export async function deleteMuscleGroup(userId: string, name: string): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("DELETE FROM muscle_groups WHERE owner_id = ? AND name = ?", [userId, name]);
    await enqueue(tx as any, "muscle_groups", "delete", { owner_id: userId, name }, null);
    // Exos persos du groupe → "Autre" (v40) ; crée "Autre" si absent
    const exos = await tx.getAllAsync<Any>("SELECT id FROM exercises WHERE muscle_group = ? AND is_seed = 0", [name]);
    if (exos.length > 0) {
      const autre = await tx.getFirstAsync<Any>("SELECT name FROM muscle_groups WHERE name = 'Autre'");
      if (!autre) {
        const row = await tx.getFirstAsync<Any>("SELECT MAX(position) AS p FROM muscle_groups");
        const position = (row?.p ?? -1) + 1;
        await tx.runAsync("INSERT OR REPLACE INTO muscle_groups (owner_id, name, position) VALUES (?,?,?)", [userId, "Autre", position]);
        await enqueue(tx as any, "muscle_groups", "upsert", { owner_id: userId, name: "Autre" }, { owner_id: userId, name: "Autre", position });
      }
      for (const e of exos) {
        await tx.runAsync("UPDATE exercises SET muscle_group = 'Autre' WHERE id = ?", [e.id]);
        await enqueue(tx as any, "exercises", "update", { id: e.id }, { muscle_group: "Autre" });
      }
    }
    // Sous-groupes du groupe supprimés
    const subs = await tx.getAllAsync<Any>("SELECT name FROM sub_groups WHERE muscle_group = ? AND owner_id = ?", [name, userId]);
    for (const sg of subs) {
      await tx.runAsync("DELETE FROM sub_groups WHERE owner_id = ? AND muscle_group = ? AND name = ?", [userId, name, sg.name]);
      await enqueue(tx as any, "sub_groups", "delete", { owner_id: userId, muscle_group: name, name: sg.name }, null);
    }
  });
}

export async function addSubGroup(userId: string, group: string, name: string): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<Any>("SELECT MAX(position) AS p FROM sub_groups WHERE muscle_group = ?", [group]);
    const position = (row?.p ?? -1) + 1;
    await tx.runAsync("INSERT OR REPLACE INTO sub_groups (owner_id, muscle_group, name, position) VALUES (?,?,?,?)", [userId, group, name, position]);
    await enqueue(tx as any, "sub_groups", "upsert", { owner_id: userId, muscle_group: group, name }, { owner_id: userId, muscle_group: group, name, position });
  });
}

export async function renameSubGroup(userId: string, group: string, oldName: string, newName: string): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const old = await tx.getFirstAsync<Any>("SELECT * FROM sub_groups WHERE muscle_group = ? AND name = ?", [group, oldName]);
    const position = old?.position ?? 0;
    await tx.runAsync("DELETE FROM sub_groups WHERE owner_id = ? AND muscle_group = ? AND name = ?", [userId, group, oldName]);
    await enqueue(tx as any, "sub_groups", "delete", { owner_id: userId, muscle_group: group, name: oldName }, null);
    await tx.runAsync("INSERT OR REPLACE INTO sub_groups (owner_id, muscle_group, name, position) VALUES (?,?,?,?)", [userId, group, newName, position]);
    await enqueue(tx as any, "sub_groups", "upsert", { owner_id: userId, muscle_group: group, name: newName }, { owner_id: userId, muscle_group: group, name: newName, position });
    // Exos persos de ce sous-groupe
    const exos = await tx.getAllAsync<Any>("SELECT id FROM exercises WHERE muscle_group = ? AND sub_group = ? AND is_seed = 0", [group, oldName]);
    for (const e of exos) {
      await tx.runAsync("UPDATE exercises SET sub_group = ? WHERE id = ?", [newName, e.id]);
      await enqueue(tx as any, "exercises", "update", { id: e.id }, { sub_group: newName });
    }
  });
}

export async function deleteSubGroup(userId: string, group: string, name: string): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("DELETE FROM sub_groups WHERE owner_id = ? AND muscle_group = ? AND name = ?", [userId, group, name]);
    await enqueue(tx as any, "sub_groups", "delete", { owner_id: userId, muscle_group: group, name }, null);
    // Déclasse les exos persos de ce sous-groupe
    const exos = await tx.getAllAsync<Any>("SELECT id FROM exercises WHERE muscle_group = ? AND sub_group = ? AND is_seed = 0", [group, name]);
    for (const e of exos) {
      await tx.runAsync("UPDATE exercises SET sub_group = NULL WHERE id = ?", [e.id]);
      await enqueue(tx as any, "exercises", "update", { id: e.id }, { sub_group: null });
    }
  });
}
