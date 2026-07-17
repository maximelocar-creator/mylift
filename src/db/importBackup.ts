// Import du backup v40 vers Supabase.
// Portage fidèle de tools/test_import_parity.py (spécification validée, 21 contrôles verts).
// Règles verrouillées : IDs conservés tels quels · 'fasted' abandonné ·
// preferences non importées · exos seed-* mappés sur les canoniques globaux.
import { supabase } from "../lib/supabase";

type Any = Record<string, any>;

const CHUNK = 200;

async function insertRows(table: string, rows: Any[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    // ignoreDuplicates => ON CONFLICT DO NOTHING : import relançable sans erreur,
    // et surtout AUCUN UPDATE émis (le trigger d'immuabilité des logs l'interdirait).
    const { error } = await supabase
      .from(table)
      .upsert(slice, { ignoreDuplicates: true });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export type ParityLine = { label: string; expected: number | string; actual: number | string; ok: boolean };
export type ImportResult = { lines: ParityLine[]; allOk: boolean };

async function countOf(table: string, filter?: (q: any) => any): Promise<number> {
  let q: any = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

export async function importBackup(backup: Any, userId: string, onStep?: (msg: string) => void): Promise<ImportResult> {
  const step = (m: string) => onStep?.(m);
  const lib: Any[] = backup.exerciseLib ?? [];
  const logs: Any[] = backup.journalLogs ?? [];
  const programs: Any[] = backup.programs ?? [];
  const weights: Any[] = backup.weights ?? [];

  // 1. Exos customs (les seed-* existent déjà côté serveur, IDs canoniques)
  step("Bibliothèque…");
  await insertRows(
    "exercises",
    lib
      .filter((e) => !String(e.id).startsWith("seed-"))
      .map((e) => ({
        id: e.id,
        name: e.name,
        muscle_group: e.muscleGroup,
        sub_group: e.subGroup ?? null,
        compound: !!e.compound,
        priority: e.priority ?? 5,
        is_seed: false,
        owner_id: userId,
      }))
  );

  // 2. Machines (perso, y compris celles attachées aux exos seed)
  step("Machines…");
  const modelRows: Any[] = [];
  for (const e of lib)
    for (const m of e.models ?? [])
      modelRows.push({
        id: m.id,
        exercise_id: e.id,
        owner_id: userId,
        name: m.name,
        setting: m.setting ?? null,
        color: m.color ?? null,
      });
  await insertRows("exercise_models", modelRows);

  // 3. Programmes
  step("Programmes…");
  await insertRows(
    "programs",
    programs.map((p) => ({
      id: p.id,
      owner_id: userId,
      name: p.name,
      level: p.level ?? null,
      frequency: p.frequency ?? null,
      muscle_status: p.muscleStatus ?? {},
      priorities: p.priorities ?? [],
      sub_group_split: p.subGroupSplit ?? {},
      volume_targets: p.volumeTargets ?? {},
      auto: !!p.auto,
    }))
  );
  const sessRows: Any[] = [], pexRows: Any[] = [], mtRows: Any[] = [];
  for (const p of programs)
    (p.sessions ?? []).forEach((s: Any, si: number) => {
      sessRows.push({ id: s.id, program_id: p.id, name: s.name, position: si });
      (s.exercises ?? []).forEach((ex: Any, ei: number) => {
        pexRows.push({
          id: ex.id,
          session_id: s.id,
          position: ei,
          sets: ex.sets ?? 3,
          muscle_group: ex.muscleGroup ?? null,
          is_compound: !!ex.isCompound,
          choices: ex.choices ?? [],
          history: ex.history ?? [],
        });
        for (const mt of ex.modelTargets ?? [])
          mtRows.push({ program_exercise_id: ex.id, model_id: mt.modelId, weight: mt.weight });
      });
    });
  await insertRows("program_sessions", sessRows);
  await insertRows("program_exercises", pexRows);
  await insertRows("program_model_targets", mtRows);

  // 4. Séances loggées (immuables — insert only)
  step("Séances…");
  await insertRows(
    "workout_logs",
    logs.map((l) => ({
      id: l.id,
      owner_id: userId,
      session_id: l.sessionId ?? null,
      program_id: l.programId ?? null,
      session_name: l.sessionName ?? null,
      program_name: l.programName ?? null,
      date: l.date,
      duration_sec: l.durationSec ?? 0,
    }))
  );
  const lexRows: Any[] = [], setRows: Any[] = [], prRows: Any[] = [];
  for (const l of logs) {
    (l.exercises ?? []).forEach((ex: Any, xi: number) => {
      lexRows.push({
        id: ex.id,
        log_id: l.id,
        ex_id: ex.exId ?? null,
        ex_name: ex.exName ?? "",
        muscle_group: ex.muscleGroup ?? null,
        model_id: ex.modelId ?? null,
        position: xi,
      });
      (ex.sets ?? []).forEach((s: Any, si: number) => {
        setRows.push({
          id: `${ex.id}-s${si}`,
          log_exercise_id: ex.id,
          weight: s.weight ?? null,
          reps: s.reps ?? null,
          rir: s.rir ?? null,
          position: si,
        });
      });
    });
    (l.prs ?? []).forEach((pr: Any, pi: number) => {
      prRows.push({
        id: `${l.id}-pr${pi}`,
        log_id: l.id,
        type: pr.type,
        ex_name: pr.exName,
        ex_id: pr.exId ?? null,
        model_id: pr.modelId ?? null,
        weight: pr.weight,
        reps: pr.reps,
      });
    });
  }
  await insertRows("log_exercises", lexRows);
  await insertRows("log_sets", setRows);
  await insertRows("workout_prs", prRows);

  // 5. Pesées — 'fasted' volontairement abandonné (décision 16/07/2026)
  step("Pesées…");
  await insertRows(
    "weights",
    weights.map((w) => ({
      id: w.id,
      owner_id: userId,
      date: w.date,
      weight: w.weight,
      note: w.note ?? null,
      imported_from: w.importedFrom ?? null,
    }))
  );

  // 6. Taxonomie, notes, programme courant
  step("Réglages…");
  await insertRows(
    "muscle_groups",
    (backup.muscleGroups ?? []).map((name: string, i: number) => ({ owner_id: userId, name, position: i }))
  );
  const sgRows: Any[] = [];
  Object.entries(backup.subGroups ?? {}).forEach(([mg, sgs]: [string, any]) =>
    (sgs as string[]).forEach((name, i) => sgRows.push({ owner_id: userId, muscle_group: mg, name, position: i }))
  );
  await insertRows("sub_groups", sgRows);
  await insertRows(
    "session_notes",
    Object.entries(backup.sessionNotes ?? {}).map(([sid, note]) => ({
      owner_id: userId,
      session_id: sid,
      note: String(note),
    }))
  );
  if (backup.currentProgramId) {
    const { error } = await supabase
      .from("profiles")
      .update({ current_program_id: backup.currentProgramId })
      .eq("id", userId);
    if (error) throw new Error(`profiles: ${error.message}`);
  }

  // 7. Contrôle de parité — recomptage complet après import
  step("Contrôle de parité…");
  const lines: ParityLine[] = [];
  const check = (label: string, expected: number | string, actual: number | string) =>
    lines.push({ label, expected, actual, ok: expected === actual });

  check("Exercices (biblio visible)", lib.length, await countOf("exercises"));
  check("Machines", modelRows.length, await countOf("exercise_models"));
  check("Programmes", programs.length, await countOf("programs"));
  check("Séances de programme", sessRows.length, await countOf("program_sessions"));
  check("Exos de programme", pexRows.length, await countOf("program_exercises"));
  check("Cibles par machine", mtRows.length, await countOf("program_model_targets"));
  check("Séances loggées", logs.length, await countOf("workout_logs"));
  check("Exos loggés", lexRows.length, await countOf("log_exercises"));
  check("Séries loggées", setRows.length, await countOf("log_sets"));
  check("PRs", prRows.length, await countOf("workout_prs"));
  check("Pesées", weights.length, await countOf("weights"));

  // Tonnage : contrôle croisé au kilo près
  const srcTonnage = Math.round(
    logs.reduce(
      (a, l) =>
        a +
        (l.exercises ?? []).reduce(
          (b: number, ex: Any) =>
            b + (ex.sets ?? []).reduce((c: number, s: Any) => c + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0),
          0
        ),
      0
    )
  );
  const { data: allSets, error: tErr } = await supabase.from("log_sets").select("weight,reps");
  if (tErr) throw new Error(tErr.message);
  const dbTonnage = Math.round(
    (allSets ?? []).reduce((a, s: Any) => a + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0)
  );
  check("Tonnage total (kg)", srcTonnage, dbTonnage);

  return { lines, allOk: lines.every((l) => l.ok) };
}
