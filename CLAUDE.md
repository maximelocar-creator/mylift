# MyLift V2 — Contexte projet (lu automatiquement par Claude Code)

## C'est quoi

App de suivi musculation, portage de la PWA React "MyLift v40" (~11 000 lignes,
1 fichier) vers une app iOS native. Stack : Expo (React Native) + TypeScript +
Supabase (Postgres + Auth + RLS). Utilisateur non-développeur (Maxime) —
il pilote via Claude (chat) + Claude Code (ce terminal). Ne jamais lui demander
d'écrire du code ou de choisir entre des options techniques équivalentes :
trancher soi-même et expliquer la conséquence en langage simple si besoin.

## État actuel (Phase 0)

- Auth email/mdp fonctionnelle (`app/login.tsx`)
- Import du backup v40 vers Supabase avec rapport de parité affiché à l'écran
  (`src/db/importBackup.ts`, `app/home.tsx`)
- Schéma Supabase complet + RLS déjà appliqués en prod (`supabase/migrations/`)
- SDK Expo : **54** (aligné sur la version d'Expo Go installée sur l'iPhone de
  Maxime — ne jamais downgrade sans vérifier avec lui d'abord)

## Lancer le projet

Le `-c` vide le cache Metro (à faire systématiquement après un changement de
version de dépendance — source de la plupart des erreurs "module introuvable").
Testé via Expo Go sur iPhone (pas de simulateur Mac disponible — Maxime n'a pas
de Mac). Si erreur de version SDK affichée sur le téléphone : la version
installée d'Expo Go fait foi, aligner `package.json` dessus, pas l'inverse.

## Invariants métier — NE JAMAIS DÉVIER

Toute la logique de calcul (PR, index de progression, e1RM) doit être portée
**à l'identique** depuis `app.jsx` (v40, fourni dans le projet Claude si besoin
de comparer). Ne pas "améliorer" ces fonctions.

- `exoKey(ex) = 'lib:'+exId + ('/m:'+modelId si présent)`, sinon `'name:'+slug`.
  Accepte `modelId` (logs) OU `activeModelId` (séance live) — même concept.
- e1RM = Epley : `poids × (1 + reps/30)`
- PR All-Time = nouveau poids max jamais touché (jamais sur la 1ère série d'un
  exo — pas de baseline = pas de PR)
- PR Rep = à un poids déjà touché, plus de reps que jamais à ce poids exact
- Index de progression = e1RM / baseline(premier point) × 100, moyenné par
  date, lissé sur moyenne mobile 7 séances

## Décisions verrouillées (ne pas rouvrir sans validation explicite de Maxime)

- IDs conservés tels quels à la migration (pas d'UUID régénérés)
- Pas de notion "à jeun" sur les pesées (`weights` — champ supprimé du schéma)
- Préférences d'affichage UI (dash_hero, période sélectionnée, etc.) : locales
  au device, jamais synchronisées sur Supabase
- Logs de séance immuables après validation (trigger SQL qui bloque tout
  UPDATE — le DELETE par l'owner reste permis)
- `exercise_models` (machines) : jamais lisibles par un autre utilisateur, même
  en RLS super permissive ailleurs — c'est la donnée la plus privée de l'app

## Secrets / clés

- `.env` contient l'URL Supabase + la clé **anon/publishable** (volontairement
  publique, protégée par RLS côté serveur — ok de la committer)
- Ne JAMAIS ajouter la clé `service_role`/secret nulle part dans ce dépôt

## Style de travail attendu

Direct, factuel, sans blabla. Corrige les erreurs en itérant seul (relance,
ajuste, revérifie) plutôt que de proposer plusieurs pistes à valider — sauf
choix structurant qui touche aux invariants ci-dessus, où là il faut arrêter et
demander confirmation.
