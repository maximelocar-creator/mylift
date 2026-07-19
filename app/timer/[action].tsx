// Cible des deep links mylift://timer/start|stop|reset émis par les boutons
// de la Live Activity (écran verrouillé / île étendue). L'app s'ouvre sur la
// séance en cours et exécute la commande — bufferisée si l'écran de séance
// n'est pas encore monté (liveActivity.onTimerCommand).
import { Redirect, useLocalSearchParams } from "expo-router";
import { emitTimerCommand, type TimerCommand } from "@/lib/liveActivity";

export default function TimerAction() {
  const { action } = useLocalSearchParams<{ action: string }>();
  if (action === "start" || action === "stop" || action === "reset") {
    emitTimerCommand(action as TimerCommand);
  }
  return <Redirect href="/journal" />;
}
