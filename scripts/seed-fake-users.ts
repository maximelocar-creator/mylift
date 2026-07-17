// Seed de FAUX UTILISATEURS de test (outil interne) — crée des comptes réels
// via l'API publique (clé anon, soumis à la RLS comme l'app) :
//   npm run seed:fake            → crée les fakes (profil + demande de follow
//                                   vers la cible + posts)
//   npm run seed:fake -- accept  → les fakes acceptent les demandes reçues
//                                   (à lancer APRÈS avoir envoyé tes demandes)
// Cible par défaut : username "maxime" (modifiable : -- seed <username>).
// Credentials des fakes persistés dans scripts/.fake-users.json (gitignoré).
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
const CREDS_FILE = "scripts/.fake-users.json";

const FAKES = [
  {
    username: "alex_lifts", ville: "Lyon", bio: "Powerlifting & café. SBD 500kg un jour.",
    posts: [
      { type: "lift", title: "Squat 150×3 — nouveau PR 🎉", lift_ref: { exName: "Squat libre", weight: 150, reps: 3, prType: "all-time" } },
      { type: "session", title: "Lower A bouclée", text: "Retour de deload, ça pousse fort 💪 12,4 t de tonnage." },
    ],
  },
  {
    username: "sofia.gains", ville: "Bordeaux", bio: "Hypertrophie · coach en devenir",
    posts: [
      { type: "session", title: "Push day terminé", text: "Les épaules en feu 🔥 Nouvelle machine incliné convergent = game changer." },
      { type: "lift", title: "Développé militaire 40×8", lift_ref: { exName: "Militaire haltères", weight: 40, reps: 8, prType: "rep" } },
    ],
  },
  {
    username: "marc_pr", ville: "Paris", bio: "Je soulève le lundi. Et les autres jours aussi.",
    posts: [
      { type: "lift", title: "120 kg au couché, enfin.", lift_ref: { exName: "Développé couché barre", weight: 120, reps: 1, prType: "all-time" }, text: "2 ans que je le visais." },
      { type: "session", title: "Legs écourtée, tonnage record quand même", text: "45 min chrono, 9,8 t." },
    ],
  },
];

type Cred = { email: string; password: string; userId: string; username: string };

function loadCreds(): Cred[] {
  try {
    return JSON.parse(fs.readFileSync(CREDS_FILE, "utf-8"));
  } catch {
    return [];
  }
}
function saveCreds(c: Cred[]) {
  fs.writeFileSync(CREDS_FILE, JSON.stringify(c, null, 2));
}

const uid = () => "id-" + Math.random().toString(36).slice(2, 9) + "-" + Date.now();

// Schéma réel (sondé) : posts(id text, owner_id, type, log_id, lift_ref jsonb,
// title, text, image_url, created_at)
async function insertPost(sb: any, ownerId: string, post: { type: string; title: string; text?: string; lift_ref?: any }): Promise<string> {
  const { error } = await sb.from("posts").insert({
    id: uid(),
    owner_id: ownerId,
    type: post.type,
    title: post.title,
    text: post.text ?? null,
    lift_ref: post.lift_ref ?? null,
  });
  return error ? "ÉCHEC: " + error.message : "ok";
}

