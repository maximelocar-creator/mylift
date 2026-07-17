// Couche sociale — requêtes Supabase directes (profiles / follows sont des
// données serveur, pas de miroir offline : le graphe social exige le réseau).
// La RLS fait autorité : ces requêtes ne voient que ce que le serveur autorise.
// MODÈLE AMIS (décision Maxime) : une demande pending, une acceptation, et le
// lien est RÉCIPROQUE — "amis" = ligne accepted dans un sens OU l'autre sur la
// table follows (pas de follow-back, pas de double ligne).
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
/* Amis — une demande pending → accepted = lien réciproque             */
/* ------------------------------------------------------------------ */

/** L'autre bout d'une ligne follows, vu de `me`. */
const otherIdOf = (row: Any, me: string) => (row.follower_id === me ? row.following_id : row.follower_id);

/** Toutes mes lignes accepted (un sens ou l'autre) = mes amis. */
export async function fetchFriendRows(me: string): Promise<Any[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("*")
    .eq("status", "accepted")
    .or(`follower_id.eq.${me},following_id.eq.${me}`);
  if (error) throw new Error(error.message);
  // dédoublonne par autre-id (au cas où deux lignes croisées existent)
  const seen = new Set<string>();
  return (data ?? []).filter((r) => {
    const o = otherIdOf(r, me);
    if (seen.has(o)) return false;
    seen.add(o);
    return true;
  });
}

export async function fetchFriendCount(userId: string): Promise<number> {
  return (await fetchFriendRows(userId)).length;
}

export type FriendState = "none" | "pending_sent" | "pending_received" | "friends";

/** État de la relation entre moi et `other`. */
export async function fetchFriendState(me: string, other: string): Promise<FriendState> {
  const { data, error } = await supabase
    .from("follows")
    .select("*")
    .or(`and(follower_id.eq.${me},following_id.eq.${other}),and(follower_id.eq.${other},following_id.eq.${me})`);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.some((r) => r.status === "accepted")) return "friends";
  if (rows.some((r) => r.follower_id === me && r.status === "pending")) return "pending_sent";
  if (rows.some((r) => r.follower_id === other && r.status === "pending")) return "pending_received";
  return "none";
}

/** Envoyer une demande d'ami ; si l'autre m'en avait déjà envoyé une, on accepte direct. */
export async function sendFriendRequest(me: string, other: string): Promise<FriendState> {
  const state = await fetchFriendState(me, other);
  if (state === "friends" || state === "pending_sent") return state;
  if (state === "pending_received") {
    await acceptFriend(other, me);
    return "friends";
  }
  const { error } = await supabase.from("follows").insert({ follower_id: me, following_id: other, status: "pending" });
  if (error) throw new Error(error.message);
  return "pending_sent";
}

/**
 * Accepter la demande de `requester`. La RLS n'autorise que l'insert en
 * pending : la réciprocité (nécessaire pour que la RLS des posts fonctionne
 * dans les deux sens) se matérialise en créant la demande inverse en pending —
 * l'app du demandeur l'auto-accepte à son prochain refresh (ensureReciprocity).
 */
export async function acceptFriend(requesterId: string, me: string): Promise<void> {
  const { error } = await supabase.from("follows").update({ status: "accepted" }).eq("follower_id", requesterId).eq("following_id", me);
  if (error) throw new Error(error.message);
  const { data: reverse } = await supabase.from("follows").select("*").eq("follower_id", me).eq("following_id", requesterId).maybeSingle();
  if (!reverse) {
    await supabase.from("follows").insert({ follower_id: me, following_id: requesterId, status: "pending" });
  }
}

/**
 * Convergence de la réciprocité (appelée à chaque refresh social) :
 * 1. lien accepté entrant (X→moi) sans lien sortant → j'envoie moi→X pending ;
 * 2. pending entrant (X→moi) alors qu'un lien accepté existe déjà (moi→X ou
 *    X→moi via un autre chemin) → auto-accepté : on est déjà amis.
 */
export async function ensureReciprocity(me: string): Promise<void> {
  const { data, error } = await supabase.from("follows").select("*").or(`follower_id.eq.${me},following_id.eq.${me}`);
  if (error) return;
  const rows = data ?? [];
  const outBy = new Map(rows.filter((r) => r.follower_id === me).map((r) => [r.following_id, r]));
  const inBy = new Map(rows.filter((r) => r.following_id === me).map((r) => [r.follower_id, r]));
  for (const [other, inRow] of inBy) {
    const outRow = outBy.get(other);
    if (inRow.status === "accepted" && !outRow) {
      await supabase.from("follows").insert({ follower_id: me, following_id: other, status: "pending" });
    }
    if (inRow.status === "pending" && outRow?.status === "accepted") {
      await supabase.from("follows").update({ status: "accepted" }).eq("follower_id", other).eq("following_id", me);
    }
  }
}

