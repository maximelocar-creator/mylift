// Synchronisation SQLite ↔ Supabase.
// Push : vide la sync_queue dans l'ordre (les écritures locales priment).
// Pull : hydrate SQLite depuis le serveur — UNIQUEMENT quand la queue est vide,
// pour ne jamais écraser une donnée locale pas encore poussée.
import { supabase } from "../lib/supabase";
import { getDb, setMeta } from "./local";
import type { Any } from "../core/mylift";

const PAGE = 1000;

/* ------------------------------------------------------------------ */
/* PUSH — vidage de la queue                                           */
/* ------------------------------------------------------------------ */
let flushing = false;

export async function flushSyncQueue(): Promise<{ pushed: number; pending: number; error: string | null }> {
  if (flushing) return { pushed: 0, pending: -1, error: null };
  flushing = true;
  let pushed = 0;
  let error: string | null = null;
  try {
    const db = await getDb();
    // Boucle jusqu'à queue vide ou première erreur (l'ordre doit être préservé)
    for (;;) {
      const item = await db.getFirstAsync<Any>("SELECT * FROM sync_queue ORDER BY seq LIMIT 1");
      if (!item) break;
      const pk = JSON.parse(item.pk);
      const payload = item.payload ? JSON.parse(item.payload) : null;
      let err: { message: string } | null = null;
      try {
        if (item.op === "insert") {
          // Tables immuables (logs) : ON CONFLICT DO NOTHING, jamais d'UPDATE
          ({ error: err } = await supabase.from(item.table_name).upsert(payload, { ignoreDuplicates: true }));
        } else if (item.op === "upsert") {
          ({ error: err } = await supabase.from(item.table_name).upsert(payload));
        } else if (item.op === "update") {
          ({ error: err } = await supabase.from(item.table_name).update(payload).match(pk));
        } else if (item.op === "delete") {
          ({ error: err } = await supabase.from(item.table_name).delete().match(pk));
        }
      } catch (e: any) {
        err = { message: e?.message ?? String(e) };
      }
      if (err) {
        await db.runAsync("UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE seq = ?", [err.message, item.seq]);
        error = `${item.table_name}: ${err.message}`;
        break;
      }
      await db.runAsync("DELETE FROM sync_queue WHERE seq = ?", [item.seq]);
      pushed++;
    }
    const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM sync_queue");
    return { pushed, pending: row?.n ?? 0, error };
  } finally {
    flushing = false;
  }
}

export async function pendingSyncCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM sync_queue");
  return row?.n ?? 0;
}

/* ------------------------------------------------------------------ */
/* PULL — hydratation depuis Supabase                                   */
/* ------------------------------------------------------------------ */
async function fetchAll(table: string, eq?: [string, string]): Promise<Any[]> {
  const rows: Any[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select("*").range(from, from + PAGE - 1);
    if (eq) q = q.eq(eq[0], eq[1]);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function insertSql(table: string, cols: string[]) {
  return `INSERT OR REPLACE INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
}

/**
 * Pull complet : remplace le contenu local par l'état serveur.
 * Refusé si la queue n'est pas vide (données locales pas encore poussées).
 * Retourne true si le pull a eu lieu.
 */
export async function pullAll(): Promise<boolean> {
  const pending = await pendingSyncCount();
  if (pending > 0) return false;

  // Tables et colonnes miroir (mêmes noms que Supabase)
  const TABLES: Record<string, string[]> = {
    exercises: ["id", "name", "muscle_group", "sub_group", "compound", "priority", "is_seed", "owner_id"],
    exercise_models: ["id", "exercise_id", "owner_id", "name", "setting", "color"],
    programs: ["id", "owner_id", "name", "level", "frequency", "muscle_status", "priorities", "sub_group_split", "volume_targets", "auto"],
    program_sessions: ["id", "program_id", "name", "position"],
    program_exercises: ["id", "session_id", "position", "sets", "muscle_group", "is_compound", "choices", "history"],
    program_model_targets: ["program_exercise_id", "model_id", "weight"],
    workout_logs: ["id", "owner_id", "session_id", "program_id", "session_name", "program_name", "date", "duration_sec"],
    log_exercises: ["id", "log_id", "ex_id", "ex_name", "muscle_group", "model_id", "position"],
    log_sets: ["id", "log_exercise_id", "weight", "reps", "rir", "position"],
    workout_prs: ["id", "log_id", "type", "ex_name", "ex_id", "model_id", "weight", "reps"],
    weights: ["id", "owner_id", "date", "weight", "note", "imported_from"],
    muscle_groups: ["owner_id", "name", "position"],
    sub_groups: ["owner_id", "muscle_group", "name", "position"],
    session_notes: ["owner_id", "session_id", "note"],
    profiles: ["id", "username", "current_program_id"],
  };
  const JSON_COLS = new Set(["muscle_status", "priorities", "sub_group_split", "volume_targets", "choices", "history"]);

  // Fetch d'abord tout (hors transaction), puis remplacement atomique.
  // profiles est lisible publiquement (découverte) : sans filtre, le miroir
  // local embarquerait les profils des autres et getProfile() pourrait
  // renvoyer quelqu'un d'autre — on ne rapatrie QUE sa propre ligne.
  const uid = (await supabase.auth.getSession()).data.session?.user.id;
  const fetched: Record<string, Any[]> = {};
  for (const table of Object.keys(TABLES)) {
    fetched[table] = await fetchAll(table, table === "profiles" && uid ? ["id", uid] : undefined);
  }

  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const [table, cols] of Object.entries(TABLES)) {
      await tx.runAsync(`DELETE FROM ${table}`);
      const sql = insertSql(table, cols);
      for (const row of fetched[table]) {
        const vals = cols.map((c) => {
          const v = row[c];
          if (v === undefined || v === null) return null;
          if (typeof v === "boolean") return v ? 1 : 0;
          if (JSON_COLS.has(c) && typeof v === "object") return JSON.stringify(v);
          return v;
        });
        await tx.runAsync(sql, vals);
      }
    }
  });
  await setMeta("last_pull", String(Date.now()));
  return true;
}

/** Séquence standard au démarrage : push du reliquat puis pull si possible. */
export async function syncNow(): Promise<{ pulled: boolean; pending: number }> {
  try {
    await flushSyncQueue();
  } catch {
    // offline : on reste sur les données locales
  }
  let pulled = false;
  try {
    pulled = await pullAll();
  } catch {
    // offline : pas grave, SQLite fait foi
  }
  return { pulled, pending: await pendingSyncCount() };
}
