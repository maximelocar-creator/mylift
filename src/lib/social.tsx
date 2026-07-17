// Contexte social léger : demandes reçues (badge Notifs), compteurs, refresh.
// Rafraîchi au montage, au retour au premier plan et après chaque action.
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { AppState } from "react-native";
import * as social from "../db/social";
import type { Any } from "../core/mylift";

type SocialState = {
  incoming: Any[];
  outgoing: Any[];
  friendCount: number;
  refreshSocial: () => Promise<void>;
};

const Ctx = createContext<SocialState | null>(null);

export function useSocial(): SocialState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSocial hors SocialProvider");
  return v;
}

export function SocialProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [incoming, setIncoming] = useState<Any[]>([]);
  const [outgoing, setOutgoing] = useState<Any[]>([]);
  const [friendCount, setFriendCount] = useState(0);

  const refreshSocial = useCallback(async () => {
    if (!userId) return;
    try {
      await social.ensureReciprocity(userId);
      const [inc, out, cnt] = await Promise.all([
        social.fetchIncomingPending(userId),
        social.fetchOutgoingPending(userId),
        social.fetchFriendCount(userId),
      ]);
      setIncoming(inc);
      setOutgoing(out);
      setFriendCount(cnt);
    } catch {
      // hors ligne : on garde le dernier état connu
    }
  }, [userId]);

  useEffect(() => {
    refreshSocial();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refreshSocial();
    });
    return () => sub.remove();
  }, [refreshSocial]);

  return <Ctx.Provider value={{ incoming, outgoing, friendCount, refreshSocial }}>{children}</Ctx.Provider>;
}