/** Refuser une demande reçue. */
export async function declineFriend(requesterId: string, me: string): Promise<void> {
  const { error } = await supabase.from("follows").delete().eq("follower_id", requesterId).eq("following_id", me);
  if (error) throw new Error(error.message);
}

/** Annuler ma demande envoyée. */
export async function cancelFriendRequest(me: string, other: string): Promise<void> {
  const { error } = await supabase.from("follows").delete().eq("follower_id", me).eq("following_id", other);
  if (error) throw new Error(error.message);
}

/** Retirer un ami : supprime le lien quel que soit son sens. */
export async function removeFriend(me: string, other: string): Promise<void> {
  await supabase.from("follows").delete().eq("follower_id", me).eq("following_id", other);
  await supabase.from("follows").delete().eq("follower_id", other).eq("following_id", me);
}

async function attachProfiles(rows: Any[], idKey: string | ((r: Any) => string)): Promise<Any[]> {
  const getId = typeof idKey === "function" ? idKey : (r: Any) => r[idKey];
  const ids = [...new Set(rows.map(getId))];
  if (!ids.length) return [];
  const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
  if (error) throw new Error(error.message);
  const byId = Object.fromEntries((data ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, otherId: getId(r), profile: byId[getId(r)] || null })).filter((r) => r.profile);
}

/** Demandes d'ami reçues en attente (hors réciprocité déjà amie). */
export async function fetchIncomingPending(me: string): Promise<Any[]> {
  const { data, error } = await supabase.from("follows").select("*").eq("following_id", me).eq("status", "pending");
  if (error) throw new Error(error.message);
  const friends = new Set((await fetchFriendRows(me)).map((r) => otherIdOf(r, me)));
  return attachProfiles((data ?? []).filter((r) => !friends.has(r.follower_id)), "follower_id");
}

/** Mes demandes envoyées encore en attente (hors réciprocité déjà amie). */
export async function fetchOutgoingPending(me: string): Promise<Any[]> {
  const { data, error } = await supabase.from("follows").select("*").eq("follower_id", me).eq("status", "pending");
  if (error) throw new Error(error.message);
  const friends = new Set((await fetchFriendRows(me)).map((r) => otherIdOf(r, me)));
  return attachProfiles((data ?? []).filter((r) => !friends.has(r.following_id)), "following_id");
}

/** Liste d'amis (profils joints). */
export async function fetchFriends(me: string): Promise<Any[]> {
  const rows = await fetchFriendRows(me);
  return attachProfiles(rows, (r) => otherIdOf(r, me));
}

/* ------------------------------------------------------------------ */
/* Feed — posts de mes amis + les miens                                */
/* Schéma réel : posts(id, owner_id, type, log_id, lift_ref, title,    */
/* text, image_url, created_at)                                        */
/* ------------------------------------------------------------------ */
export async function fetchFeedPosts(me: string): Promise<Any[]> {
  const friends = await fetchFriendRows(me);
  const ids = [me, ...friends.map((r) => otherIdOf(r, me))];
  const { data, error } = await supabase.from("posts").select("*").in("owner_id", ids).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return enrichPostsSocial(await attachProfiles(data ?? [], "owner_id"), me);
}

/** Posts d'un utilisateur (la RLS tranche : visibles seulement si ami accepté
 *  dans le sens lecteur→auteur, ou soi-même). */
export async function fetchUserPosts(ownerId: string, me?: string): Promise<Any[]> {
  const { data, error } = await supabase.from("posts").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return enrichPostsSocial(await attachProfiles(data ?? [], "owner_id"), me ?? null);
}

