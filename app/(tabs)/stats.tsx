// Stats — fusion Dashboard + Analyse en UN écran : vue d'ensemble en haut
// (KPI hero, streak, PRs, volume, pesée), puis l'analyse détaillée (toggle
// Muscles/Exos, courbes) dans le même scroll. Même source de calcul
// (src/lib/stats.ts), rien n'est recalculé différemment.
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/lib/theme";
import { useData } from "@/lib/store";
import { useActiveSession } from "@/lib/activeSession";
import { ScreenSkeleton } from "@/ui/kit";
import DashboardSection from "@/screens/DashboardSection";
import AnalyseSection from "@/screens/AnalyseSection";

export default function Stats() {
  const insets = useSafeAreaInsets();
  const { ready } = useData();
  const { activeSession } = useActiveSession();
  const bottomPad = 24 + (activeSession ? 64 : 0);

  if (!ready) return <ScreenSkeleton paddingTop={insets.top + 12} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg0 }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: bottomPad }}>
      <DashboardSection />
      <AnalyseSection />
    </ScrollView>
  );
}
