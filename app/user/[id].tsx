// Profil d'un autre utilisateur — vue publique minimale (username, ville, bio,
// avatar, compteurs) + machine à états du follow. Compte privé par défaut :
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
import type { Any } from "@/core/mylift";

export default function UserProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const otherId = String(id);
  const { userId } = useData();
  const { refreshSocial } = useSocial();

  const [profile, setProfile] = useState<Any | null>(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [followState, setFollowState] = useState<string>("loading"); // none|pending|accepted
  const [unfollowConfirm, setUnfollowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [p, c, f] = await Promise.all([social.fetchProfile(otherId), social.fetchCounts(otherId), social.fetchMyFollowTo(userId!, otherId)]);
      setProfile(p);
      setCounts(c);
      setFollowState(f ? f.status : "none");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };
  useEffect(() => {
    load();
  }, [otherId]);

  const act = async () => {
    try {
      if (followState === "none") {
        setFollowState("pending");
        await social.sendFollowRequest(userId!, otherId);
        haptic("success");
      } else if (followState === "pending") {
        setFollowState("none");
        await social.unfollow(userId!, otherId);
        haptic("light");
      } else if (followState === "accepted") {
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
            {!!profile.city && (
              <Text style={{ fontSize: 13, color: C.ink2, marginTop: 2 }}>
                <Ionicons name="location-outline" size={12} color={C.ink3} /> {profile.city}
              </Text>
            )}
            {!!profile.bio && (
              <Text style={{ fontSize: 13, color: C.ink1, marginTop: 8, textAlign: "center", lineHeight: 19, paddingHorizontal: 20 }}>{profile.bio}</Text>
            )}
          </View>

          <View style={{ flexDirection: "row", backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 16, paddingVertical: 12, marginBottom: 12 }}>
            {counter("Followers", counts.followers)}
            <View style={{ width: 1, backgroundColor: L.line }} />
            {counter("Following", counts.following)}
          </View>

          {followState !== "loading" && (
            <Btn kind={followState === "none" ? "primary" : "ghost"} full onPress={act}>
              {followState === "none" ? "Suivre" : followState === "pending" ? "Demande envoyée · Annuler" : "Suivi ✓ · Ne plus suivre"}
            </Btn>
          )}

          {/* Compte privé : rien d'autre n'est montré tant que non accepté */}
          <View style={{ alignItems: "center", padding: 32, gap: 8, marginTop: 16 }}>
            <Ionicons name={followState === "accepted" ? "checkmark-circle-outline" : "lock-closed-outline"} size={28} color={C.ink3} />
            {followState === "accepted" ? (
              <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center" }}>
                Tu suis ce compte. Ses posts apparaîtront dans ton feed dès la prochaine mise à jour.
              </Text>
            ) : (
              <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center" }}>
                Ce compte est privé. {followState === "pending" ? "Ta demande est en attente d'acceptation." : "Envoie une demande pour voir ses posts."}
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
          await social.unfollow(userId!, otherId);
          haptic("light");
          refreshSocial();
        }}
        title="Ne plus suivre ?"
        message={profile ? `@${profile.username} devra accepter une nouvelle demande si tu changes d'avis.` : ""}
        confirmLabel="Ne plus suivre"
      />
    </ScrollView>
  );
}
