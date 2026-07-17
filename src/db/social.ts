// Couche sociale — requêtes Supabase directes (profiles / follows sont des
// données serveur, pas de miroir offline : le graphe social exige le réseau).
// La RLS fait autorité : ces requêtes ne voient que ce que le serveur autorise.
// Comptes privés par défaut : follow = demande pending → accepted.
import { supabase } from "../lib/supabase";
import type { Any } from "../core/mylift";

/* ------------------------------------------------------------------ */
/* Profils                                                             */
/* ------------------------------------------------------------------ */
export async function fetchProfile(userId: string): Promise<Any | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function searchProfiles(q: string, selfId: string): Promise<Any[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", `%${q}%`)
    .neq("id", selfId)
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function checkUsernameAvailable(username: string, selfId: string): Promise<boolean> {
  const { data, error } = await supabase.from("profiles").select("id").ilike("username", username).neq("id", selfId).limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length === 0;
}

export async function updateProfile(userId: string, patch: Any): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function createProfile(userId: string, username: string): Promise<void> {
  const { error } = await supabase.from("profiles").insert({ id: userId, username });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Follows — statut pending → accepted                                 */
/* ------------------------------------------------------------------ */
export async function fetchCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [fers, fing] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId).eq("status", "accepted"),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId).eq("status", "accepted"),
  ]);
  if (fers.error) throw new Error(fers.error.message);
  if (fing.error) throw new Error(fing.error.message);
  return { followers: fers.count ?? 0, following: fing.count ?? 0 };
}

/** Mon lien vers `other` (null si aucun). */
export async function fetchMyFollowTo(me: string, other: string): Promise<Any | null> {
  const { data, error } = await supabase.from("follows").select("*").eq("follower_id", me).eq("following_id", other).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function sendFollowRequest(me: string, other: string): Promise<void> {
  const { error } = await supabase.from("follows").insert({ follower_id: me, following_id: other, status: "pending" });
  if (error) throw new Error(error.message);
}

/** Annuler ma demande OU me désabonner (même suppression). */
export async function unfollow(me: string, other: string): Promise<void> {
  const { error } = await supabase.from("follows").delete().eq("follower_id", me).eq("following_id", other);
  if (error) throw new Error(error.message);
}

export async function acceptFollow(followerId: string, me: string): Promise<void> {
  const { error } = await supabase.from("follows").update({ status: "accepted" }).eq("follower_id", followerId).eq("following_id", me);
  if (error) throw new Error(error.message);
}

export async function declineFollow(followerId: string, me: string): Promise<void> {
  const { error } = await supabase.from("follows").delete().eq("follower_id", followerId).eq("following_id", me);
  if (error) throw new Error(error.message);
}

/** Retirer un follower accepté (même op que refuser). */
export const removeFollower = declineFollow;

async function attachProfiles(rows: Any[], idKey: string): Promise<Any[]> {
  const ids = [...new Set(rows.map((r) => r[idKey]))];
  if (!ids.length) return [];
  const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
  if (error) throw new Error(error.message);
  const byId = Object.fromEntries((data ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, profile: byId[r[idKey]] || null })).filter((r) => r.profile);
}

/** Demandes reçues en attente (à accepter/refuser). */
export async function fetchIncomingPending(me: string): Promise<Any[]> {
  const { data, error } = await supabase.from("follows").select("*").eq("following_id", me).eq("status", "pending");
  if (error) throw new Error(error.message);
  return attachProfiles(data ?? [], "follower_id");
}

/** Mes demandes envoyées encore en attente. */
export async function fetchOutgoingPending(me: string): Promise<Any[]> {
  const { data, error } = await supabase.from("follows").select("*").eq("follower_id", me).eq("status", "pending");
  if (error) throw new Error(error.message);
  return attachProfiles(data ?? [], "following_id");
}

export async function fetchFollowers(me: string): Promise<Any[]> {
  const { data, error } = await supabase.from("follows").select("*").eq("following_id", me).eq("status", "accepted");
  if (error) throw new Error(error.message);
  return attachProfiles(data ?? [], "follower_id");
}

export async function fetchFollowing(me: string): Promise<Any[]> {
  const { data, error } = await supabase.from("follows").select("*").eq("follower_id", me).eq("status", "accepted");
  if (error) throw new Error(error.message);
  return attachProfiles(data ?? [], "following_id");
}

/* ------------------------------------------------------------------ */
/* Feed — posts des comptes suivis (accepted) + les siens              */
/* Schéma réel : posts(id, owner_id, type, log_id, lift_ref, title,    */
/* text, image_url, created_at)                                        */
/* ------------------------------------------------------------------ */
export async function fetchFeedPosts(me: string): Promise<Any[]> {
  const { data: fol, error: folErr } = await supabase.from("follows").select("following_id").eq("follower_id", me).eq("status", "accepted");
  if (folErr) throw new Error(folErr.message);
  const ids = [me, ...(fol ?? []).map((f) => f.following_id)];
  const { data, error } = await supabase.from("posts").select("*").in("owner_id", ids).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return attachProfiles(data ?? [], "owner_id");
}
