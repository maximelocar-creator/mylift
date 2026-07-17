// Détail exercice — route poussée (transition push/pop native iOS).
import { useLocalSearchParams, useRouter } from "expo-router";
import ExoDetail from "@/screens/ExoDetail";

export default function ExoRoute() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  return <ExoDetail keyId={decodeURIComponent(String(key))} onBack={() => router.back()} />;
}
