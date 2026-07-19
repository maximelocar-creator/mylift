// Temps de repos CIBLE par défaut du timer de séance — préférence locale au
// device, par compte (décision verrouillée : les préférences UI ne sont
// jamais synchronisées sur Supabase). C'est cette valeur qui initialise le
// timer d'une nouvelle séance et sur laquelle Reset retombe ; les +30s en
// séance restent ponctuels. Bornes 30 s – 5 min, pas de 15 s, défaut 2 min
// (comportement v40 conservé si jamais réglé).
import AsyncStorage from "@react-native-async-storage/async-storage";

export const REST_TARGET_DEFAULT = 120;
export const REST_TARGET_MIN = 30;
export const REST_TARGET_MAX = 300;
export const REST_TARGET_STEP = 15;

const key = (uid: string) => "mylift_rest_target:" + uid;

export async function getRestTarget(uid: string): Promise<number> {
  try {
    const v = parseInt((await AsyncStorage.getItem(key(uid))) ?? "", 10);
    if (!isNaN(v) && v >= REST_TARGET_MIN && v <= REST_TARGET_MAX) return v;
  } catch {}
  return REST_TARGET_DEFAULT;
}

export async function setRestTarget(uid: string, seconds: number): Promise<void> {
  const v = Math.min(REST_TARGET_MAX, Math.max(REST_TARGET_MIN, Math.round(seconds / REST_TARGET_STEP) * REST_TARGET_STEP));
  await AsyncStorage.setItem(key(uid), String(v));
}

export function formatRestTarget(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
