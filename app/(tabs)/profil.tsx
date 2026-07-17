// Profil (le sien) — avatar, username, ville, bio, compteurs, QR de profil,
// listes followers/following, accès édition et réglages (import backup inclus,
// discret, dans Réglages).
import { useCallback, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { C, L, mono } from "@/lib/theme";
import { useData } from "@/lib/store";
import { useSocial } from "@/lib/social";
import { useActiveSession } from "@/lib/activeSession";
import * as social from "@/db/social";
import { Sheet, Btn, SyncDot, ConfirmSheet } from "@/ui/kit";
import { Avatar } from "@/ui/Avatar";
import { PostCard } from "@/ui/PostCard";
import { haptic } from "@/lib/haptics";
import type { Any } from "@/core/mylift";

export default function Profil() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId, journalLogs } = useData();
  const { friendCount, refreshSocial } = useSocial();
  const { activeSession } = useActiveSession();
  const bottomPad = 24 + (activeSession ? 64 : 0);

  const [profile, setProfile] = useState<Any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [listRows, setListRows] = useState<Any[]>([]);
  const [removeTarget, setRemoveTarget] = useState<Any | null>(null);
  const [myPosts, setMyPosts] = useState<Any[] | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const p = await social.fetchProfile(userId);
      setProfile(p);
      setMyPosts(await social.fetchUserPosts(userId, userId));
    } catch {}
  }, [userId]);
  // Recharge à chaque retour sur l'onglet — un post publié depuis le récap
  // doit apparaître ici sans pull-to-refresh
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshSocial()]);
    setRefreshing(false);
  };

  const listReq = useRef(0);
  const openList = async () => {
    const req = ++listReq.current;
    setListOpen(true);
    setListRows([]);
    try {
      const rows = await social.fetchFriends(userId!);
      if (listReq.current === req) setListRows(rows);
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
        {!!profile?.ville && (
          <Text style={{ fontSize: 13, color: C.ink2, marginTop: 2 }}>
            <Ionicons name="location-outline" size={12} color={C.ink3} /> {profile.ville}
          </Text>
        )}
        {!!profile?.bio && <Text style={{ fontSize: 13, color: C.ink1, marginTop: 8, textAlign: "center", lineHeight: 19, paddingHorizontal: 20 }}>{profile.bio}</Text>}
      </View>

      {/* Compteurs */}
      <View style={{ flexDirection: "row", backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 16, paddingVertical: 12, marginBottom: 12 }}>
        {counter("Amis", friendCount, () => openList())}
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
      {/* Mes posts — même carte que partout ailleurs */}
      <Text style={{ fontSize: 13, fontWeight: "800", color: C.ink2, textTransform: "uppercase", letterSpacing: 1, marginTop: 24, marginBottom: 10 }}>
        Mes posts
      </Text>
      {myPosts !== null && myPosts.length === 0 && (
        <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center", padding: 20, lineHeight: 18 }}>
          Aucun post pour l'instant. Partage une séance depuis le récap de fin, ou un lift depuis l'écran d'un exo.
        </Text>
      )}
      {(myPosts ?? []).map((p: Any, i: number) => (
        <PostCard key={p.id} post={p} index={i} onOpen={() => router.push(`/post/${p.id}`)} />
      ))}

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

      {/* Liste d'amis */}
      <Sheet open={listOpen} onClose={() => setListOpen(false)} title="Amis">
        {listRows.length === 0 && <Text style={{ color: C.ink3, textAlign: "center", padding: 20 }}>Personne pour l'instant.</Text>}
        <View style={{ gap: 6 }}>
          {listRows.map((r: Any) => (
            <View key={r.otherId} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, backgroundColor: C.bg3, borderRadius: 12 }}>
              <Pressable
                onPress={() => {
                  setListOpen(false);
                  router.push(`/user/${r.otherId}`);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}
              >
                <Avatar profile={r.profile} size={36} />
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.ink0, flex: 1 }}>
                  @{r.profile.username}
                </Text>
              </Pressable>
              <Btn kind="ghost" sm onPress={() => setRemoveTarget(r)}>
                Retirer
              </Btn>
            </View>
          ))}
        </View>
      </Sheet>

      <ConfirmSheet
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          const t = removeTarget;
          setRemoveTarget(null);
          if (!t) return;
          await social.removeFriend(userId!, t.otherId);
          haptic("light");
          await refreshSocial();
          if (listOpen) openList();
        }}
        title="Retirer cet ami ?"
        message={removeTarget ? `@${removeTarget.profile.username} devra renvoyer une demande pour redevenir ami.` : ""}
        confirmLabel="Retirer"
      />
    </ScrollView>
  );
}
