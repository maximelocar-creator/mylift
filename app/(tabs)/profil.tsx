// Profil (le sien) — avatar, username, ville, bio, compteurs, QR de profil,
// listes followers/following, accès édition et réglages (import backup inclus,
// discret, dans Réglages).
import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { C, L, mono } from "@/lib/theme";
import { useData } from "@/lib/store";
import { useSocial } from "@/lib/social";
import { useActiveSession } from "@/lib/activeSession";
import * as social from "@/db/social";
import { Sheet, Btn, SyncDot, ConfirmSheet } from "@/ui/kit";
import { Avatar } from "@/ui/Avatar";
import { haptic } from "@/lib/haptics";
import type { Any } from "@/core/mylift";

export default function Profil() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId, journalLogs } = useData();
  const { counts, refreshSocial } = useSocial();
  const { activeSession } = useActiveSession();
  const bottomPad = 24 + (activeSession ? 64 : 0);

  const [profile, setProfile] = useState<Any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [listOpen, setListOpen] = useState<"followers" | "following" | null>(null);
  const [listRows, setListRows] = useState<Any[]>([]);
  const [removeTarget, setRemoveTarget] = useState<Any | null>(null);

  const load = async () => {
    try {
      const p = await social.fetchProfile(userId!);
      setProfile(p);
    } catch {}
  };
  useEffect(() => {
    load();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshSocial()]);
    setRefreshing(false);
  };

  const openList = async (kind: "followers" | "following") => {
    setListOpen(kind);
    setListRows([]);
    try {
      const rows = kind === "followers" ? await social.fetchFollowers(userId!) : await social.fetchFollowing(userId!);
      setListRows(rows);
    } catch {}
  };

  const counter = (label: string, value: number, onPress?: () => void) => (
    <Pressable onPress={onPress} disabled={!onPress} style={{ alignItems: "center", flex: 1, minHeight: 48, justifyContent: "center" }}>
      <Text style={[mono, { fontSize: 20, fontWeight: "800", color: C.ink0 }]}>{value}</Text>
      <Text style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg0 }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: bottomPad }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink3} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0 }}>Profil.</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <SyncDot />
          <Pressable onPress={() => router.push("/settings")} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name="settings-outline" size={20} color={C.ink1} />
          </Pressable>
        </View>
      </View>

      {/* Entête profil */}
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <Avatar profile={profile} size={88} />
        <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink0, marginTop: 12 }}>@{profile?.username || "…"}</Text>
        {!!profile?.city && (
          <Text style={{ fontSize: 13, color: C.ink2, marginTop: 2 }}>
            <Ionicons name="location-outline" size={12} color={C.ink3} /> {profile.city}
          </Text>
        )}
        {!!profile?.bio && <Text style={{ fontSize: 13, color: C.ink1, marginTop: 8, textAlign: "center", lineHeight: 19, paddingHorizontal: 20 }}>{profile.bio}</Text>}
      </View>

      {/* Compteurs */}
      <View style={{ flexDirection: "row", backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 16, paddingVertical: 12, marginBottom: 12 }}>
        {counter("Followers", counts.followers, () => openList("followers"))}
        <View style={{ width: 1, backgroundColor: L.line }} />
        {counter("Following", counts.following, () => openList("following"))}
        <View style={{ width: 1, backgroundColor: L.line }} />
        {counter("Séances", journalLogs.length)}
      </View>

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <Btn kind="ghost" onPress={() => router.push("/profile-edit")} style={{ flex: 1 }}>
          ✎ Modifier le profil
        </Btn>
        <Btn kind="ghost" onPress={() => setQrOpen(true)} style={{ flex: 1 }}>
          ▦ Mon QR code
        </Btn>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn kind="ghost" onPress={() => router.push("/search")} style={{ flex: 1 }}>
          🔍 Rechercher
        </Btn>
        <Btn kind="ghost" onPress={() => router.push("/pesee")} style={{ flex: 1 }}>
          ⚖️ Pesée
        </Btn>
      </View>

      {/* QR de profil */}
      <Sheet open={qrOpen} onClose={() => setQrOpen(false)} title="Mon QR code">
        <View style={{ alignItems: "center", gap: 16, paddingVertical: 8 }}>
          <Text style={{ fontSize: 13, color: C.ink2, textAlign: "center" }}>Fais scanner ce code pour qu'on te retrouve et t'envoie une demande de follow.</Text>
          <View style={{ padding: 16, backgroundColor: "#fff", borderRadius: 16 }}>
            <QRCode value={`mylift://user/${userId}`} size={200} backgroundColor="#fff" color={C.bg0} />
          </View>
          <Text style={[mono, { fontSize: 13, color: C.ink1, fontWeight: "700" }]}>@{profile?.username}</Text>
        </View>
      </Sheet>

      {/* Listes followers / following */}
      <Sheet open={!!listOpen} onClose={() => setListOpen(null)} title={listOpen === "followers" ? "Followers" : "Following"}>
        {listRows.length === 0 && <Text style={{ color: C.ink3, textAlign: "center", padding: 20 }}>Personne pour l'instant.</Text>}
        <View style={{ gap: 6 }}>
          {listRows.map((r: Any) => {
            const otherId = listOpen === "followers" ? r.follower_id : r.following_id;
            return (
              <View key={otherId} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, backgroundColor: C.bg3, borderRadius: 12 }}>
                <Pressable
                  onPress={() => {
                    setListOpen(null);
                    router.push(`/user/${otherId}`);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}
                >
                  <Avatar profile={r.profile} size={36} />
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.ink0, flex: 1 }}>
                    @{r.profile.username}
                  </Text>
                </Pressable>
                <Btn kind="ghost" sm onPress={() => setRemoveTarget({ ...r, kind: listOpen })}>
                  {listOpen === "followers" ? "Retirer" : "Ne plus suivre"}
                </Btn>
              </View>
            );
          })}
        </View>
      </Sheet>

      <ConfirmSheet
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          const t = removeTarget;
          setRemoveTarget(null);
          if (!t) return;
          if (t.kind === "followers") await social.removeFollower(t.follower_id, userId!);
          else await social.unfollow(userId!, t.following_id);
          haptic("light");
          await refreshSocial();
          if (listOpen) openList(listOpen);
        }}
        title={removeTarget?.kind === "followers" ? "Retirer ce follower ?" : "Ne plus suivre ?"}
        message={removeTarget ? `@${removeTarget.profile.username}` : ""}
        confirmLabel={removeTarget?.kind === "followers" ? "Retirer" : "Ne plus suivre"}
      />
    </ScrollView>
  );
}
