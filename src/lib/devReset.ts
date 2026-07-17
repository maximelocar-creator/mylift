// Outil de TEST interne (Maxime) : le compte test@test.fr repart de zéro à
// chaque déconnexion, pour rejouer le parcours première connexion à volonté.
// La RLS interdit de supprimer/vider la ligne profiles (username NOT NULL +
// contrainte de format) : on efface donc toutes les DONNÉES serveur + les
// champs optionnels du profil, et un drapeau local force le repassage par
// l'onboarding au prochain login. Strictement limité à cet email — aucun
// effet pour un compte normal. À retirer avant la mise en production.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { resetLocalDb } from "../db/local";

export const TEST_RESET_EMAIL = "test@test.fr";

export const redoOnboardingKey = (uid: string) => "mylift_redo_onboarding:" + uid;

export async function devResetIfTestAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user || user.email !== TEST_RESET_EMAIL) return;
  const uid = user.id;

  // Données serveur (les enfants suivent par ON DELETE CASCADE) — best effort
  const owned: Array<[string, string]> = [
    ["posts", "owner_id"],
    ["workout_logs", "owner_id"],
    ["weights", "owner_id"],
    ["programs", "owner_id"],
    ["exercise_models", "owner_id"],
    ["exercises", "owner_id"],
    ["muscle_groups", "owner_id"],
    ["sub_groups", "owner_id"],
    ["session_notes", "owner_id"],
    ["notifications", "user_id"],
    ["notifications", "owner_id"],
  ];
  for (const [table, col] of owned) {
    try {
      await supabase.from(table).delete().eq(col, uid);
    } catch {}
  }
  try {
    await supabase.from("follows").delete().eq("follower_id", uid);
    await supabase.from("follows").delete().eq("following_id", uid);
  } catch {}
  try {
    await supabase.from("profiles").update({ ville: null, bio: null, avatar_url: null, current_program_id: null }).eq("id", uid);
  } catch {}

  await AsyncStorage.setItem(redoOnboardingKey(uid), "1");
  await resetLocalDb();
}
