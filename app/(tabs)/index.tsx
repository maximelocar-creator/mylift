// Feed — onglet d'accueil : posts des comptes suivis (accepted) + les siens.
// Cartes minimales (lift avec lift_ref / séance) ; likes & commentaires en
// Phase 4. État vide soigné si personne à suivre.
import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { C, L, MOTION, mono } from "@/lib/theme";
import { useData } from "@/lib/store";
import { useWeekStats } from "@/lib/stats";
import { formatNum } from "@/lib/format";
import { useActiveSession } from "@/lib/activeSession";
import { useSocial } from "@/lib/social";
import * as social from "@/db/social";
import { SyncDot, Btn, ScreenSkeleton, Chip } from "@/ui/kit";
import { PostCard } from "@/ui/PostCard";
import type { Any } from "@/core/mylift";

export default function Feed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, ready, userId } = useData();
  const { activeSession } = useActiveSession();
  const { incoming, unreadActivity } = useSocial();
  const badge = incoming.length + unreadActivity;
  const week = useWeekStats();
  const weekSessions = week.weekKPI?.curr?.sessions ?? 0;
  const weekTonnage = week.weekKPI?.curr?.tonnage ?? 0;
  const todayLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const bottomPad = 24 + (activeSession ? 64 : 0);
  const [posts, setPosts] = useState<Any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setPosts(await social.fetchFeedPosts(userId));
    } catch {
      setPosts([]);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Outil interne : lien "Importer un ancien backup" armé depuis le login
  useEffect(() => {
    AsyncStorage.getItem("mylift_open_import_once").then((v) => {
      if (v === "1") {
        AsyncStorage.removeItem("mylift_open_import_once");
        router.push("/home");
      }
    });
  }, []);

  if (!ready) return <ScreenSkeleton paddingTop={insets.top + 12} />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg0 }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: bottomPad }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={C.ink3}
        />
      }
    >
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <View>
          <Text style={[mono, { fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", color: C.ink3, marginBottom: 3 }]}>
            {todayLabel}
          </Text>
          <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0 }}>
            My<Text style={{ color: C.accent }}>Lift</Text>
          </Text>
          {!!profile?.username && <Text style={{ fontSize: 13, color: C.ink3, marginTop: 2 }}>Salut {profile.username}.</Text>}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <SyncDot />
          <Pressable onPress={() => router.push("/search")} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name="search" size={20} color={C.ink1} />
          </Pressable>
          <Pressable onPress={() => router.push("/notifs")} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name="notifications-outline" size={20} color={C.ink1} />
            {badge > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: 2,
                  right: 0,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: C.accent,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 3,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{badge}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {weekSessions > 0 && (
        <Animated.View entering={FadeInDown.duration(MOTION.view)}>
          <Pressable
            onPress={() => router.navigate("/stats")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              padding: 14,
              paddingHorizontal: 16,
              backgroundColor: pressed ? L.bgHover : C.bg2,
              borderWidth: 1,
              borderColor: L.line,
              borderRadius: 16,
              marginBottom: 14,
            })}
          >
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: L.accentWash, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="flame" size={17} color={C.accentHi} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: C.ink0 }}>Ta semaine</Text>
              <Text style={[mono, { fontSize: 12, color: C.ink2, marginTop: 1 }]}>
                {weekSessions} séance{weekSessions > 1 ? "s" : ""} · {formatNum(weekTonnage / 1000, 1)} t
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={C.ink3} />
          </Pressable>
        </Animated.View>
      )}

      {posts !== null && posts.length > 0 && posts.map((p, i) => <PostCard key={p.id} post={p} index={i} onOpen={() => router.push(`/post/${p.id}`)} onOpenUser={(id) => router.push(`/user/${id}`)} />)}

      {posts !== null && posts.length === 0 && (
        <Animated.View
          entering={FadeInDown.duration(MOTION.view)}
          style={{ alignItems: "center", padding: 32, backgroundColor: C.bg2, borderWidth: 1, borderColor: L.line, borderRadius: 22, gap: 8 }}
        >
          <Text style={{ fontSize: 40 }}>📭</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.ink0 }}>Aucun post pour l'instant</Text>
          <Text style={{ fontSize: 13, color: C.ink3, textAlign: "center", lineHeight: 18, marginBottom: 8 }}>
            Suis des utilisateurs pour voir leurs séances et leurs PRs ici.
          </Text>
          <Btn full onPress={() => router.push("/search")}>
            Rechercher des utilisateurs
          </Btn>
        </Animated.View>
      )}
    </ScrollView>
  );
}
