// Pesée — construit à l'étape 6.
import { Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/lib/theme";

export default function Pesee() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12 }}>
      <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0, marginBottom: 16 }}>Pesée.</Text>
      <Text style={{ color: C.ink2 }}>Écran en cours de portage (étape 6).</Text>
    </ScrollView>
  );
}
