// Base SQLite locale — miroir du schéma Supabase (voir importBackup.ts pour la
// correspondance exacte des colonnes). Offline-first : toutes les lectures des
// écrans se font ici ; les écritures passent ici D'ABORD puis sont poussées vers
// Supabase via la queue de sync (sync.ts). Une séance ne se perd jamais hors ligne.
import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  muscle_group TEXT,
  sub_group TEXT,
  compound INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 5,
  is_seed INTEGER DEFAULT 0,
  owner_id TEXT
);

CREATE TABLE IF NOT EXISTS exercise_models (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL,
  owner_id TEXT,
  name TEXT NOT NULL,
  setting TEXT,
  color TEXT
);

CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  name TEXT NOT NULL,
  level TEXT,
  frequency INTEGER,
  muscle_status TEXT DEFAULT '{}',   -- JSON
  priorities TEXT DEFAULT '[]',      -- JSON
  sub_group_split TEXT DEFAULT '{}', -- JSON
  volume_targets TEXT DEFAULT '{}',  -- JSON
  auto INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS program_sessions (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS program_exercises (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  sets INTEGER DEFAULT 3,
  muscle_group TEXT,
  is_compound INTEGER DEFAULT 0,
  choices TEXT DEFAULT '[]',  -- JSON
  history TEXT DEFAULT '[]'   -- JSON
);

CREATE TABLE IF NOT EXISTS program_model_targets (
  program_exercise_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  weight REAL,
  PRIMARY KEY (program_exercise_id, model_id)
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  session_id TEXT,
  program_id TEXT,
  session_name TEXT,
  program_name TEXT,
  date TEXT NOT NULL,
  duration_sec INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_workout_logs_date ON workout_logs(date);

CREATE TABLE IF NOT EXISTS log_exercises (
  id TEXT PRIMARY KEY,
  log_id TEXT NOT NULL,
  ex_id TEXT,
  ex_name TEXT NOT NULL DEFAULT '',
  muscle_group TEXT,
  model_id TEXT,
  position INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_log_exercises_log ON log_exercises(log_id);

CREATE TABLE IF NOT EXISTS log_sets (
  id TEXT PRIMARY KEY,
  log_exercise_id TEXT NOT NULL,
  weight REAL,
  reps INTEGER,
  rir INTEGER,
  position INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_log_sets_exercise ON log_sets(log_exercise_id);

CREATE TABLE IF NOT EXISTS workout_prs (
  id TEXT PRIMARY KEY,
  log_id TEXT NOT NULL,
  type TEXT,
  ex_name TEXT,
  ex_id TEXT,
  model_id TEXT,
  weight REAL,
  reps INTEGER
);
CREATE INDEX IF NOT EXISTS idx_workout_prs_log ON workout_prs(log_id);

CREATE TABLE IF NOT EXISTS weights (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  date TEXT NOT NULL,
  weight REAL NOT NULL,
  note TEXT,
  imported_from TEXT
);
CREATE INDEX IF NOT EXISTS idx_weights_date ON weights(date);

CREATE TABLE IF NOT EXISTS muscle_groups (
  owner_id TEXT,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  PRIMARY KEY (owner_id, name)
);

CREATE TABLE IF NOT EXISTS sub_groups (
  owner_id TEXT,
  muscle_group TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  PRIMARY KEY (owner_id, muscle_group, name)
);

CREATE TABLE IF NOT EXISTS session_notes (
  owner_id TEXT,
  session_id TEXT NOT NULL,
  note TEXT NOT NULL,
  PRIMARY KEY (owner_id, session_id)
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT,
  current_program_id TEXT
);

-- Queue de synchronisation vers Supabase. Chaque écriture locale enfile une
-- opération ici, dans la MÊME transaction : rien ne peut se perdre hors ligne.
CREATE TABLE IF NOT EXISTS sync_queue (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  op TEXT NOT NULL,          -- 'insert' (immuable, ON CONFLICT DO NOTHING) | 'upsert' | 'update' | 'delete'
  pk TEXT NOT NULL,          -- JSON du/des champs clé primaire
  payload TEXT,              -- JSON des colonnes (null pour delete)
  created_at INTEGER NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("mylift.db");
      await db.execAsync(SCHEMA);
      return db;
    })();
  }
  return dbPromise;
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [key, value]);
}
