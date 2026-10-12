# Brancher Supabase

Aujourd'hui, le site enregistre tout dans le navigateur. Supabase (Postgres + authentification) va servir de base commune à tous les visiteurs et à ton admin.

## À savoir avant de commencer
- L'offre gratuite de Supabase **met le projet en pause après 1 semaine sans activité** (il faut le réactiver à la main). Pour une vraie boutique, prévois l'offre Pro (environ 25 $ par mois), qui ne se met jamais en pause.
- Choisis une région européenne (Paris ou Francfort) pour la protection des données.
- La clé publique `anon` peut être dans le code. La clé `service_role` ne doit **jamais** apparaître dans le dépôt, dans le site, ni dans un message.

## À faire de ton côté
1. Créer un projet sur supabase.com (région Europe) et noter son **URL** et sa clé **anon**.
2. Dans *Authentication*, activer la connexion par e-mail et renseigner l'URL du site (domaine) dans les URL de redirection.
3. Prévoir un service d'envoi d'e-mails (SMTP) pour les messages de confirmation, car l'envoi par défaut de Supabase est très limité.

## Plan de branchement (étape par étape)
1. **Comptes et admin :** Supabase Auth remplace les comptes locaux et le mot de passe admin ; une table `admins` désigne qui peut gérer la boutique.
2. **Produits et contenu :** produits, packs, textes, réglages (paiement, livraison, pré-lancement) lus depuis la base ; seul l'admin peut les modifier.
3. **Commandes :** création par une fonction serveur qui **recalcule les prix, remises, cashback et stock côté base** (jamais confiance au navigateur) ; statuts, paiement reçu, suivi.
4. **Newsletter, parrainage, cashback, codes promo, rétractations :** tables dédiées. Les codes promo ne sont jamais lisibles publiquement : ils sont vérifiés par une fonction.
5. **E-mails automatiques :** confirmation, expédition avec suivi, rappel de paiement, accusé de rétractation.

## Tables prévues
`admins`, `profiles`, `products`, `packs`, `promo_codes`, `orders`, `referrals`, `reward_issues`, `newsletter`, `withdrawals`, `settings_public`, `settings_private`.

Toutes les tables auront la sécurité **RLS** activée : un client ne voit que ses propres commandes et son profil ; les données sensibles passent par des fonctions.

## Ce que je te demanderai
L'URL du projet et la clé `anon`, à mettre dans `js/config.js`. Rien d'autre.