export async function fetchPost(postId: string, me?: string): Promise<Any | null> {
  const { data, error } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const rows = await enrichPostsSocial(await attachProfiles([data], "owner_id"), me ?? null);
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Likes & commentaires (Phase 4)                                      */
/* Sondé en prod : likes(post_id, user_id, created_at) ; comments(id   */
/* text client, post_id, user_id, text ≤500 CHECK, created_at). La RLS */
/* bloque l'usurpation (user_id = auth.uid()) et n'autorise le delete  */
/* que sur ses propres lignes (pas de modération du owner du post).    */
/* ------------------------------------------------------------------ */

/** Ajoute like_count / liked_by_me / comment_count sur chaque post. */
async function enrichPostsSocial(posts: Any[], me: string | null): Promise<Any[]> {
  if (!posts.length) return posts;
  const ids = posts.map((p) => p.id);
  const [likes, comments] = await Promise.all([
    supabase.from("likes").select("post_id,user_id").in("post_id", ids),
    supabase.from("comments").select("post_id").in("post_id", ids),
  ]);
  const likeCount: Record<string, number> = {};
  const mine = new Set<string>();
  (likes.data ?? []).forEach((l: Any) => {
    likeCount[l.post_id] = (likeCount[l.post_id] || 0) + 1;
    if (me && l.user_id === me) mine.add(l.post_id);
  });
  const comCount: Record<string, number> = {};
  (comments.data ?? []).forEach((c: Any) => {
    comCount[c.post_id] = (comCount[c.post_id] || 0) + 1;
  });
  return posts.map((p) => ({ ...p, like_count: likeCount[p.id] || 0, liked_by_me: mine.has(p.id), comment_count: comCount[p.id] || 0 }));
}

export async function setLiked(postId: string, me: string, liked: boolean): Promise<void> {
  if (liked) {
    const { error } = await supabase.from("likes").upsert({ post_id: postId, user_id: me }, { ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", me);
    if (error) throw new Error(error.message);
  }
}

export async function fetchComments(postId: string): Promise<Any[]> {
  const { data, error } = await supabase.from("comments").select("*").eq("post_id", postId).order("created_at", { ascending: true }).limit(200);
  if (error) throw new Error(error.message);
  return attachProfiles(data ?? [], "user_id");
}

export async function addComment(postId: string, me: string, text: string): Promise<Any> {
  const id = "id-" + Math.random().toString(36).slice(2, 9) + "-" + Date.now();
  const row = { id, post_id: postId, user_id: me, text: text.slice(0, 500) };
  const { error } = await supabase.from("comments").insert(row);
  if (error) throw new Error(error.message);
  return row;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
}

/** Mon lien sortant vers `other` est-il accepted ? (= la RLS me laisse voir
 *  ses posts — sinon la réciprocité auto-convergente est encore en cours) */
export async function outboundAccepted(me: string, other: string): Promise<boolean> {
  const { data } = await supabase.from("follows").select("status").eq("follower_id", me).eq("following_id", other).maybeSingle();
  return data?.status === "accepted";
}

/* ------------------------------------------------------------------ */
/* Suggestions d'amis (amis en commun)                                 */
/* La RLS de follows ne montre que SES propres liens → le calcul vit   */
/* dans la fonction SQL friend_suggestions (SECURITY DEFINER, voir     */
/* supabase/friend_suggestions.sql, à appliquer par Maxime). Tant que  */
/* la fonction n'existe pas en prod, on renvoie null et l'UI masque    */
/* la section — aucune policy n'est affaiblie côté client.             */
/* ------------------------------------------------------------------ */
export async function fetchFriendSuggestions(me: string): Promise<Any[] | null> {
  const { data, error } = await supabase.rpc("friend_suggestions", { max_results: 10 });
  if (error) return null; // fonction absente ou refusée : section masquée
  const rows: Any[] = (data ?? []).filter((r: Any) => r.suggested_id && r.suggested_id !== me);
  if (!rows.length) return [];
  const { data: profs } = await supabase.from("profiles").select("*").in("id", rows.map((r) => r.suggested_id));
  const byId: Record<string, Any> = Object.fromEntries((profs ?? []).map((p: Any) => [p.id, p]));
  return rows.map((r) => ({ id: r.suggested_id, mutual: Number(r.mutual_count) || 0, profile: byId[r.suggested_id] ?? null })).filter((r) => r.profile);
}

/** Publier un post. lift_ref ne doit JAMAIS contenir de nom de machine. */
export async function createPost(ownerId: string, post: { type: "lift" | "session"; title: string; text?: string | null; lift_ref?: Any | null; log_id?: string | null; image_url?: string | null }): Promise<string> {
  const id = "id-" + Math.random().toString(36).slice(2, 9) + "-" + Date.now();
  const { error } = await supabase.from("posts").insert({
    id,
    owner_id: ownerId,
    type: post.type,
    title: post.title,
    text: post.text ?? null,
    lift_ref: post.lift_ref ?? null,
    log_id: post.log_id ?? null,
    image_url: post.image_url ?? null,
  });
  if (error) throw new Error(error.message);
  return id;
}
