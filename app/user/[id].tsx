// Profil d'un autre utilisateur — vue publique minimale (username, ville, bio,
// avatar, compteur d'amis) + machine à états de la demande d'AMI. Privé par défaut :
// AUCUNE donnée d'entraînement affichée tant que la demande n'est pas acceptée
// (et en Phase 2, aucun post n'existe encore de toute façon). Les machines
// (exercise_models) ne sont jamais visibles — la RLS serveur le garantit,
// et cet écran ne les requête même pas.
import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C, L, mono } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import { useData } from "@/lib/store";
import { useSocial } from "@/lib/social";
import * as social from "@/db/social";
import { Btn, ConfirmSheet, Skeleton } from "@/ui/kit";
import { Avatar } from "@/ui/Avatar";
import { PostCard } from "@/ui/PostCard";
import type { Any } from "@/core/mylift";

export default function UserProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const otherId = String(id);
  const { userId } = useData();
  const { refreshSocial } = useSocial();

  const [profile, setProfile] = useState<Any | null>(null);
  const [counts, setCounts] = useState({ friends: 0 });
  const [followState, setFollowState] = useState<string>("loading"); // none|pending|accepted
  const [unfollowConfirm, setUnfollowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Any[] | null>(null);
  const [syncingFriendship, setSyncingFriendship] = useState(false);

  const load = async () => {
    try {
      const [p, c, st] = await Promise.all([social.fetchProfile(otherId), social.fetchFriendCount(otherId), social.fetchFriendState(userId!, otherId)]);
      setProfile(p);
      setCounts({ friends: c });
      setFollowState(st);
      if (st === "friends") {
        // Piège RLS directionnel (CLAUDE.md) : mes posts visibles seulement si
        // MON lien sortant est accepted — sinon la réciprocité converge encore.
        const [rows, out] = await Promise.all([social.fetchUserPosts(otherId, userId!), social.outboundAccepted(userId!, otherId)]);
        setPosts(rows);
        setSyncingFriendship(!out && rows.length === 0);
      } else {
        setPosts(null);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };
  useEffect(() => {
    load();
  }, [otherId]);

  const act = async () => {
    try {
      if (followState === "none" || followState === "pending_received") {
        const next = await social.sendFriendRequest(userId!, otherId);
        setFollowState(next);
        haptic("success");
      } else if (followState === "pending_sent") {
        setFollowState("none");
        await social.cancelFriendRequest(userId!, otherId);
        haptic("light");
      } else if (followState === "friends") {
        setUnfollowConfirm(true);
        return;
      }
      refreshSocial();
    } catch (e: any) {
      haptic("error");
      load();
    }
  };

  const counter = (label: string, value: number) => (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={[mono, { fontSize: 20, fontWeight: "800", color: C.ink0 }]}>{value}</Text>
      <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14, minHeight: 44 }}>
        <Ionicons name="chevron-back" size={16} color={C.ink2} />
        <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Retour</Text>
      </Pressable>

      {error && <Text style={{ color: C.danger, textAlign: "center", padding: 20 }}>{error}</Text>}

      {!profile && !error && (
        <View style={{ alignItems: "center", gap: 12, paddingTop: 20 }}>
          <Skeleton width={88} height={88} radius={44} />
          <Skeleton width={140} height={20} />
        </View>
      )}

      {profile && (
        <>
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <Avatar profile={profile} size={88} />
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink0, marginTop: 12 }}>@{profile.username}</Text>
            {!!profile.ville && (
              <Text style={{ fontSize: 13, color: C.ink2, marginTop: 2 }}>
                <Ionicons name="location-outline" size={12} color={C.ink3} /> {profile.ville}
              </Text>
            )}
            {!!profile.bio && (
              <Text style={{ fontSize: 13, color: C.ink1, marginTop: 8, textAlign: "center", lineHeight: 19, paddingHorizontal: 20 }}>{profile.bio}</Text>
            )}
          </View>

          <View style={{ flexDirection: "row", backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 16, paddingVertical: 12, marginBottom: 12 }}>
            {counter("Amis", counts.friends)}
          </View>

          {followState !== "loading" && (
            <Btn kind={followState === "none" || followState === "pending_received" ? "primary" : "ghost"} full onPress={act}>
              {followState === "none"
                ? "Ajouter en ami"
                : followState === "pending_sent"
                  ? "Demande envoyée · Annuler"
                  : followState === "pending_received"
                    ? "Accepter la demande"
                    : "Amis ✓ · Retirer"}
            </Btn>
          )}

          {/* Amis : ses posts (même carte que le feed) */}
          {followState === "friends" && posts !== null && posts.length > 0 && (
            <View style={{ marginTop: 16 }}>
              {posts.map((p: Any, i: number) => (
                <PostCard key={p.id} post={p} index={i} onOpen={() => router.push(`/post/${p.id}`)} />
              ))}
            </View>
          )}

          {/* Compte privé : rien d'autre n'est montré tant que non accepté */}
          <View style={{ alignItems: "center", padding: 32, gap: 8, marginTop: 16 }}>
            <Ionicons name={followState === "friends" ? "checkmark-circle-outline" : "lock-closed-outline"} size={28} color={C.ink3} />
            {followState === "friends" ? (
              posts !== null && posts.length > 0 ? null : syncingFriendship ? (
                <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center" }}>
                  Vous êtes amis — la synchronisation de l'amitié se termine, ses posts apparaîtront d'ici peu.
                </Text>
              ) : (
                <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center" }}>Vous êtes amis. Aucun post pour l'instant.</Text>
              )
            ) : (
              <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center" }}>
                Ce compte est privé.{" "}
                {followState === "pending_sent"
                  ? "Ta demande est en attente d'acceptation."
                  : followState === "pending_received"
                    ? "Il t'a envoyé une demande — accepte pour devenir amis."
                    : "Envoie une demande d'ami pour voir ses posts."}
              </Text>
            )}
          </View>
        </>
      )}

      <ConfirmSheet
        open={unfollowConfirm}
        onClose={() => setUnfollowConfirm(false)}
        onConfirm={async () => {
          setUnfollowConfirm(false);
          setFollowState("none");
          await social.removeFriend(userId!, otherId);
          haptic("light");
          refreshSocial();
        }}
        title="Retirer cet ami ?"
        message={profile ? `@${profile.username} devra renvoyer une demande pour redevenir ami.` : ""}
        confirmLabel="Retirer"
      />
    </ScrollView>
  );
}
