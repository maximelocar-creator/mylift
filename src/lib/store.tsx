// Store global de données : charge tout depuis SQLite (offline-first), expose
// les mutations (qui écrivent local + queue de sync) et rafraîchit l'état.
// La sync Supabase tourne en arrière-plan : au démarrage, au retour au premier
// plan, et après chaque écriture.
import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { AppState } from "react-native";
import * as repo from "../db/repo";
import { syncNow, flushSyncQueue, pendingSyncCount } from "../db/sync";
import type { Any } from "../core/mylift";

type DataState = {
  ready: boolean;
  userId: string | null;
  profile: Any | null;
  journalLogs: Any[];
  exerciseLib: Any[];
  programs: Any[];
  weights: Any[];
  muscleGroups: string[];
  subGroups: Record<string, string[]>;
  sessionNotes: Record<string, string>;
  pendingSync: number;
  syncing: boolean;
  reload: () => Promise<void>;
  saveLog: (log: Any) => Promise<void>;
  deleteLog: (logId: string) => Promise<void>;
  addWeight: (entry: { date: string; weight: number; note?: string | null }) => Promise<void>;
  deleteWeight: (id: string) => Promise<void>;
  setCurrentProgram: (programId: string | null) => Promise<void>;
  addExercise: (exo: { name: string; muscleGroup: string; subGroup?: string | null; compound?: boolean }) => Promise<Any>;
  addExerciseModel: (exerciseId: string, model: { name: string; setting?: string | null }) => Promise<Any>;
  setSessionNote: (sessionKey: string, note: string | null) => Promise<void>;
  updateProgramTarget: (pexId: string, opts: { targetModelId?: string | null; exId?: string | null; newWeight: number }) => Promise<void>;
};

const Ctx = createContext<DataState | null>(null);

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData hors DataProvider");
  return v;
}

export function DataProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Any | null>(null);
  const [journalLogs, setJournalLogs] = useState<Any[]>([]);
  const [exerciseLib, setExerciseLib] = useState<Any[]>([]);
  const [programs, setPrograms] = useState<Any[]>([]);
  const [weights, setWeights] = useState<Any[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [subGroups, setSubGroups] = useState<Record<string, string[]>>({});
  const [sessionNotes, setSessionNotes] = useState<Record<string, string>>({});
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const mounted = useRef(true);

  const loadFromLocal = useCallback(async () => {
    const [p, logs, lib, progs, w, mg, sg, notes, pend] = await Promise.all([
      repo.getProfile(),
      repo.getJournalLogs(),
      repo.getExerciseLib(),
      repo.getPrograms(),
      repo.getWeights(),
      repo.getMuscleGroups(),
      repo.getSubGroups(),
      repo.getSessionNotes(),
      pendingSyncCount(),
    ]);
    if (!mounted.current) return;
    setProfile(p);
    setJournalLogs(logs);
    setExerciseLib(lib);
    setPrograms(progs);
    setWeights(w);
    setMuscleGroups(mg);
    setSubGroups(sg);
    setSessionNotes(notes);
    setPendingSync(pend);
  }, []);

  const reload = useCallback(async () => {
    await loadFromLocal();
  }, [loadFromLocal]);

  const backgroundSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { pulled } = await syncNow();
      if (pulled) await loadFromLocal();
      else setPendingSync(await pendingSyncCount());
    } finally {
      if (mounted.current) setSyncing(false);
    }
  }, [loadFromLocal]);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      // 1. Affiche immédiatement les données locales (offline-first)
      await loadFromLocal();
      setReady(true);
      // 2. Sync serveur en arrière-plan, puis re-render si pull effectué
      backgroundSync();
    })();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") backgroundSync();
    });
    return () => {
      mounted.current = false;
      sub.remove();
    };
  }, [userId]);

  const afterWrite = useCallback(async () => {
    await loadFromLocal();
    // Push en arrière-plan sans bloquer l'UI
    setSyncing(true);
    flushSyncQueue()
      .then(({ pending }) => mounted.current && setPendingSync(pending))
      .catch(() => {})
      .finally(() => mounted.current && setSyncing(false));
  }, [loadFromLocal]);

  const value: DataState = {
    ready,
    userId,
    profile,
    journalLogs,
    exerciseLib,
    programs,
    weights,
    muscleGroups,
    subGroups,
    sessionNotes,
    pendingSync,
    syncing,
    reload,
    saveLog: async (log) => {
      await repo.saveWorkoutLog(userId, log);
      await afterWrite();
    },
    deleteLog: async (logId) => {
      await repo.deleteWorkoutLog(logId);
      await afterWrite();
    },
    addWeight: async (entry) => {
      await repo.addWeight(userId, entry);
      await afterWrite();
    },
    deleteWeight: async (id) => {
      await repo.deleteWeight(id);
      await afterWrite();
    },
    setCurrentProgram: async (programId) => {
      await repo.setCurrentProgram(userId, programId);
      await afterWrite();
    },
    addExercise: async (exo) => {
      const created = await repo.addExercise(userId, exo);
      await afterWrite();
      return created;
    },
    addExerciseModel: async (exerciseId, model) => {
      const created = await repo.addExerciseModel(userId, exerciseId, model);
      await afterWrite();
      return created;
    },
    setSessionNote: async (sessionKey, note) => {
      await repo.setSessionNote(userId, sessionKey, note);
      await afterWrite();
    },
    updateProgramTarget: async (pexId, opts) => {
      await repo.updateProgramExerciseTarget(pexId, opts);
      await afterWrite();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
