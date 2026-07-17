// Séance en cours — équivalent du LS 'active_session' de v40, persistée dans
// AsyncStorage pour survivre au kill de l'app. Locale au device (jamais
// synchronisée sur Supabase — décision verrouillée : la séance live est un
// brouillon ; seul le log final validé part sur le serveur).
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hydrateSessionExos, todayIso, type Any } from "../core/mylift";
import { uid } from "../db/repo";

const KEY = "mylift_active_session";

type ActiveSessionCtx = {
  activeSession: Any | null;
  setActiveSession: (s: Any | null) => void;
  loaded: boolean;
};

const Ctx = createContext<ActiveSessionCtx | null>(null);

export function useActiveSession(): ActiveSessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useActiveSession hors ActiveSessionProvider");
  return v;
}

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSessionState] = useState<Any | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v) setActiveSessionState(JSON.parse(v));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setActiveSession = (s: Any | null) => {
    setActiveSessionState(s);
    if (s) AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
    else AsyncStorage.removeItem(KEY).catch(() => {});
  };

  return <Ctx.Provider value={{ activeSession, setActiveSession, loaded }}>{children}</Ctx.Provider>;
}

/**
 * Port fidèle de startSession (v40) : hydrate les exos du programme, préremplit
 * les séries (cible de poids + 10 reps + RIR 1) et pose la séance active.
 */
export function buildLiveSession(progSession: Any, program: Any | null, lib: Any[], journalLogs: Any[], sessionNote: string | null): Any {
  const hydratedExos = hydrateSessionExos(progSession, lib, journalLogs);
  return {
    id: uid(),
    sessionId: progSession.id,
    programId: program?.id || null,
    sessionName: progSession.name,
    programName: program?.name || "Séance libre",
    date: todayIso(),
    startedAt: Date.now(),
    sessionNote,
    exercises: hydratedExos.map((ex: Any) => {
      const libEx = ex.exId ? lib.find((l) => l.id === ex.exId) : null;
      // Préremplissage : cible de poids du programme + 10 reps par défaut
      const prefillWeight = ex.targetWeight ? String(ex.targetWeight) : "";
      const prefillReps = "10";
      const prefillRir = "1";
      return {
        ...ex,
        id: uid(),
        sets: Array.from({ length: ex.targetSets || 3 }, () => ({
          weight: prefillWeight,
          reps: prefillReps,
          rir: prefillRir,
          _confirmed: false,
        })),
        activeVariant: 0,
        isCompound: libEx?.compound || false,
      };
    }),
    currentExoIdx: 0,
  };
}
