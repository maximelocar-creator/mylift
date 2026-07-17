// Barre d'onglets v40 : Dashboard · Journal · Progrès · Pesée · Réglages
// + bandeau persistant "Séance en cours" (visible partout sauf Journal).
import { Tabs, useRouter, usePathname, Redirect } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import Animated, { FadeInUp, FadeOutDown } from "react-native-reanimated";
import { C } from "@/lib/theme";
import { LINE } from "@/ui/kit";
import { useActiveSession } from "@/lib/activeSession";
import { useData } from "@/lib/store";
import { useSocial } from "@/lib/social";
import { pad2 } from "@/lib/format";

function SessionElapsed({ startedAt }: { startedAt: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const int = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(int);
  }, []);
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const label = h > 0 ? `${h}h${pad2(m % 60)}` : `${m}m${pad2(sec % 60)}`;
  return <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff", opacity: 0.9 }}>{label}</Text>;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { activeSession } = useActiveSession();
  const { incoming } = useSocial();
  const { ready, profile } = useData();
  const showBanner = !!activeSession && !pathname.startsWith("/journal");

  // Compte neuf sans profil → onboarding guidé (jamais l'écran d'import,
  // qui reste l'outil interne accessible via le lien discret du login)
  if (ready && !profile?.username) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      {/* Flottante au-dessus de la tab bar (style mini-player) : ne recouvre
          jamais les headers et reste co-localisée avec la navigation. */}
      {showBanner && (
        <Animated.View
          entering={FadeInUp.duration(280)}
          exiting={FadeOutDown.duration(180)}
          style={{ position: "absolute", bottom: 64 + insets.bottom + 8, left: 12, right: 12, zIndex: 50 }}
        >
        <Pressable
          onPress={() => router.navigate("/journal")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            paddingVertical: 10,
            paddingHorizontal: 14,
            backgroundColor: C.accent,
            borderRadius: 14,
            shadowColor: C.accent,
            shadowOpacity: 0.45,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }} />
            <View style={{ minWidth: 0, flex: 1 }}>
              <View style={{ flexDirection: "row", gap: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, color: "#fff", opacity: 0.9 }}>
                  Séance en cours ·
                </Text>
                <SessionElapsed startedAt={activeSession!.startedAt} />
              </View>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: "#fff", marginTop: 1 }}>
                {activeSession!.sessionName || "Séance"}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>Reprendre →</Text>
        </Pressable>
        </Animated.View>
      )}
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: C.bg0 },
          tabBarStyle: {
            backgroundColor: "rgba(10,10,18,.96)",
            borderTopColor: LINE,
            borderTopWidth: 1,
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 6,
          },
          tabBarActiveTintColor: C.accent,
          tabBarInactiveTintColor: C.ink3,
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Feed", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="journal"
          options={{ title: "Journal", tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="stats"
          options={{ title: "Stats", tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="profil"
          options={{ title: "Profil", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} /> }}
        />
      </Tabs>
    </View>
  );
}
