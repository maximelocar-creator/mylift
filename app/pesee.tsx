// Pesée — route poussée (raccourci Profil / carte Stats). Contenu partagé
// avec la vue Pesée de l'onglet Stats (src/screens/PeseeSection.tsx).
import { ScrollView, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/lib/theme";
import PeseeSection from "@/screens/PeseeSection";

export default function Pesee() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10, minHeight: 44 }}>
        <Ionicons name="chevron-back" size={16} color={C.ink2} />
        <Text style={{ color: C.ink2, fontSize: 13, fontWeight: "600" }}>Retour</Text>
      </Pressable>
      <PeseeSection />
    </ScrollView>
  );
}
