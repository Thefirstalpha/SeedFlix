# Instructions de travail - CatalogFinder / SeedFlix

## Objectif
- Maintenir et faire evoluer cette application React + Vite + Express de facon coherent et sans regressions.

## Stack et structure
- Frontend: React, React Router, Tailwind.
- Backend: Express dans server/index.js (ou modules server/* si refactor).
- Donnees runtime locales: data/ a la racine du projet (users, sessions, wishlist, seriesWishlist).
- Configuration usine versionnee: server/defaultSettings.json.

## Authentification
- Compte par defaut: admin / admin.
- Si identifiants par defaut detectes, forcer le changement de mot de passe avant acces complet.
- Session via cookie HTTP-only.
- Apres reset usine: expirer le cookie/session et rediriger vers /login.

## Parametres
- Les parametres utilisateur sont persistants cote backend.
- Le reset usine doit remettre:
  - users.json a l'etat usine (admin)
  - wishlist.json vide
  - seriesWishlist.json vide
  - sessions.json vide

## UI/UX
- Conserver la palette actuelle du site (pas de branding rouge global).
- Label produit actuel: SeedFlix.
- Les actions destructives doivent etre en rouge avec confirmation integree (pas window.confirm).

## Style de travail demande
- Repondre en francais.
- Faire les changements directement dans le code quand la demande est claire.
- Verifier les erreurs TypeScript/lint apres changements importants.
- Lancer npm run build apres changements structurels significatifs.
- Eviter les changements hors-sujet.
