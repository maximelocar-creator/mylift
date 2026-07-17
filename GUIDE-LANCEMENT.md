# MyLift V2 — Lancer l'app sur ton iPhone (via GitHub Codespaces)

Aucune installation sur ton PC. Tout se passe dans le navigateur + ton iPhone.

## Avant de commencer (2 minutes, une seule fois)

1. **Sur ton iPhone** : installe l'app gratuite **Expo Go** depuis l'App Store.
2. **Dans Supabase** : menu gauche → Authentication → Sign In / Providers → Email →
   désactive **"Confirm email"** → Save. (Sinon chaque création de compte exige
   un clic dans un email de confirmation — inutile pour l'instant.)

## Mettre le code sur GitHub (une seule fois)

1. Va sur github.com → bouton **New repository** → nom : `mylift-v2` →
   coche **Private** → Create repository.
2. Sur la page du dépôt vide, clique **"uploading an existing file"**.
3. Décompresse le zip `mylift-v2-phase0b.zip` sur ton PC, puis **glisse tout le
   contenu du dossier** (pas le dossier lui-même) dans la zone d'upload.
4. Clique **Commit changes**.

## Lancer l'app (à chaque fois que tu veux tester)

1. Sur la page de ton dépôt : bouton vert **Code** → onglet **Codespaces** →
   **Create codespace on main**. Un éditeur s'ouvre dans le navigateur (1-2 min).
2. En bas, dans le **Terminal**, tape (copier-coller) :

   ```
   npm install
   ```

   Attends la fin (2-3 min la première fois).

3. Puis :

   ```
   npx expo start --tunnel
   ```

   - S'il demande d'installer quelque chose (`@expo/ngrok`), réponds **y**.
   - Un **QR code** s'affiche dans le terminal.

4. **Sur ton iPhone** : ouvre l'appareil photo, scanne le QR code, ouvre le lien →
   l'app MyLift se lance dans Expo Go.

## Premier test

1. Crée ton compte (email + mot de passe).
2. Choisis ton nom d'utilisateur.
3. **Envoie-toi le fichier backup** (`mylift-backup-2026-07-16_8011.json`) sur ton
   iPhone (AirDrop, mail, iCloud — n'importe, il faut qu'il soit accessible dans
   Fichiers).
4. Dans l'app : "Choisir le fichier et importer" → sélectionne le JSON.
5. Le rapport de parité s'affiche : tout doit être **vert**.

## Si ça coince

- **Expo Go affiche une erreur de version SDK** : dans le terminal Codespace,
  tape `npx expo install expo@latest` puis `npx expo install --fix`, puis relance
  `npx expo start --tunnel`.
- **Le QR ne charge pas** : vérifie que tu as bien mis `--tunnel` dans la commande.
- Toute autre erreur : copie-colle le message tel quel à Claude.

## Quand tu as fini

Ferme simplement l'onglet. Le Codespace se met en veille tout seul (gratuit
jusqu'à 60h/mois, largement assez).
