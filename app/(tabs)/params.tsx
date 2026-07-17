// Réglages — biblio, programmes, groupes (étape 6) + import backup + compte.
import { Text, ScrollView, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { C } from "@/lib/theme";
import { useData } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { LINE } from "@/ui/kit";

export default function Params() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, pendingSync } = useData();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12 }}>
      <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0, marginBottom: 16 }}>Réglages.</Text>

      <View style={{ padding: 16, backgroundColor: C.bg2, borderWidth: 1, borderColor: LINE, borderRadius: 16, marginBottom: 10 }}>
        <Text style={{ color: C.ink2, fontSize: 13, marginBottom: 4 }}>Connecté</Text>
        <Text style={{ color: C.ink0, fontSize: 18, fontWeight: "700" }}>@{profile?.username || "…"}</Text>
        {pendingSync > 0 && (
          <Text style={{ color: C.gold, fontSize: 12, marginTop: 6 }}>{pendingSync} écriture(s) en attente de sync</Text>
        )}
      </View>

      <Pressable
        onPress={() => router.push("/home")}
        style={{ padding: 16, backgroundColor: C.bg2, borderWidth: 1, borderColor: LINE, borderRadius: 16, marginBottom: 10 }}
      >
        <Text style={{ color: C.ink0, fontSize: 15, fontWeight: "700" }}>Importer le backup v40</Text>
        <Text style={{ color: C.ink3, fontSize: 12, marginTop: 2 }}>Fichier JSON exporté depuis la PWA</Text>
      </Pressable>

      <Text style={{ color: C.ink3, fontSize: 13, marginTop: 8, marginBottom: 16 }}>
        Biblio, programmes et groupes musculaires : en cours de portage (étape 6).
      </Text>

      <Pressable onPress={() => supabase.auth.signOut()} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ color: C.ink3, textAlign: "center" }}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}
