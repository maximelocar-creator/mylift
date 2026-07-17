// Détail muscle — route poussée (transition push/pop native iOS).
import { useLocalSearchParams, useRouter } from "expo-router";
import MuscleDetail from "@/screens/MuscleDetail";

export default function MuscleRoute() {
  const { group, period } = useLocalSearchParams<{ group: string; period?: string }>();
  const router = useRouter();
  return (
    <MuscleDetail
      muscleGroup={decodeURIComponent(String(group))}
      initialPeriodDays={period ? parseInt(String(period)) : 90}
      onBack={() => router.back()}
      onOpenExo={(key) => router.push(`/exo/${encodeURIComponent(key)}`)}
    />
  );
}
