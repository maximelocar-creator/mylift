# MyLift V2 — Contexte projet (lu automatiquement par Claude Code)

## C'est quoi

App de suivi musculation, portage de la PWA React "MyLift v40" (~11 000 lignes,
1 fichier) vers une app iOS native. Stack : Expo (React Native) + TypeScript +
Supabase (Postgres + Auth + RLS). Utilisateur non-développeur (Maxime) —
il pilote via Claude (chat) + Claude Code (ce terminal). Ne jamais lui demander
d'écrire du code ou de choisir entre des options techniques équivalentes :
trancher soi-même et expliquer la conséquence en langage simple si besoin.

## État actuel (Phase 1 avancée)

- Phase 0 terminée : auth email/mdp, import backup v40 avec rapport de parité,
  schéma Supabase + RLS en prod
- Phase 1 quasi complète : 5 onglets (Dashboard/Journal/Progrès/Pesée/Réglages),
  séance live complète, SQLite offline-first + queue de sync, édition de
  programme, générateur auto (port testé en parité), cibles de volume, focus
  muscles, CRUD groupes musculaires et machines, courbes premium (tracé
  progressif + morph + scrubber UI-thread), haptics, sheets spring, skeletons
- Couche logique : `src/core/mylift.ts`, 229 checks de parité différentielle
  contre le vrai app.jsx (`npm run test:core`) — à maintenir verts
