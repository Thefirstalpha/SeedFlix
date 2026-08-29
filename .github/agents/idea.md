Listed directory CatalogFinder
Viewed package.json:1-141
Viewed README.md:1-194
Listed directory src
Listed directory app
Searched for files: *
Ran command: `Get-ChildItem -Recurse -File -Include *.ts,*.tsx,*.js,*.json,*.css,*.mjs | Where-Object { $_.FullName -notmatch 'node_modules|dist|\.git|coverage' } | Select-Object -ExpandProperty FullName`
Checked task List files
Viewed task-14.log:1-10
Searched for files: *
Searched for files: *
Searched for files: *
Searched for files: *
Searched for files: *
Viewed index.ts:1-90
Viewed db.ts:1-132
Viewed torznab.ts:1-82
Viewed indexer.ts:1-541
Viewed transmission.ts:1-447
Viewed downloadWatcher.ts:1-84
Viewed notification.ts:1-280
Viewed ftp.ts:1-210
Viewed tmdb.ts:1-188
Viewed tmdb.ts:1-84
Viewed indexer.ts:1-107
Viewed transmission.ts:1-106
Viewed wishlist.ts:1-267
Viewed routes.tsx:1-40
Viewed Home.tsx:1-800
Viewed MovieCard.tsx:1-45
Viewed SeriesCard.tsx:1-43
Viewed MovieListItem.tsx:1-70
Viewed SeriesListItem.tsx:1-71
Viewed movieService.ts:1-370
Viewed seriesService.ts:1-384
Viewed indexerGrouping.ts:1-240
Viewed indexerNormalization.ts:1-25
Viewed MovieDetails.tsx:1-380
Viewed SeriesDetails.tsx:1-698
Viewed WishList.tsx:1-604
Viewed Downloads.tsx:1-717
Viewed FtpExplorer.tsx:1-800
Viewed Notifications.tsx:1-303
Viewed Settings.tsx:1-408
Viewed Root.tsx:1-418
Viewed TorrentResultsPanel.tsx:1-271
Viewed IndexerResultsList.tsx:1-379
Viewed WishListCard.tsx:1-117
Viewed IndexerReleaseItem.tsx:1-190
Viewed AuthContext.tsx:1-75
Viewed SearchStateContext.tsx:1-157
Searched for "@mui"
Searched for "react-slick|recharts|react-dnd|canvas-confetti|vaul"
Searched for files: *.tsx
Searched for files: *.ts*
Searched for files: *
Viewed movie.ts:1-91

Voici une analyse globale et approfondie du projet **SeedFlix** (**CatalogFinder**).

---

# 📊 1. Synthèse globale du projet

**SeedFlix** est une application full-stack moderne, bien structurée et ambitieuse qui combine :
* La découverte et l'exploration de médias via **TMDB** (films, séries, saisons, épisodes, bandes-annonces).
* La recherche de releases sur indexeurs compatibles **Torznab** (Jackett, Prowlarr, etc.).
* La gestion et le suivi des transferts via **Transmission RPC**.
* Un explorateur de fichiers **FTP / Seedbox** intégré avec gestion du stockage.
* Une gestion multi-utilisateurs avec authentification par cookies HTTP-only et panneau d'administration.
* Des notifications multi-canaux (**In-App**, **Discord Webhook**, **Web Push VAPID**).

Le projet dispose d'une bonne base technique (TypeScript de bout en bout, tests backend complets, pipeline CI avec SonarCloud et Trivy, Dockerfile multi-stage). Cependant, plusieurs axes d'amélioration peuvent transformer ce projet en une solution encore plus fluide, robuste et complète.

---

# 🏗️ 2. Répartition Frontend vs Backend : ce qui devrait être déplacé

Certains traitements métiers lourds ou sensibles sont actuellement exécutés côté client au lieu du serveur :

