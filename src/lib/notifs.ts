// Service notifications — POINT D'ENTRÉE UNIQUE (structure prête pour le push
// distant au premier build EAS, cf. registerForPushIfBuilt).
//
// CONTRAINTE RLS sondée en prod : la table notifications refuse TOUT insert
// client (même pour soi-même — policy insert fermée, prévue pour des triggers
// serveur). On ne l'affaiblit pas : les notifications in-app sont DÉRIVÉES à
// la lecture depuis l'état interrogeable (likes/commentaires sur MES posts,
// amitiés établies), ce qui donne le même résultat produit sans toucher aux
// policies. L'état lu/non-lu est local au device (AsyncStorage), cohérent avec
// la décision "préférences UI locales". Le futur push distant exigera des
// triggers serveur + build EAS (token APNs) — voir Phase 5.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import * as social from "../db/social";
import type { Any } from "../core/mylift";

export type AppNotification = {
  key: string; // stable : dédoublonnage + tri
  type: "like" | "comment" | "friend";
  actorId: string;
  profile: Any | null;
  postId?: string;
  postTitle?: string;
  text?: string;
  created_at: string;
};

const readKey = (me: string) => "mylift_notifs_read_at:" + me;

/** Activité me concernant, triée du plus récent au plus ancien (cap 50). */
export async function fetchActivity(me: string): Promise<AppNotification[]> {
  const { data: myPosts } = await supabase.from("posts").select("id,title").eq("owner_id", me).limit(100);
  const postIds = (myPosts ?? []).map((p: Any) => p.id);
  const titleOf: Record<string, string> = {};
  (myPosts ?? []).forEach((p: Any) => (titleOf[p.id] = p.title));

  const [likes, comments] = postIds.length
    ? await Promise.all([
        supabase.from("likes").select("post_id,user_id,created_at").in("post_id", postIds),
        supabase.from("comments").select("id,post_id,user_id,text,created_at").in("post_id", postIds),
      ])
    : [{ data: [] }, { data: [] }];

  const items: AppNotification[] = [];
  (likes.data ?? []).forEach((l: Any) => {
    if (l.user_id === me) return;
    items.push({ key: `like:${l.post_id}:${l.user_id}`, type: "like", actorId: l.user_id, profile: null, postId: l.post_id, postTitle: titleOf[l.post_id], created_at: l.created_at });
  });
  (comments.data ?? []).forEach((c: Any) => {
    if (c.user_id === me) return;
    items.push({ key: `comment:${c.id}`, type: "comment", actorId: c.user_id, profile: null, postId: c.post_id, postTitle: titleOf[c.post_id], text: c.text, created_at: c.created_at });
  });

  // Amitiés établies : les deux lignes du lien me concernent (RLS), la plus
  // récente ≈ le moment où l'amitié s'est conclue.
  const rows = await social.fetchFriendRows(me);
  const latestByOther: Record<string, string> = {};
  rows.forEach((r: Any) => {
    const other = r.follower_id === me ? r.following_id : r.follower_id;
    if (!latestByOther[other] || r.created_at > latestByOther[other]) latestByOther[other] = r.created_at;
  });
  Object.entries(latestByOther).forEach(([other, at]) => {
    items.push({ key: `friend:${other}`, type: "friend", actorId: other, profile: null, created_at: at });
  });

  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const top = items.slice(0, 50);

  // Profils des acteurs en un seul appel
  const ids = [...new Set(top.map((i) => i.actorId))];
  if (ids.length) {
    const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
    const byId: Record<string, Any> = Object.fromEntries((profs ?? []).map((p: Any) => [p.id, p]));
    top.forEach((i) => (i.profile = byId[i.actorId] ?? null));
  }
  return top.filter((i) => i.profile);
}

export async function getReadAt(me: string): Promise<string> {
  return (await AsyncStorage.getItem(readKey(me))) ?? "1970-01-01T00:00:00Z";
}

export async function markAllRead(me: string): Promise<void> {
  await AsyncStorage.setItem(readKey(me), new Date().toISOString());
}

export function countUnread(items: AppNotification[], readAt: string): number {
  return items.filter((i) => i.created_at > readAt).length;
}

/** PROD/BUILD — push distant (expo-notifications + token APNs). Volontairement
 *  inerte en Expo Go : aucun enregistrement de token n'est tenté ici. Au
 *  premier build EAS : brancher expo-notifications, demander la permission,
 *  enregistrer le token, et déclencher côté serveur (triggers sur
 *  likes/comments/follows → table notifications + envoi Expo Push). */
export async function registerForPushIfBuilt(): Promise<void> {
  return; // no-op tant que l'app tourne dans Expo Go
}
