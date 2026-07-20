// Stats — UNE vue affichée à la fois, switch en un clic :
// Dashboard (vue d'ensemble) · Surcharge (analyse/progression) · Pesée.
// Préférence locale au device (décision verrouillée). Même source de calcul
// (src/lib/stats.ts) pour Dashboard et Surcharge — rien n'est recalculé.
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeIn } from "react-native-reanimated";
import { C } from "@/lib/theme";
import { useData } from "@/lib/store";
import { useActiveSession } from "@/lib/activeSession";
import { ScreenSkeleton, Segment } from "@/ui/kit";
import DashboardSection from "@/screens/DashboardSection";
import AnalyseSection from "@/screens/AnalyseSection";
import PeseeSection from "@/screens/PeseeSection";

type StatsView = "dashboard" | "surcharge" | "pesee";

export default function Stats() {
  const insets = useSafeAreaInsets();
  const { ready } = useData();
  const { activeSession } = useActiveSession();
  const bottomPad = 24 + (activeSession ? 64 : 0);
  const [view, setView] = useState<StatsView>("dashboard");

  // Lu à chaque focus : permet à « Ta semaine » du Feed d'écrire "dashboard"
  // puis de naviguer ici (source de vérité = la préférence stockée).
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("mylift_stats_view").then((v) => {
        if (v === "dashboard" || v === "surcharge" || v === "pesee") setView(v);
      });
    }, [])
  );
  const pick = (v: StatsView) => {
    setView(v);
    AsyncStorage.setItem("mylift_stats_view", v).catch(() => {});
  };

  if (!ready) return <ScreenSkeleton paddingTop={insets.top + 12} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: bottomPad }}>
      <View style={{ marginBottom: 4 }}>
        <Segment
          value={view}
          onChange={pick}
          options={[
            { value: "dashboard", label: "Dashboard" },
            { value: "surcharge", label: "Surcharge" },
            { value: "pesee", label: "Pesée" },
          ]}
        />
      </View>
      <Animated.View key={view} entering={FadeIn.duration(200)}>
        {view === "dashboard" && <DashboardSection />}
        {view === "surcharge" && <AnalyseSection />}
        {view === "pesee" && <PeseeSection />}
      </Animated.View>
    </ScrollView>
  );
}