### 🔹 Normalisation et parsing des releases Indexer / Torznab
* **Actuellement :** Le parsing, la normalisation de la qualité et des langues sont dispersés entre le backend ([`indexer.ts`](file:///d:/workspace/CatalogFinder/server/modules/indexer.ts)) et le frontend ([`indexerNormalization.ts`](file:///d:/workspace/CatalogFinder/src/app/services/indexerNormalization.ts), [`indexerGrouping.ts`](file:///d:/workspace/CatalogFinder/src/app/services/indexerGrouping.ts)).
* **Problème :** Deux moteurs de parsing coexistent. Par exemple, le backend extrait la qualité avec des points stricts (`.1080p.`), ce qui échoue sur des titres séparés par des espaces ou crochets, tandis que le frontend refait un filtrage avec `includes('1080')`.
* **Recommandation :** Centraliser toute la logique de classification (saison, épisode, pack intégrale, résolution, langue VFF/VOSTFR, source WEB/BluRay) côté backend avant de renvoyer un format unifié au frontend.

### 🔹 Normalisation des données TMDB
* **Actuellement :** Le frontend reçoit les objets bruts TMDB via le proxy backend, puis applique `convertTMDBToMovie` et `convertTMDBToSeries` dans [`movieService.ts`](file:///d:/workspace/CatalogFinder/src/app/services/movieService.ts) et [`seriesService.ts`](file:///d:/workspace/CatalogFinder/src/app/services/seriesService.ts) (avec les maps de genres et de langues dupliquées).
* **Recommandation :** Créer un Transformer / DTO côté backend pour renvoyer des objets `Media` standardisés et légers, évitant d'envoyer tout le payload brut de TMDB au client.
* **À noter :** Dans [`server/modules/tmdb.ts`](file:///d:/workspace/CatalogFinder/server/modules/tmdb.ts#L173-L187), la fonction `getTmdbDetails` est actuellement une fonction incomplète qui renvoie `{}`.

### 🔹 Polling HTTP vs WebSockets / SSE (Server-Sent Events)
* **Actuellement :** Le frontend effectue du polling constant :
  * Toutes les 7 secondes dans [`Root.tsx`](file:///d:/workspace/CatalogFinder/src/app/components/Root.tsx#L117-L120) (`getUserStatusBar`).
  * Toutes les 5 secondes dans [`Downloads.tsx`](file:///d:/workspace/CatalogFinder/src/app/pages/Downloads.tsx#L446-L450) (`getTorrentDownloads` + `getTorrentStats`).
* **Recommandation :** Remplacer ce polling périodique par une connexion **SSE (Server-Sent Events)** ou **WebSocket**. Le serveur pousserait en temps réel :
  * La progression des torrents (débits d'upload/download, pourcentage).
  * Les nouvelles notifications instantanées (au lieu d'attendre 7s).
  * Le statut de la wishlist.

---

# 🧹 3. Code, Duplications & Optimisations techniques

### 🔸 Duplication de composants (Cartes et Listes)
* [`MovieCard.tsx`](file:///d:/workspace/CatalogFinder/src/app/components/MovieCard.tsx) et [`SeriesCard.tsx`](file:///d:/workspace/CatalogFinder/src/app/components/SeriesCard.tsx) sont quasi identiques à 95% (seuls les thèmes de couleur violet/cyan et le type changent).
* [`MovieListItem.tsx`](file:///d:/workspace/CatalogFinder/src/app/components/MovieListItem.tsx) et [`SeriesListItem.tsx`](file:///d:/workspace/CatalogFinder/src/app/components/SeriesListItem.tsx) sont également des doublons quasi exacts.
* **Solution :** Créer un composant unifié `MediaCard` et `MediaListItem` acceptant une propriété `type: 'movie' | 'series'`. Cela facilitera la maintenance et l'ajout de futures fonctionnalités (comme un bouton d'ajout rapide à la wishlist directement au survol).

### 🔸 Duplication dans les services TMDB
* `TMDB_LANGUAGE_MAP`, `mapTmdbLanguage` et les filtres de découverte sont copiés à l'identique dans [`movieService.ts`](file:///d:/workspace/CatalogFinder/src/app/services/movieService.ts) et [`seriesService.ts`](file:///d:/workspace/CatalogFinder/src/app/services/seriesService.ts).
* Les fonctions `getMockMovies` et `getMockSeries` renvoient des tableaux vides `[]` inutiles.

### 🔸 Goulot d'étranglement de performance dans `SearchStateContext`
* Dans [`SearchStateContext.tsx`](file:///d:/workspace/CatalogFinder/src/app/context/SearchStateContext.tsx#L113-L120), **tout l'état** (y compris les listes complètes `searchMovies`, `recommendedMovies`, `searchMultiItems` avec résumés et images) est sérialisé et enregistré dans `localStorage` à chaque mise à jour.
* **Risque :** Surcharge du thread principal lors de la frappe ou du défilement et risque de dépassement du quota `localStorage` (5 Mo).
* **Solution :** Ne persister dans le `localStorage` que les préférences de recherche légères (`viewMode`, `genreFilter`, `languageFilter`, `contentFilter`), et conserver les résultats de recherche uniquement en mémoire d'état React.

### 🔸 Découpage du composant `Home.tsx`
* [`Home.tsx`](file:///d:/workspace/CatalogFinder/src/app/pages/Home.tsx) fait plus de 1 200 lignes et cumule : gestion du scroll wheel des 2 carrousels, recherche multi, filtres modaux, gestion de la pagination, bascule cartes/liste.
* **Solution :** Découper en sous-composants : `HomeSearchBar`, `HomeFiltersModal`, `MediaCarouselSection` et `MediaGridSection`.

### 🔸 Dépendances inutilisées dans `package.json`
* Le fichier [`package.json`](file:///d:/workspace/CatalogFinder/package.json) contient de nombreuses dépendances volumineuses qui ne sont importées nulle part dans le code source :
  * `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` (~30-40 Mo).
  * `react-slick`, `react-dnd`, `react-dnd-html5-backend`, `recharts`, `vaul`, `canvas-confetti`.
* **Action :** Nettoyer ces dépendances pour alléger `node_modules`, accélérer les `npm install` et réduire la taille des builds.

### 🔸 Typo dans la base de données
* Dans [`server/modules/wishlist.ts`](file:///d:/workspace/CatalogFinder/server/modules/wishlist.ts#L5), la constante `const DB_NAMESPACE = 'whishlist'` comporte une faute de frappe historique (`whishlist` avec un `h`).

---

# 🎨 4. Améliorations Graphiques & UI / UX

1. **Actions rapides sur les cartes (`Hover Actions`) :**
   * Pouvoir ajouter/retirer un film ou une série de sa wishlist directement au survol de la carte sur la page d'accueil ou dans la recherche, sans avoir à ouvrir la page de détails.
2. **Squelettes de chargement réalistes (`Skeleton Loaders`) :**
   * Remplacer les simples blocs gris pulsants par des cartes squelettes reproduisant la disposition réelle des posters et métadonnées pour éviter les sauts de mise en page (*layout shifts*).
3. **Bouton d'accès rapide & Raccourcis clavier :**
   * Raccourci `/` ou `Ctrl + K` pour focaliser instantanément la barre de recherche globale.
   * Touche `Échap` pour fermer les modales et le panneau de filtres.
4. **Lecteur vidéo / Audio intégré pour les fichiers FTP :**
   * Dans [`FtpExplorer.tsx`](file:///d:/workspace/CatalogFinder/src/app/pages/FtpExplorer.tsx), lorsqu'un utilisateur clique sur un fichier `.mp4`, `.mkv` (compatible), `.mp3` ou une image, proposer un aperçu ou un streaming vidéo HTML5 directement dans le navigateur.
5. **Barre de navigation inférieure sur mobile :**
   * Sur smartphone, remplacer le menu hamburger latéral par une barre de navigation fixée en bas (*Bottom Navigation Bar* : Accueil, Wishlist, Téléchargements, Fichiers, Profil).
6. **Choix du thème / Couleur d'accentuation :**
   * Permettre à l'utilisateur de choisir sa teinte d'accentuation dans les paramètres (Cyan, Violet, Émeraude, Orange ambré, Rose néon) ou un mode OLED (noir pur).

---

# 🚀 5. Nouvelles Fonctionnalités à Forte Valeur Ajoutée

### 1. 🤖 Mode "Auto-Grab" / Téléchargement automatique (type Radarr / Sonarr léger)
* **Idée :** Actuellement, le cron `pullAuto` cherche les nouveautés dans le flux RSS Torznab et génère une notification.
* **Fonctionnalité :** Ajouter une option dans les paramètres : *"Télécharger automatiquement dès qu'une release correspond à mes critères"*. Si activée, dès qu'une release respecte le profil souhaité (ex: 1080p + VFF), SeedFlix l'envoie directement à Transmission sans action manuelle requise.

### 2. 🔌 Support Multi-Indexeurs
* **Idée :** Actuellement, un seul indexeur Torznab est configurable par utilisateur dans [`SettingIndexer.tsx`](file:///d:/workspace/CatalogFinder/src/app/components/settings/SettingIndexer.tsx).
* **Fonctionnalité :** Permettre d'ajouter plusieurs indexeurs (avec priorités, activation/désactivation individuelle) pour chercher sur plusieurs trackers simultanément.

### 3. 🎬 Recommandations, Films similaires & Collections (Sagas)
* **Idée :** Sur les pages [`MovieDetails.tsx`](file:///d:/workspace/CatalogFinder/src/app/pages/MovieDetails.tsx) et [`SeriesDetails.tsx`](file:///d:/workspace/CatalogFinder/src/app/pages/SeriesDetails.tsx) :
  * Afficher un carrousel *"Films similaires / Recommandés"* via l'API TMDB.
  * Afficher la collection/saga (ex: *Saga John Wick*, *Marvel Cinematic Universe*) pour voir les opus manquants et les ajouter en 1 clic à la wishlist.
  * Cliquer sur un acteur ou un réalisateur pour afficher sa filmographie.

### 4. ⚙️ Contrôles avancés Transmission
* **Idée :** Dans la page [`Downloads.tsx`](file:///d:/workspace/CatalogFinder/src/app/pages/Downloads.tsx) :
  * Basculer le mode vitesse limitée (*Turtle Mode*).
  * Définir les limites globales de vitesse d'upload et de download.
  * Voir la liste des fichiers à l'intérieur d'un torrent et sélectionner les fichiers à télécharger ou ignorer (très utile pour les packs séries).
  * Modifier l'ordre de priorité des torrents.

### 5. 📱 Support PWA (Progressive Web App)
* Ajouter un fichier `manifest.json` et un Service Worker pour permettre l'installation de SeedFlix comme application native sur smartphone, tablette et bureau, avec notifications push natives même lorsque le navigateur est fermé.

### 6. 📜 Journal d'activité & Historique
* Une section dédiée à l'historique : derniers téléchargements terminés, ajouts récents à la wishlist, logs des requêtes indexeur automatiques.

---

# 📋 6. Tableau récapitulatif des priorités

| Priorité | Domaine | Action recommandée | Impact |
| :--- | :--- | :--- | :--- |
| 🔴 **Haute** | **Performance** | Nettoyer `package.json` des bibliothèques inutilisées et corriger la sérialisation `localStorage` dans `SearchStateContext`. | Allègement du bundle, réactivité accrue. |
| 🔴 **Haute** | **Architecture** | Unifier le parsing Torznab (qualités, langues, saisons) sur le backend pour éviter les doublons et faux-négatifs. | Robustesse des résultats de recherche. |
| 🟡 **Moyenne** | **Code & Refactor** | Fusionner `MovieCard` / `SeriesCard` et `MovieListItem` / `SeriesListItem` en composants génériques réutilisables. | Maintenance simplifiée, code plus DRY. |
| 🟡 **Moyenne** | **Temps réel** | Remplacer le polling 5s/7s par des Server-Sent Events (SSE) pour les téléchargements et notifications. | Réduction de la charge réseau et serveur. |
| 🟢 **Évolution** | **Feature** | Ajouter le mode Auto-Download / Auto-Grab intelligent sur la wishlist. | Automatisation complète du workflow. |
| 🟢 **Évolution** | **UI / UX** | Ajouter la lecture multimédia directe dans l'explorateur FTP et le support des sagas / recommandations TMDB. | Expérience utilisateur riche et moderne. |

Si tu souhaites qu'on attaque l'une de ces parties (par exemple le nettoyage/refactor des composants dupliqués, l'optimisation des performances de recherche, ou l'ajout d'une feature précise), dis-moi par quoi tu veux commencer !