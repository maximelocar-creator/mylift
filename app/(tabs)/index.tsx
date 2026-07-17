// Dashboard — construit à l'étape 5 (KPI hero, streak, tonnage, index muscles).
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/lib/theme";
import { useData } from "@/lib/store";

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { journalLogs, ready } = useData();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12 }}>
      <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1, color: C.ink0, marginBottom: 16 }}>
        My<Text style={{ color: C.accent }}>Lift</Text>
      </Text>
      <View style={{ padding: 20, backgroundColor: C.bg1, borderRadius: 16 }}>
        <Text style={{ color: C.ink2 }}>
          {ready ? `${journalLogs.length} séances chargées. Dashboard en cours de portage (étape 5).` : "Chargement…"}
        </Text>
      </View>
    </ScrollView>
  );
}
