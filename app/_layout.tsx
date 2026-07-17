import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";
import { DataProvider } from "@/lib/store";
import { ActiveSessionProvider } from "@/lib/activeSession";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const onLogin = segments[0] === "login";
    if (!session && !onLogin) router.replace("/login");
    if (session && onLogin) router.replace("/");
  }, [ready, session, segments]);

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.bg0 },
      }}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <StatusBar style="light" />
      {session ? (
        <DataProvider userId={session.user.id}>
          <ActiveSessionProvider>{stack}</ActiveSessionProvider>
        </DataProvider>
      ) : (
        stack
      )}
    </View>
  );
}
