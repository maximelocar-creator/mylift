// Notifs — demandes d'AMI reçues (accepter/refuser) et envoyées (annuler)
// + activité (likes/commentaires sur mes posts, amitiés établies), dérivée
// côté client (la RLS interdit tout insert dans la table notifications).
// Ouvrir l'écran marque tout comme lu (badge du Feed remis à zéro).
import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C, L } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import { useData } from "@/lib/store";
import { useSocial } from "@/lib/social";
import * as social from "@/db/social";
import { SectionLabel, Btn, SyncDot } from "@/ui/kit";
import { Avatar } from "@/ui/Avatar";
import { formatRelative } from "@/lib/format";
import type { AppNotification } from "@/lib/notifs";
import type { Any } from "@/core/mylift";

const ACTIVITY_LABEL: Record<AppNotification["type"], string> = {
  like: "a aimé ton post",
  comment: "a commenté ton post",
  friend: "et toi êtes maintenant amis",
};

export default function Notifs() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useData();
  const { incoming, outgoing, activity, refreshSocial, markActivityRead } = useSocial();
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Ouvrir l'écran = tout marquer lu
  useEffect(() => {
    markActivityRead();
  }, [markActivityRead]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshSocial();
    setRefreshing(false);
  };

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await refreshSocial();
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg0 }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink3} />}
    >
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10, minHeight: 44 }}>
        <Ionicons name="chevron-back" size={16} color={C.ink2} />
        <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Feed</Text>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0 }}>Notifs.</Text>
        <SyncDot />
      </View>

      {incoming.length === 0 && outgoing.length === 0 && activity.length === 0 && (
        <View style={{ alignItems: "center", padding: 40, gap: 8 }}>
          <Text style={{ fontSize: 36 }}>🔔</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: C.ink1 }}>Rien pour l'instant</Text>
          <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center" }}>
            Les demandes d'ami et l'activité de tes amis apparaîtront ici.
          </Text>
        </View>
      )}

      {incoming.length > 0 && (
        <>
          <SectionLabel right={`${incoming.length}`}>Demandes reçues</SectionLabel>
          <View style={{ gap: 6 }}>
            {incoming.map((r: Any) => (
              <View
                key={`${r.follower_id}-${r.following_id}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 16 }}
              >
                <Pressable onPress={() => router.push(`/user/${r.follower_id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <Avatar profile={r.profile} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.ink0 }}>
                      @{r.profile.username}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.ink3, marginTop: 1 }}>souhaite devenir ami</Text>
                  </View>
                </Pressable>
                <Btn
                  sm
                  disabled={busy === r.follower_id}
                  onPress={() =>
                    act(r.follower_id, async () => {
                      await social.acceptFriend(r.follower_id, userId!);
                      haptic("success");
                    })
                  }
                >
                  Accepter
                </Btn>
                <Pressable
                  onPress={() =>
                    act(r.follower_id, async () => {
                      await social.declineFriend(r.follower_id, userId!);
                      haptic("light");
                    })
                  }
                  hitSlop={6}
                  style={{ padding: 8 }}
                >
                  <Text style={{ color: C.ink3, fontSize: 15 }}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <SectionLabel right={`${outgoing.length}`}>Demandes envoyées</SectionLabel>
          <View style={{ gap: 6 }}>
            {outgoing.map((r: Any) => (
              <View
                key={`${r.follower_id}-${r.following_id}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 16 }}
              >
                <Pressable onPress={() => router.push(`/user/${r.following_id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <Avatar profile={r.profile} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: C.ink0 }}>
                      @{r.profile.username}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.ink3, marginTop: 1 }}>en attente d'acceptation</Text>
                  </View>
                </Pressable>
                <Btn
                  kind="ghost"
                  sm
                  disabled={busy === r.following_id}
                  onPress={() =>
                    act(r.following_id, async () => {
                      await social.cancelFriendRequest(userId!, r.following_id);
                      haptic("light");
                    })
                  }
                >
                  Annuler
                </Btn>
              </View>
            ))}
          </View>
        </>
      )}

      {activity.length > 0 && (
        <>
          <SectionLabel>Activité</SectionLabel>
          <View style={{ gap: 6 }}>
            {activity.map((n) => (
              <Pressable
                key={n.key}
                onPress={() => (n.postId ? router.push(`/post/${n.postId}`) : router.push(`/user/${n.actorId}`))}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 16 }}
              >
                <Avatar profile={n.profile} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={{ fontSize: 13, color: C.ink1, lineHeight: 18 }}>
                    <Text style={{ fontWeight: "800", color: C.ink0 }}>@{n.profile?.username}</Text> {ACTIVITY_LABEL[n.type]}
                    {n.postTitle ? <Text style={{ color: C.ink2 }}> « {n.postTitle} »</Text> : null}
                  </Text>
                  {!!n.text && (
                    <Text numberOfLines={1} style={{ fontSize: 12, color: C.ink3, marginTop: 2, fontStyle: "italic" }}>
                      {n.text}
                    </Text>
                  )}
                  <Text style={{ fontSize: 10.5, color: C.ink3, marginTop: 2 }}>{formatRelative(String(n.created_at).slice(0, 10))}</Text>
                </View>
                <Ionicons
                  name={n.type === "like" ? "heart" : n.type === "comment" ? "chatbubble" : "people"}
                  size={17}
                  color={n.type === "like" ? C.accent : n.type === "comment" ? C.ink2 : C.success}
                />
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}
