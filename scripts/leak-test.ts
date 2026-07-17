// Test de fuite de données (critère de sortie Phase 2) — s'exécute contre la
// VRAIE prod avec la clé anon publique uniquement (donc soumis à la RLS,
// exactement comme l'app). Crée un compte NEUF et vérifie :
//   1. il voit les exercices seed (is_seed) dans la bibliothèque
//   2. il ne voit AUCUNE machine (exercise_models) d'un autre compte
//   3. il ne voit AUCUN log/pesée/post d'un compte privé non suivi
// Lancer : npm run test:leak
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error("✗ .env incomplet");
  process.exit(1);
}

const supabase = createClient(URL, ANON, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail: string) {
  if (ok) {
    passed++;
    console.log(`✓ ${label} — ${detail}`);
  } else {
    failed++;
    console.error(`✗ ${label} — ${detail}`);
  }
}

async function main() {
  // Compte NEUF
  const email = `mylift.leaktest.${Date.now()}@gmail.com`;
  const password = "LeakTest!" + Date.now();
  const { data: signup, error: signErr } = await supabase.auth.signUp({ email, password });
  if (signErr || !signup.session) {
    console.error("✗ Impossible de créer un compte de test :", signErr?.message ?? "pas de session (confirmation email active ?)");
    process.exit(1);
  }
  const uid = signup.user!.id;
  console.log(`Compte neuf créé : ${email} (${uid})\n`);

  // 1. Exercices seed visibles
  const seeds = await supabase.from("exercises").select("*", { count: "exact", head: true }).eq("is_seed", true);
  check("1. Bibliothèque seed visible", (seeds.count ?? 0) > 0, `${seeds.count ?? 0} exercices is_seed lisibles (erreur: ${seeds.error?.message ?? "aucune"})`);

  // 2. Aucune machine d'un autre compte
  const models = await supabase.from("exercise_models").select("*");
  const foreign = (models.data ?? []).filter((m) => m.owner_id !== uid);
  check(
    "2. Machines (exercise_models) étanches",
    !models.error && foreign.length === 0,
    models.error ? `erreur: ${models.error.message}` : `${models.data?.length ?? 0} lignes visibles, dont ${foreign.length} appartenant à autrui (attendu 0)`
  );

  // 3. Aucune donnée d'entraînement d'un compte privé non suivi
  const tables = ["workout_logs", "log_exercises", "log_sets", "workout_prs", "weights", "posts"];
  for (const t of tables) {
    const res = await supabase.from(t).select("*").limit(50);
    if (res.error) {
      // table absente ou refus total : pas une fuite
      check(`3. ${t} étanche`, true, `accès refusé/absent (${res.error.message})`);
      continue;
    }
    const rows = res.data ?? [];
    const ownerKey = rows.length ? ("owner_id" in rows[0] ? "owner_id" : "user_id" in rows[0] ? "user_id" : "author_id" in rows[0] ? "author_id" : null) : null;
    const foreignRows = ownerKey ? rows.filter((r: any) => r[ownerKey] !== uid) : rows;
    check(`3. ${t} étanche`, foreignRows.length === 0, `${rows.length} lignes visibles, dont ${foreignRows.length} d'autrui (attendu 0)`);
  }

  // Profils publics : lecture minimale attendue (username), c'est voulu — juste un constat
  const profs = await supabase.from("profiles").select("*", { count: "exact", head: true });
  console.log(`\n(Info : ${profs.count ?? 0} profils publics lisibles — comportement attendu pour la découverte.)`);

  console.log(`\nRésultat : ${passed} OK, ${failed} FUITE(S)`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("✗ Erreur inattendue :", e);
  process.exit(1);
});
