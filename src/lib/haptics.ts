// Retour haptique — port du haptic() de v40 (navigator.vibrate) vers expo-haptics.
// Mêmes intentions : light/medium/heavy pour les gestes, success/warning pour
// les issues. Aucune action importante ne doit être silencieuse.
import * as Haptics from "expo-haptics";

export function haptic(kind: "light" | "medium" | "heavy" | "success" | "warning" | "error" = "light") {
  try {
    switch (kind) {
      case "light":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case "medium":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case "heavy":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case "success":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case "warning":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case "error":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // pas de haptique dispo (simulateur, web) — silencieux
  }
}
