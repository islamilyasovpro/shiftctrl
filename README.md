# ShiftCtrl

Registre de service pour agent de gardiennage — shifts, clients, salaire.

## 1. Créer la base de données (Supabase) — 5 min

1. Va sur https://supabase.com → **Start your project** → connecte-toi avec GitHub ou email (gratuit).
2. **New project** → nom "shiftctrl", choisis un mot de passe base de données (garde-le de côté), région "West EU (Ireland)" ou proche de Belgique.
3. Une fois le projet créé, va dans **SQL Editor** (menu de gauche) → **New query**.
4. Colle tout le contenu du fichier `supabase/schema.sql` (fourni dans ce projet) → **Run**.
5. Va dans **Project Settings > API** → note ces deux valeurs, tu en auras besoin à l'étape 3 :
   - **Project URL** (en haut de la page, ressemble à `https://xxxxxxxxxxxx.supabase.co`)
   - **Publishable key** (dans la section "Publishable key", commence par `sb_publishable_...` — c'est le nouveau nom de l'ancienne "anon public key")

## 2. Mettre le code sur GitHub — 5 min

1. Va sur https://github.com → crée un compte si besoin.
2. **New repository** → nom "shiftctrl" → **Create repository**.
3. Sur ton PC, dans le dossier du projet :
   ```
   git init
   git add .
   git commit -m "ShiftCtrl v1"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/shiftctrl.git
   git push -u origin main
   ```
   (remplace `TON-PSEUDO` par ton nom d'utilisateur GitHub)

## 3. Déployer (Vercel) — 5 min

1. Va sur https://vercel.com → **Sign up** → connecte-toi avec ton compte GitHub.
2. **Add New > Project** → sélectionne le repo `shiftctrl` → **Import**.
3. Avant de cliquer sur Deploy, ouvre **Environment Variables** et ajoute :
   - `NEXT_PUBLIC_SUPABASE_URL` = (le Project URL noté à l'étape 1)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (la Publishable key notée à l'étape 1)
4. **Deploy**. Après ~1 minute, Vercel te donne une URL du style `shiftctrl.vercel.app`.

## 4. Autoriser l'URL dans Supabase — 1 min

1. Dans Supabase → **Authentication > URL Configuration**.
2. **Site URL** : colle ton URL Vercel (ex: `https://shiftctrl.vercel.app`).
3. **Redirect URLs** : ajoute `https://shiftctrl.vercel.app/auth/callback`.
4. Save.

## 5. Créer ton compte et installer sur iPhone

1. Ouvre ton URL Vercel sur Safari (iPhone).
2. **Créer un compte** → email + mot de passe → confirme via le mail reçu.
3. Connecte-toi.
4. Dans Safari : bouton **Partager** (carré avec flèche) → **Sur l'écran d'accueil** → **Ajouter**.
5. L'icône ShiftCtrl apparaît sur ton écran d'accueil et s'ouvre en plein écran comme une vraie app.

## Développement local (optionnel)

```
npm install
cp .env.local.example .env.local   # puis remplis avec tes valeurs Supabase
npm run dev
```
Ouvre http://localhost:3000
