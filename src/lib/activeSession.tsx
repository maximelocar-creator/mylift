// Séance en cours — équivalent du LS 'active_session' de v40, persistée dans
// AsyncStorage pour survivre au kill de l'app. Locale au device (jamais
// synchronisée sur Supabase — décision verrouillée : la séance live est un
// brouillon ; seul le log final validé part sur le serveur).
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hydrateSessionExos, todayIso, type Any } from "../core/mylift";
import { uid } from "../db/repo";

// Clé PAR COMPTE : une séance en cours ne doit jamais suivre un changement
// d'utilisateur sur le même téléphone (bug vécu : la séance de maxlocar
// restait active sur le compte de test).
const keyFor = (userId: string) => "mylift_active_session:" + userId;

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

export function ActiveSessionProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [activeSession, setActiveSessionState] = useState<Any | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Changement de compte (ou logout) : purge l'état en mémoire puis charge
    // la séance du compte courant uniquement
    setActiveSessionState(null);
    setLoaded(false);
    if (!userId) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(keyFor(userId))
      .then((v) => {
        if (v && !cancelled) setActiveSessionState(JSON.parse(v));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setActiveSession = (s: Any | null) => {
    setActiveSessionState(s);
    if (!userId) return;
    if (s) AsyncStorage.setItem(keyFor(userId), JSON.stringify(s)).catch(() => {});
    else AsyncStorage.removeItem(keyFor(userId)).catch(() => {});
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
