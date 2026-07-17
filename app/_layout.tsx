import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";
import { DataProvider } from "@/lib/store";
import { ActiveSessionProvider } from "@/lib/activeSession";
import { SocialProvider } from "@/lib/social";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Tant que la session n'est pas connue, on n'affiche rien : ça empêche les
  // onglets de se monter hors DataProvider (crash "hors ActiveSessionProvider").
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: C.bg0 }} />;
  }

  // Routes protégées : (tabs) et /home n'existent que connecté, /login que
  // déconnecté. La redirection est gérée par expo-router (pas d'effet manuel).
  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.bg0 },
        // Push/pop iOS natif + swipe-back depuis tout l'écran
        animation: "default",
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="exo/[key]" />
        <Stack.Screen name="muscle/[group]" />
        <Stack.Screen name="program/[id]" />
        <Stack.Screen name="generator" />
        <Stack.Screen name="volume/[id]" />
        <Stack.Screen name="pesee" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="search" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="profile-edit" />
        <Stack.Screen name="notifs" />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="home" options={{ presentation: "modal" }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: C.bg0 }}>
        <StatusBar style="light" />
        {/* Providers TOUJOURS montés (userId nullable) : à la déconnexion, les
            écrans sous tabs se re-rendent une frame avant la redirection des
            routes protégées — un provider conditionnel ferait crasher les hooks. */}
        <DataProvider userId={session?.user.id ?? null}>
          <SocialProvider userId={session?.user.id ?? null}>
            <ActiveSessionProvider>{stack}</ActiveSessionProvider>
          </SocialProvider>
        </DataProvider>
      </View>
    </GestureHandlerRootView>
  );
}
