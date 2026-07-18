// Contexte social léger : demandes reçues (badge Notifs), compteurs, refresh.
// Rafraîchi au montage, au retour au premier plan et après chaque action.
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { AppState } from "react-native";
import * as social from "../db/social";
import * as notifs from "./notifs";
import type { AppNotification } from "./notifs";
import type { Any } from "../core/mylift";

type SocialState = {
  incoming: Any[];
  outgoing: Any[];
  friendCount: number;
  activity: AppNotification[];
  unreadActivity: number;
  markActivityRead: () => Promise<void>;
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
  const [activity, setActivity] = useState<AppNotification[]>([]);
  const [unreadActivity, setUnreadActivity] = useState(0);

  const refreshSocial = useCallback(async () => {
    if (!userId) return;
    try {
      await social.ensureReciprocity(userId);
      const [inc, out, cnt, act, readAt] = await Promise.all([
        social.fetchIncomingPending(userId),
        social.fetchOutgoingPending(userId),
        social.fetchFriendCount(userId),
        notifs.fetchActivity(userId),
        notifs.getReadAt(userId),
      ]);
      setIncoming(inc);
      setOutgoing(out);
      setFriendCount(cnt);
      setActivity(act);
      setUnreadActivity(notifs.countUnread(act, readAt));
    } catch {
      // hors ligne : on garde le dernier état connu
    }
  }, [userId]);

  const markActivityRead = useCallback(async () => {
    if (!userId) return;
    await notifs.markAllRead(userId);
    setUnreadActivity(0);
  }, [userId]);

  useEffect(() => {
    refreshSocial();
    // Push distant (build natif uniquement — inerte en Expo Go)
    if (userId) notifs.registerForPushIfBuilt(userId);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refreshSocial();
    });
    return () => sub.remove();
  }, [refreshSocial, userId]);

  return <Ctx.Provider value={{ incoming, outgoing, friendCount, activity, unreadActivity, markActivityRead, refreshSocial }}>{children}</Ctx.Provider>;
}
