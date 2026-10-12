# ULTIM'Peps : boutique en ligne (site statique)

Site 100 % HTML / CSS / JavaScript, sans outil de compilation. Il se publie tel quel avec **GitHub Pages**.

## Contenu du dossier

```
ultimpeps-site/
├── index.html            Structure de la page (boutique, admin, fenêtres)
├── css/style.css         Tout le design
├── js/app.js             Toute la logique (boutique, panier, admin, parrainage, paiement…)
├── js/config.js          Réglages publics (URL et clé "anon" Supabase, à remplir plus tard)
├── assets/favicon.svg    Icône du site
├── 404.html              Page d'erreur
├── robots.txt            Consigne aux moteurs de recherche
├── .nojekyll             Évite le traitement Jekyll de GitHub Pages
├── CHECKLIST-OUVERTURE.md  À cocher avant d'ouvrir au public
└── supabase/README.md    Plan de branchement de la base de données
```

## Mettre le site en ligne avec GitHub Pages

1. Crée un compte sur github.com, puis un **nouveau dépôt**. Avec l'offre gratuite, GitHub Pages exige un dépôt **public** (voir « Confidentialité du dépôt » plus bas).
2. Envoie tous les fichiers de ce dossier à la racine du dépôt : bouton *Add file > Upload files*, ou `git`.
3. Dans le dépôt : *Settings > Pages > Build and deployment*. Choisis *Deploy from a branch*, la branche `main` et le dossier `/ (root)`, puis *Save*.
4. Au bout de quelques minutes, le site est visible sur `https://TON-COMPTE.github.io/NOM-DU-DEPOT/`.

### Brancher ton nom de domaine
1. Dans *Settings > Pages > Custom domain*, saisis ton domaine (par exemple `ultimpeps.fr`), puis *Save*.
2. Chez ton bureau d'enregistrement (zone DNS), crée 4 enregistrements **A** pour le domaine nu vers `185.199.108.153`, `185.199.109.153`, `185.199.110.153` et `185.199.111.153`. Ajoute aussi un enregistrement **CNAME** `www` vers `TON-COMPTE.github.io`.
3. Quand GitHub l'autorise, coche *Enforce HTTPS*. GitHub ajoute un fichier `CNAME` au dépôt : ne le supprime pas.

## Après la mise en ligne

1. Ouvre l'admin : `Ctrl+Maj+A` (ou 5 clics rapides sur le logo en bas de page). Crée ton mot de passe (10 caractères minimum) et **note la clé de récupération**.
2. *Admin > Stats > Infos boutique* : adresse du site (`https://ton-domaine`), raison sociale, adresse, SIRET, e-mail, médiateur, hébergeur, etc.
3. *Admin > Paiement* : IBAN et délai de paiement.
4. *Admin > Produits* puis *Contenu* : tes produits et tes textes.
5. Quand tout est prêt : *Admin > Pré-lancement* pour afficher « Ouverture bientôt » avec compte à rebours.

## Important : où sont enregistrées les données aujourd'hui

Pour l'instant, **tout est enregistré dans le navigateur** (produits, commandes, comptes, codes, paiement, textes). Conséquences :
- ce que tu saisis dans l'admin n'est visible que dans ton navigateur ;
- les commandes et inscriptions de tes visiteurs ne te parviennent pas ;
- changer d'adresse (par exemple de `github.io` vers ton domaine) repart d'un site vide.

C'est le rôle de l'étape **Supabase** : voir `supabase/README.md`. Tant qu'elle n'est pas faite, le site ne peut pas prendre de vraies commandes.

## Confidentialité du dépôt

Un dépôt public est lisible par tout le monde. N'y mets jamais : tes coûts d'achat, tes fournisseurs, tes tableurs, un fichier de clients, ni aucune clé secrète (notamment la clé `service_role` de Supabase). La clé `anon` de Supabase, elle, est publique par conception. Le fichier `.gitignore` exclut déjà `.xlsx` et `.csv`.

## Où modifier quoi

- Couleurs, polices, mise en page : `css/style.css` (variables en haut du fichier : `--b`, `--b2`, `--bg`…).
- Comportement du site : `js/app.js`, découpé en blocs repérés par des commentaires (`// parrainage`, `// cashback`, `// paiement par virement`, `// pré-lancement`, `// CGV et rétractation`…).
- Structure de la page et fenêtres : `index.html`.
- Textes : de préférence depuis *Admin > Contenu*.

## Bibliothèques externes

Le site charge deux bibliothèques depuis jsDelivr, avec vérification d'intégrité (SRI) : `jsPDF` (factures et étiquettes PDF) et `qrcode-generator` (QR codes). Les polices viennent de Google Fonts. Ces ressources transmettent l'adresse IP des visiteurs à ces services (c'est indiqué dans la politique de confidentialité). Pour s'en passer, héberge-les dans le dossier `assets/`.

## Avertissement

Les textes juridiques (CGV, mentions légales, confidentialité) sont des modèles : à faire relire par un professionnel avant l'ouverture, comme les fiches produits et les allégations du site.
