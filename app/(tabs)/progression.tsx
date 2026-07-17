// Progrès / Analyse — construit à l'étape 5 (toggle Muscles/Exos, détails).
import { Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/lib/theme";

export default function Progression() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12 }}>
      <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0, marginBottom: 16 }}>Progrès.</Text>
      <Text style={{ color: C.ink2 }}>Analyse en cours de portage (étape 5).</Text>
    </ScrollView>
  );
}