- SDK Expo : **54** (aligné sur la version d'Expo Go installée sur l'iPhone de
  Maxime — ne jamais downgrade sans vérifier avec lui d'abord)

## Lancer le projet

Le `-c` vide le cache Metro (à faire systématiquement après un changement de
version de dépendance — source de la plupart des erreurs "module introuvable").
Testé via Expo Go sur iPhone (pas de simulateur Mac disponible — Maxime n'a pas
de Mac). Si erreur de version SDK affichée sur le téléphone : la version
installée d'Expo Go fait foi, aligner `package.json` dessus, pas l'inverse.

Pièges appris sur ce projet (ne pas re-payer) :
- Modules natifs : la version JS doit matcher le natif embarqué dans Expo Go —
  vérifier `node_modules/expo/bundledNativeModules.json`. Exemple vécu :
  react-native-worklets doit rester épinglé à 0.5.1 (reanimated tire sinon une
  0.8.x → "Exception in HostFunction" à l'import, toutes les routes cassées
  avec de faux "missing default export").
- Le watcher Metro ne voit pas les dossiers créés/paquets installés pendant
  qu'il tourne → redémarrer avec `-c` après un npm install ou un nouveau
  dossier source.
- Metro lancé en arrière-plan sans TTY n'affiche pas le QR code : utiliser
  `script -qfec "npx expo start --tunnel -c" <log>` (le `-f` = flush).
- Vérifier un bundle iOS sans téléphone :
  `curl "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true"`
  (HTTP 200 = compile, 500 = l'erreur est dans le corps de la réponse).
- Modals iOS : présenter une Modal pendant qu'une autre joue son animation de
  fermeture échoue SILENCIEUSEMENT. Pour enchaîner deux sheets, toujours passer
  par `afterSheetClose()` (src/ui/kit.tsx). Deux sheets empilées (l'une par-
  dessus l'autre) fonctionnent ; c'est le swap rapide qui casse.

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

## Feuille de route

Objectif final : publication App Store complète. Maxime a tranché : pas de
sortie par palier, tout le social doit être prêt avant la première soumission
publique. Chaque phase se termine par un test interne réel (Expo Go pendant le
dev, TestFlight dès que possible) avec un rapport de vérification factuel
(comptages en base, résultats de tests, pas une affirmation non vérifiée) —
pas de passage à la phase suivante sans validation explicite de Maxime.

### Phase 0 — Fondations (terminée)
- Auth Supabase email/mot de passe (confirmation email désactivée en dev)
- Schéma complet en prod : profiles, follows, posts, likes, comments,
  notifications, exercises, user_exercise_overrides, exercise_models,
  programs, program_sessions, program_exercises, program_model_targets,
  workout_logs (immuable via trigger), log_exercises, log_sets, workout_prs,
  weights, session_notes, muscle_groups, sub_groups — RLS sur chaque table
  (voir supabase/migrations/0002_rls.sql pour le détail des policies)
- Import backup v40 → Supabase avec recomptage de parité affiché à l'écran
  (exercices, machines, programmes, séances, séries, PRs, pesées, tonnage
  total en kg)
- Décisions verrouillées à ne jamais rouvrir sans validation explicite :
  IDs conservés tels quels, pas de champ "à jeun" sur les pesées, préférences
  UI locales au device (jamais en base), logs immuables après validation,
  machines (exercise_models) strictement privées (jamais lisibles par un
  autre compte, même dans un scénario social ouvert)

### Phase 1 — Solo complet (en cours)
Port fidèle du parcours individuel depuis v40-reference/app.jsx. C'est une
spécification qui marche, pas un brouillon — toute divergence de comportement
doit être un choix explicite validé, jamais une approximation.

**Couche logique (src/core/mylift.ts)** — fonctions pures, testées
unitairement contre des cas réels tirés de app.jsx avant de construire quoi
que ce soit dessus :
- `exoKey` / `exoKeyNoModel` : identité exo×machine, format `lib:<exId>` (+
  `/m:<modelId>` si présent) ou `name:<slug>` en fallback ; accepte `modelId`
  (logs) et `activeModelId` (séance live) comme équivalents
- `e1RM` (Epley, poids×(1+reps/30), fiable jusqu'à ~12 reps)
- `scanExoPRs` : scan chronologique (tri date puis id), All-Time PR = nouveau
  poids max avec EPS 0.05, jamais sur la toute première série d'un exo ; Rep
  PR = poids déjà touché ET reps > max observé à ce poids exact ; les deux
  indépendants, source de vérité (workout_prs n'est qu'un cache d'affichage)
- `muscleIndexTimeline` / `muscleIndexSummary` : baseline = e1RM du premier
  point de la période = 100, indices suivants = e1RM/baseline×100, moyenne
  par date, lissage moyenne mobile fenêtre 7 (rétrécie en début de série),
  delta = indice lissé final − 100, calculé uniquement sur les exo×models à
  ≥2 points
- `progressionSummary`, `computeVolumeTargets`, `splitVolumeBySubGroups`,
  `recommendedSession`, `hydrateSessionExos`, `exoMuscleGroup` (résolution :
  lib d'abord, puis snapshot, puis match par nom — ordre à préserver)

**Couche données locale** : expo-sqlite en miroir exact du schéma Supabase.
Écriture locale d'abord systématiquement, queue de sync en arrière-plan vers
Supabase (LWW en cas de conflit). Une séance en cours ne doit jamais pouvoir
se perdre en cas de coupure réseau ou de fermeture d'app.

**Écran Journal**
- Liste chronologique des séances passées (depuis SQLite local, pas
  d'attente réseau)
- Lancement d'une séance depuis un programme existant → hydrateSessionExos
- Édition/suppression d'une séance loguée (delete autorisé par l'owner,
  update bloqué par le trigger d'immuabilité côté serveur — gérer ce cas
  proprement côté UI, jamais un crash silencieux)

**Écran Séance live** (le plus critique, reproduire précisément la v40) :
- Header compact 1 ligne : retour vers journal, dot vert indiquant séance
  active, nom de la séance, chrono global, bouton Annuler rouge, bouton Fin
  orange
- Carte exo compacte : tap ouvre une popup ; variantes planifiées visibles
  sous forme "ou X", "ou Y" en orange (--accent-hi), max 2 visibles puis
  "ou N autres" ; pas de swipe, pas de barre de pills
- Popup exo unifiée : section Variantes (radio select sur les choix du
  programme + bouton "Ajouter variante biblio" avec picker filtré par muscle
  group) + section Séance (liste de tous les exos de la séance en cours,
  navigation directe)
- Timer de repos : gros, central, cible 2 minutes par défaut, ajustable par
  +30s, progress bar visuelle, démarrage TOUJOURS manuel (jamais automatique
  au clic sur valider une série)
- Ligne "la dernière fois : ..." recalculée dynamiquement à chaque switch de
  variante (pas mise en cache au chargement de l'écran)
- Séries empilées verticalement, validation une à une, série suivante
  verrouillée (grisée, non interactive) tant que la précédente n'est pas
  validée
- Cibles de poids NON affichées dans la popup variantes (juste le nom de
  l'exo/la machine)
- Aucun hint "tap pour ouvrir" — l'UI doit être auto-évidente
- Fin de séance : écran de récap post-séance avec les PRs mis en avant

**Écran Progrès + Dashboard (fusionnés, une seule source de calcul)** — FAIT :
src/lib/stats.ts (usePeriodStats/useWeekStats) est l'unique point de calcul,
les deux écrans consomment les mêmes sélecteurs mémoïsés. Si un chiffre
apparaît sur les deux (tonnage, streak, nombre de séances), il vient du même
appel à src/core/mylift.ts, jamais recalculé deux fois.
- Dashboard : KPI hero switchable par l'utilisateur, séances de la semaine,
  PRs récents, volume, streak, carte Pesée cliquable menant à l'écran Pesée
- Progrès / Analyse : toggle Muscles / Exos
  - Vue Muscle : tabs sous-muscles, courbe lissée orange + courbe brute en
    superposition, gradient area fill sous la courbe, baseline pointillée à
    l'indice 100, scrubber tactile pour lire un point précis
  - Vue Exo (ExoDetail) : courbe par model individuel + onglet "Tout" avec
    courbe index unifiée (même composant que MuscleDetailChart), "Tout" par
    défaut si l'exo a plusieurs models enregistrés

**Écran Pesée** : liste chronologique, graphique, delta entre pesées,
ajout/édition/suppression (pas de notion "à jeun" — décision verrouillée)

**Édition de programme** — FAIT (app/program/[id].tsx, port de ParamsProgram
v40) : CRUD complet sur programs/program_sessions/program_exercises/
program_model_targets — séances (ajout/rename/suppression), exos (ajout via
picker recherche+filtre muscle, réordonnancement, déplacement inter-séances,
suppression), stepper séries 1-6, cibles kg ou par machine, variantes
planifiées (principale ★ + ajout biblio même muscle). Écritures via
store.updateProgram (copie mutée → diff SQLite + queue de sync).
Restent à porter : générateur auto (GeneratorForm) et éditeur de focus
muscles (EditMuscleStatusSheet) — passe dédiée plus tard.

**Réglages** : bibliothèque d'exercices (liste, ajout, rename avec
propagation du nouveau nom aux snapshots journalLogs/programs/activeSession,
zéro perte de données), gestion des groupes/sous-groupes musculaires, accès
à l'import backup (voir plus bas). Peut rester plus sommaire que les écrans
ci-dessus dans cette passe — fonctionnel mais pas peaufiné, on itère après.

**Statut du parcours d'entrée actuel — à ne pas confondre avec l'onboarding
définitif** : l'écran d'import backup existant est un outil de migration
interne, utilisé uniquement par Maxime pour rapatrier son historique v40.
Ce n'est PAS le parcours prévu pour un futur utilisateur qui n'a jamais rien
sur MyLift. Pour cette phase : isoler l'import derrière un point d'accès
discret et séparé (ex. lien en bas de l'écran de login, jamais une étape
obligatoire), sans lui donner le même niveau de finition que le login
standard. Le vrai onboarding grand public (créer un compte → créer son
premier programme depuis zéro → premier lancement guidé) est un chantier de
la Phase 2, pas de maintenant.

**UI/UX — doit se sentir natif Apple, pas porté du web** — passe Revolut
faite : courbes en tracé progressif au montage + morph point-à-point au
changement de période + scrubber/tooltip sur le thread UI (react-native-svg +
Reanimated, pas de Skia pour ne pas risquer un mismatch natif Expo Go),
dashboard en stagger + count-up. Exigences d'origine :
- Transitions d'écran natives (push/pop iOS standard via
  expo-router/react-native-screens), jamais un fade générique géré à la main
- Bottom sheets en spring physique (react-native-reanimated +
  react-native-gesture-handler), drag-to-dismiss avec rubber-band en fin de
  course — reproduire le comportement CSS de la v40, pas l'approximer
  (plugin reanimated déclaré en dernier dans babel.config.js, exigence
  stricte de la lib)
- Retour haptique (expo-haptics) sur validation de série, sur détection de
  PR, sur swipe de suppression — aucune action importante silencieuse
- Jamais d'écran blanc ou de spinner nu pendant un chargement : skeleton
  screens ou transition douce
- Indicateur de statut réseau/sync discret et non intrusif (synchronisé / en
  cours / hors ligne) — l'app a maintenant un backend, ça doit se sentir
  sans être anxiogène
- Tous les styles via src/lib/theme.ts (tokens DA : bg0-3, ink0-3, accent,
  accentHi, accentLo, gold, success, danger, rayons, durées de spring),
  aucune couleur en dur ; étendre ce fichier plutôt que hardcoder dans les
  composants
- Chiffres en tabular-nums partout, touch targets ≥44px minimum

### Phase 2 — Profils et découverte
ÉTAT : FAIT — nav 4 onglets (Feed accueil/Journal/Stats/Profil, notifs =
cloche+badge sur le header du Feed), Stats en 3 vues commutables
(Dashboard/Surcharge/Pesée, préférence locale), profil + édition + QR,
recherche, profil autrui privé, feed minimal (posts des amis).
Test de fuite `npm run test:leak` (compte neuf réel) : 8/8 étanche.
Apple/Google câblés (src/lib/oauth.ts), à valider au premier build EAS.
Onboarding guidé : FAIT (app/onboarding.tsx) — gate dans app/(tabs)/_layout
(pas de username OU drapeau redoOnboarding → redirect onboarding) :
étape 1 profil (username avec vérif d'unicité live, ville, bio ≤160,
photo via le pipeline avatar partagé src/lib/images.ts), étape 2 premier
programme (auto → générateur, manuel → éditeur de programme), skippable,
étape 3 Bienvenue @username + carte "Ajouter des amis" (recherche) après
création du programme. L'import backup reste un outil interne isolé
(lien discret sous le login), hors du flow public.
Compte NEUF : aucune ligne muscle_groups/sub_groups en base → le
générateur n'aurait aucun muscle à afficher. Seed automatique de la
taxonomie v40 par défaut (repo.seedDefaultTaxonomyIfEmpty), déclenché
UNIQUEMENT après un pull confirmé vide (jamais de doublon pour un compte
existant sur un nouveau device), puis poussé via la queue de sync.
→ Phase 2 TERMINÉE (reste la validation Apple/Google au 1er build EAS).

IDENTITÉ / MIROIR LOCAL — deux bugs payés, ne pas les réintroduire :
1) profiles est lisible publiquement → le pull ne rapatrie QUE sa propre
   ligne (sync.ts), et repo.getProfile(userId) filtre par id (jamais de
   SELECT ... LIMIT 1 sans WHERE sur une table multi-comptes).
2) La SQLite locale est un fichier unique par device, tagué meta
   db_owner : au login d'un autre compte → resetLocalDb() complet avant
   toute lecture (sinon résidus d'affichage de l'ancien compte et queue
   de sync rejetée par la RLS qui gèle le pull du nouveau).

DÉCISION VERROUILLÉE (Maxime) — modèle AMIS, pas follow/follow-back :
une demande pending → acceptation → relation réciproque. Contraintes RLS
découvertes en prod : l'insert follows n'autorise que status=pending, et
la RLS des posts est directionnelle (on voit les posts de ceux qu'on suit
en accepted, pas de ceux qui nous suivent). D'où la réciprocité
AUTO-CONVERGENTE (src/db/social.ts) : accepter crée la demande inverse en
pending, et ensureReciprocity() à chaque refresh auto-accepte tout pending
entrant quand un lien accepted existe déjà. Ne pas "simplifier" ça sans
retester la visibilité des posts dans les deux sens.

SCHÉMA RÉEL sondé en prod (≠ suppositions) : profiles(id, username,
VILLE — pas city, bio, avatar_url, tier, current_program_id) ;
posts(id text client, owner_id, type 'lift'|'session', log_id,
lift_ref jsonb, title NOT NULL, text, image_url, created_at).
Avatar : upload Storage "avatars" en octets base64 (fetch(file://) non
fiable en RN), repli automatique en data-URI 256px si bucket absent.

Comptes de TEST seedés en prod (npm run seed:fake, creds dans
scripts/.fake-users.json gitignoré) : alex_lifts, sofia.gains, marc_pr —
amis réciproques avec @maxlocar, 2 posts chacun. Mode "accept" pour faire
accepter leurs demandes entrantes. À purger avant la mise en production.

Compte de test onboarding : test@test.fr / test1234 — remis à ZÉRO à
chaque déconnexion (src/lib/devReset.ts, strictement gaté sur cet email) :
delete serveur de toutes ses données (cascade), profil vidé (le username
reste : RLS interdit delete du profil + contrainte NOT NULL/format),
drapeau local redoOnboarding → rejoue l'onboarding au login suivant.
À retirer avant la mise en production. La base SQLite locale est UNIQUE
par device et taguée meta db_owner : changement de compte → wipe complet
automatique (résidus d'affichage + queue de sync d'un autre compte
seraient bloqués par la RLS et gèleraient le pull).


**Première expérience utilisateur (onboarding grand public)** — priorité forte
de la Phase 2. Aujourd'hui le parcours d'entrée est fait pour Maxime
uniquement (login brut + import de son backup). Il faut construire un vrai
premier lancement soigné pour quelqu'un qui découvre MyLift et n'a aucune
donnée. Étapes :

1. Création de compte — trois méthodes au choix :
   - Email + mot de passe
   - Sign in with Google
   - Sign in with Apple
   (Apple et Google nécessitent un build natif EAS, non testables en Expo Go —
   les câbler et les valider en même temps que le premier build custom.)

2. Création du profil : choix du username (unicité vérifiée), ville optionnelle,
   bio optionnelle, avatar optionnel ou photo de profil chargée depuis iphone. Écran soigné, pas un simple formulaire
   brut — c'est la première vraie impression de l'app.

3. Création du premier programme, deux voies proposées clairement :
   - Automatique : génération d'un programme adapté (via la logique `auto` /
     recommendedSession portée depuis la v40) à partir de quelques questions
     simples (fréquence, niveau, groupes prioritaires).
   - Manuelle : création guidée pas à pas de son premier programme (nommer →
     séances → exos → variantes → cibles), en réutilisant l'écran d'édition de
     programme porté depuis la v40.

4. Bibliothèque d'exercices de base : chaque nouvel utilisateur démarre avec la
   bibliothèque seed (les exercices canoniques `is_seed`, qui sont ceux de
   Maxime issus de la v40) MAIS sans aucune machine perso (exercise_models) —
   les machines sont strictement personnelles et propres à chaque compte, un
   nouvel utilisateur part avec zéro machine et crée les siennes au fur et à
   mesure. Vérifier que le seed global ne fuite jamais les models de Maxime
   (déjà garanti par la RLS owner-only sur exercise_models, mais à confirmer
   côté parcours de création de compte : un compte neuf ne doit voir que les
   exercices seed, pas les machines d'un autre).

Distinction à garder nette dans le code : l'écran d'import backup (outil
interne Maxime, isolé derrière un accès discret depuis la Phase 1) et ce nouvel
onboarding grand public sont deux parcours séparés. L'import ne fait pas partie
du flow d'un utilisateur normal.

- Onboarding grand public réel : création de compte → choix username → soit
  import d'un backup (cas Maxime) soit création d'un premier programme vide
  guidée (cas nouvel utilisateur)
- Profils publics minimaux : username, ville, bio (≤160 car.), avatar,
  compteurs (followers/following/séances) — lecture publique en RLS, pas
  d'exposition des données d'entraînement
- Recherche d'utilisateurs par username
- Follow/follower avec statut pending/accepted (compte privé par défaut,
  acceptation manuelle par le following)
- QR code de profil personnel pour se suivre en présentiel

### Phase 3 — Feed et partage
ÉTAT : cœur FAIT — PostCard unique (src/ui/PostCard.tsx : photo d'abord,
chiffres dessous — décision Maxime) partagé par feed/profil/profil ami/
détail (app/post/[id].tsx) ; composition de post
(src/screens/ComposePost.tsx) : opt-in depuis le récap ("Partager" → UN
SEUL post séance, PRs valorisés dedans via lift_ref.prList — décision
Maxime, pas de post PR séparé depuis le récap) + partage d'un lift isolé
depuis ExoDetail (lignes "Meilleurs poids") ; photos posts via le pipeline
image partagé (bucket "posts", repli data-URI) ; export Instagram intégré
post-publication (ShareCard tokens theme.ts, react-native-view-shot 1080px
→ expo-sharing, story 9:16 + carré). Les payloads lift_ref ne contiennent
JAMAIS de modelId/nom de machine (strippé à la composition).
Restent : likes/commentaires = Phase 4 (rien d'autre en 3).

- Création de post depuis le récap post-séance (partage opt-in, jamais
  automatique) ou depuis une carte PR spécifique
- Deux types de post : séance complète (log_id) ou lift ponctuel (lift_ref
  jsonb, exo+PR isolé)
- PHOTOS dans les posts (demandé par Maxime) : prise de photo à la volée
  (appareil photo) OU choix depuis la galerie au moment de publier, colonne
  posts.image_url déjà en place. Même pipeline que l'avatar : compression
  côté client max ~1080px JPEG avant upload (contrainte de coût), une seule
  image par post, affichée dans la carte du feed
- Feed chronologique des comptes suivis acceptés + ses propres posts
- Respect strict de la confidentialité des machines : un post peut montrer
  un exo et une performance, jamais le nom de la machine personnelle
  associée (exercise_models reste strictement privé même exposé via un post)
- Export Instagram (story + post), façon Strava : quand l'utilisateur partage un
  lift ou une séance, en plus de la publication dans le feed MyLift interne, un
  bouton propose d'exporter vers Instagram — en story ou en post. Une image est
  générée à la DA MyLift (fond dark, accent coral #FC4C02, PR en gold #FFC233) :
  titre du PR ou résumé de séance, chiffres clés (durée/volume/PRs pour une
  séance, ou l'accomplissement isolé pour un lift), rendu propre partageable.
  Décision actée : c'est À LA FOIS un post natif dans le feed MyLift ET un export
  Insta, pas un choix exclusif. Le poids absolu peut apparaître sur l'image (ex.
  "DC 120×5") mais aucun classement entre utilisateurs sur cette valeur — seul
  l'index relatif est comparable. Génération de l'image côté client, compressée
  avant tout upload (cohérent avec la contrainte de coût : max ~1080px, une seule
  image par post).

### Phase 4 — Interactions sociales
ÉTAT : FAIT (in-app) — RLS sondée en prod avant de coder :
- likes(post_id, user_id, created_at) et comments(id text client, post_id,
  user_id, text CHECK ≤500) : usurpation bloquée, le owner d'un post voit
  ses likes/commentaires même sans lien sortant, delete uniquement sur SES
  lignes (pas de modération par le owner du post).
- Table notifications : INSERT REFUSÉ à tout client (même pour soi —
  policy fermée, prévue pour des triggers serveur). NE PAS contourner :
  les notifs in-app sont DÉRIVÉES à la lecture (src/lib/notifs.ts, point
  d'entrée unique) depuis likes/comments sur mes posts + amitiés établies ;
  lu/non-lu local au device ; badge Feed = demandes pending + non-lus.
- Likes : SocialRow dans PostCard (partout), optimistic + rollback.
- Commentaires : section sur app/post/[id].tsx (saisie au-dessus du
  clavier, compteur 500, suppression du sien).
- Suggestions d'amis (Recherche) : la RLS follows ne montre que SES
  liens → calcul serveur via supabase/friend_suggestions.sql (SECURITY
  DEFINER, ids publics + compteur, jamais de listes brutes) — À APPLIQUER
  PAR MAXIME dans le dashboard ; le client la détecte et masque la
  section tant qu'elle n'existe pas.
- Story Instagram directe : sticker PNG transparent (StickerCard,
  ComposePost) via react-native-share (require paresseux try/catch —
  jette dans Expo Go, autolinked au build EAS), schéma déclaré dans
  app.json (LSApplicationQueriesSchemes). Fallback share sheet toujours.
  PROD/BUILD : META_APP_ID (src/lib/instagram.ts) à créer sur
  developers.facebook.com avant le build EAS.

Restait de la spec d'origine :
- Notifications PUSH (expo-notifications) : PROD/BUILD — exige build EAS
  (token APNs) + triggers serveur pour remplir notifications ; le point
  d'entrée client existe (notifs.registerForPushIfBuilt, inerte en Expo
  Go), rien d'autre à préparer côté app

### Phase 5 — Mise en production
- Conformité RGPD : suppression de compte en cascade complète (vérifier que
  chaque table avec owner_id a bien un ON DELETE CASCADE, déjà le cas dans
  le schéma), export de données personnelles sur demande
- Modération de base : signalement de post/commentaire, table et flux minimal
**Connexion app Santé (HealthKit)** — demandé par Maxime : synchroniser les
pesées avec Apple Santé (lecture du poids saisi ailleurs, écriture des pesées
MyLift). Nécessite du code natif (react-native-health / HealthKit entitlement)
→ build EAS custom, impossible en Expo Go — même wagon que les Live Activities.
L'écran Pesée reste la source UI ; la sync Santé est bidirectionnelle avec
priorité au plus récent.

**Live Activities (Dynamic Island + écran verrouillé)** — nécessite du code
natif iOS (ActivityKit / WidgetKit), donc un build EAS custom, impossible en
Expo Go. C'est la raison pour laquelle c'est en Phase 5 et pas avant. Pendant
une séance active :

- La bannière "séance en cours" de l'app (celle qui vit dans le layout en
  Phase 1) devient une Live Activity dès qu'une séance démarre. Elle vit dans
  la Dynamic Island quand l'app est au premier plan ou en arrière-plan.
- Timer de repos en direct dans la Dynamic Island : le décompte tourne en
  temps réel affiché dans l'île, et surtout il continue de tourner et de
  s'afficher même si Maxime quitte l'app (verrouille son téléphone, passe sur
  une autre app, coupe la musique, etc.). C'est tout l'intérêt : ne jamais
  perdre le timer de repos de vue pendant qu'on fait autre chose entre deux
  séries.
- Tap sur la Dynamic Island (vue compacte ou étendue) = retour direct dans
  l'app, sur l'écran de séance live en cours.
- Écran verrouillé : la Live Activity affiche le timer de repos en direct +
  le nom de l'exercice en cours + le poids cible de la série à venir. Maxime
  doit pouvoir jeter un œil à son iPhone posé sur le banc, écran verrouillé,
  et voir combien de temps de repos il reste et quel est le prochain mouvement
  sans déverrouiller.
- État de repli (device sans Dynamic Island, ou Live Activity non
  supportée) : dégrader proprement vers une notification classique persistante
  avec le timer, jamais un crash ni une absence totale de feedback hors app.

Contrainte technique : ActivityKit impose que le contenu de la Live Activity
soit poussé/mis à jour depuis l'app ; le timer doit utiliser le rendu de date
natif d'iOS (Text avec timer style) pour décompter tout seul côté système sans
réveiller l'app en permanence — ne pas tenter de mettre à jour le compte à
rebours seconde par seconde depuis le JS, ça ne survivrait pas à la mise en
arrière-plan.

- Assets App Store : icône définitive, screenshots par taille d'écran
  requise, description, mots-clés, politique de confidentialité hébergée
- Build EAS de production (bundleIdentifier déjà fixé : com.maxime.mylift)
- Distribution TestFlight interne pour validation finale par Maxime
- Soumission App Store, gestion des éventuels rejets de revue

Règle de progression stricte : ne jamais entamer une phase avant que la
précédente ait un rapport de vérification factuel (comptages réels en base,
résultats de tests unitaires, captures d'écran du comportement) validé
explicitement par Maxime — une affirmation non vérifiée de la part de Claude
Code ne suffit jamais à considérer une phase terminée.