async function main() {
  const mode = process.argv[2] === "accept" ? "accept" : "seed";
  const targetUsername = process.argv[3] || "maxime";

  if (mode === "accept") {
    const creds = loadCreds();
    if (!creds.length) {
      console.error("Aucun fake enregistré (lance d'abord le mode seed).");
      process.exit(1);
    }
    for (const c of creds) {
      const sb = createClient(URL, ANON, { auth: { persistSession: false } });
      const { error } = await sb.auth.signInWithPassword({ email: c.email, password: c.password });
      if (error) {
        console.error(`✗ ${c.username}: login impossible (${error.message})`);
        continue;
      }
      const { data: pend } = await sb.from("follows").select("*").eq("following_id", c.userId).eq("status", "pending");
      for (const p of pend ?? []) {
        const { error: accErr } = await sb.from("follows").update({ status: "accepted" }).eq("follower_id", p.follower_id).eq("following_id", c.userId);
        console.log(accErr ? `✗ ${c.username} accepte ${p.follower_id}: ${accErr.message}` : `✓ ${c.username} a accepté la demande de ${p.follower_id}`);
      }
      if (!pend?.length) console.log(`· ${c.username}: aucune demande en attente`);
    }
    return;
  }

  // --- mode seed ---
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: targetProfile } = await anon.from("profiles").select("*").ilike("username", targetUsername).maybeSingle();
  if (!targetProfile) {
    const { data: all } = await anon.from("profiles").select("username");
    console.error(`✗ Cible "${targetUsername}" introuvable. Profils existants: ${(all ?? []).map((p: any) => p.username).join(", ")}`);
    process.exit(1);
  }
  console.log(`Cible : @${targetProfile.username} (${targetProfile.id})\n`);

  const creds = loadCreds();
  for (const f of FAKES) {
    let cred = creds.find((c) => c.username === f.username);
    const sb = createClient(URL, ANON, { auth: { persistSession: false } });

    if (cred) {
      const { error } = await sb.auth.signInWithPassword({ email: cred.email, password: cred.password });
      if (error) {
        console.error(`✗ ${f.username}: login impossible (${error.message})`);
        continue;
      }
      console.log(`· ${f.username}: compte existant réutilisé`);
    } else {
      const email = `mylift.fake.${f.username.replace(/[^a-z0-9]/g, "")}.${Date.now()}@gmail.com`;
      const password = "FakeUser!" + Math.random().toString(36).slice(2, 10);
      const { data: signup, error } = await sb.auth.signUp({ email, password });
      if (error || !signup.session) {
        console.error(`✗ ${f.username}: création impossible (${error?.message ?? "pas de session"})`);
        continue;
      }
      cred = { email, password, userId: signup.user!.id, username: f.username };
      creds.push(cred);
      saveCreds(creds);
      console.log(`✓ ${f.username}: compte créé (${cred.userId})`);
    }

    // Profil D'ABORD (follows a une FK sur profiles) — colonne réelle : ville
    const { error: profErr } = await sb.from("profiles").upsert({ id: cred.userId, username: f.username, ville: f.ville, bio: f.bio });
    console.log(profErr ? `  ✗ profil: ${profErr.message}` : `  ✓ profil complété (${f.ville})`);
    // Nettoyage d'un éventuel post de sonde
    await sb.from("posts").delete().eq("id", "test");

    // Demande de follow vers la cible (si pas déjà)
    const { data: existing } = await sb.from("follows").select("*").eq("follower_id", cred.userId).eq("following_id", targetProfile.id).maybeSingle();
    if (!existing) {
      const { error: folErr } = await sb.from("follows").insert({ follower_id: cred.userId, following_id: targetProfile.id, status: "pending" });
      console.log(folErr ? `  ✗ demande de follow: ${folErr.message}` : `  ✓ demande de follow envoyée à @${targetProfile.username}`);
    } else {
      console.log(`  · follow déjà ${existing.status}`);
    }

    // Posts (idempotence sommaire : skip si déjà ≥ 2 posts)
    const { count } = await sb.from("posts").select("*", { count: "exact", head: true }).eq("owner_id", cred.userId);
    if ((count ?? 0) >= 2) {
      console.log(`  · posts déjà présents (${count})`);
    } else {
      for (const post of f.posts) {
        const res = await insertPost(sb, cred.userId, post);
        console.log(`  ${res === "ok" ? "✓" : "✗"} post "${post.title.slice(0, 40)}" → ${res}`);
      }
    }
  }

  console.log(`\nSuite du test :
1. Dans l'app : cloche du Feed → accepte les demandes des fakes.
2. Envoie-leur une demande de follow (recherche "alex", "sofia", "marc").
3. Relance : npm run seed:fake -- accept  → ils acceptent tes demandes.
4. Leurs posts apparaîtront dans ton feed.`);
}

main().catch((e) => {
  console.error("Erreur inattendue:", e);
  process.exit(1);
});
