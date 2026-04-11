const messages = {
  fr: {
    common: {
      authRequired: "Authentification requise",
    },
    auth: {
      failedReadSession: "Impossible de lire la session",
      usernamePasswordRequired: "Nom d'utilisateur et mot de passe requis",
      invalidCredentials: "Identifiants invalides",
      failedLogin: "Connexion impossible",
      failedLogout: "Deconnexion impossible",
      currentNewPasswordRequired: "Mot de passe actuel et nouveau mot de passe requis",
      newPasswordTooShort: "Le nouveau mot de passe doit contenir au moins 6 caracteres",
      invalidCurrentPassword: "Mot de passe actuel invalide",
      failedChangePassword: "Impossible de modifier le mot de passe",
      failedLoadSettings: "Impossible de charger les parametres",
      failedUpdateSettings: "Impossible de mettre a jour les parametres",
      failedResetSettings: "Impossible de reinitialiser les parametres",
    },
    tmdb: {
      apiKeyNotConfigured: "La cle API TMDB n'est pas configuree. Configurez-la dans les parametres.",
      invalidResponse: "Reponse invalide de TMDB",
      apiKeyRequired: "La cle API TMDB est requise",
      invalidApiKey: "Cle API TMDB invalide",
      validApiKey: "Cle API TMDB valide",
      testApiKeyFailed: "Impossible de tester la cle API TMDB",
      fetchPopularMoviesFailed: "Impossible de recuperer les films populaires",
      fetchMovieGenresFailed: "Impossible de recuperer les genres de films",
      discoverMoviesFailed: "Impossible de recuperer la decouverte de films",
      queryRequired: "Le parametre query est requis",
      searchMoviesFailed: "Impossible de rechercher les films",
      invalidMovieId: "Identifiant de film invalide",
      fetchMovieDetailsFailed: "Impossible de recuperer les details du film",
      fetchPopularSeriesFailed: "Impossible de recuperer les series populaires",
      fetchSeriesGenresFailed: "Impossible de recuperer les genres de series",
      discoverSeriesFailed: "Impossible de recuperer la decouverte de series",
      searchSeriesFailed: "Impossible de rechercher les series",
      invalidSeriesId: "Identifiant de serie invalide",
      fetchSeriesDetailsFailed: "Impossible de recuperer les details de la serie",
      invalidSeriesIdOrSeason: "Identifiant de serie ou numero de saison invalide",
      fetchSeasonDetailsFailed: "Impossible de recuperer les details de la saison",
    },
    wishlist: {
      readWishlistFailed: "Impossible de lire la liste de souhaits",
      invalidMoviePayload: "Donnees film invalides",
      addMovieFailed: "Impossible d'ajouter le film a la liste de souhaits",
      invalidMovieId: "Identifiant de film invalide",
      removeMovieFailed: "Impossible de supprimer le film de la liste de souhaits",
      removeMoviesFailed: "Impossible de supprimer les films de la liste de souhaits",
      checkMovieFailed: "Impossible de verifier la presence du film",
      readSeriesWishlistFailed: "Impossible de lire la liste de souhaits des series",
      invalidSeriesId: "Identifiant de serie invalide",
      getSeriesStatusFailed: "Impossible de recuperer le statut de la liste de souhaits",
      invalidSeriesPayload: "Donnees de liste de souhaits serie invalides",
      addSeriesFailed: "Impossible d'ajouter a la liste de souhaits des series",
      removeSeriesEntryFailed: "Impossible de supprimer l'entree de liste de souhaits serie",
      removeSeriesEntriesFailed: "Impossible de supprimer les entrees de liste de souhaits series",
    },
    notifications: {
      testSent: "Notification de test envoyee",
      testFailed: "Notification de test impossible",
      notFound: "Notification introuvable",
      rejected: "Proposition rejetee",
      rejectNotSupported: "Cette notification ne peut pas etre rejetee",
      testTitle: "Notification de test",
      testMessage: "SeedFlix: la chaine de notification fonctionne correctement.",
      testChannel: "Interne + canaux actifs (Discord/Navigateur)",
      testTimestamp: "Horodatage",
      testChannelLabel: "Canal",
      indexerMovieAvailable: "Film disponible sur indexer",
      indexerSeriesAvailable: "Serie disponible sur indexer",
      indexerSeasonAvailable: "Saison disponible sur indexer",
      indexerEpisodeAvailable: "Episode disponible sur indexer",
      indexerReleaseBatchLabelOne: "{{first}} (+{{extra}} autre)",
      indexerReleaseBatchLabelMany: "{{first}} (+{{extra}} autres)",
      indexerReleaseMessage: "{{title}}: {{count}} resultat(s) trouve(s).",
    },
    transmission: {
      urlRequired: "L'URL Transmission est requise",
      invalidCredentials: "Identifiants Transmission invalides",
      connectFailed: "Connexion Transmission impossible ({{status}})",
      invalidResponse: "Reponse Transmission invalide",
      connectOk: "Connexion Transmission OK",
      connectOkWithVersion: "Connexion Transmission OK: {{version}}",
      testTimeout: "Le test Transmission a expire",
      testFailed: "Echec du test Transmission",
      torrentUrlRequired: "torrentUrl est requis",
      addToClientFailed: "Ajout au client torrent impossible ({{status}})",
      addTimeout: "L'ajout du torrent a expire",
      addFailed: "Echec de l'ajout torrent",
      readDownloadsFailed: "Lecture des telechargements impossible ({{status}})",
      downloadsTimeout: "La lecture des telechargements a expire",
      downloadsFailed: "Echec de lecture des telechargements",
      invalidTorrentId: "ID torrent invalide",
      pauseFailed: "Impossible de mettre en pause le torrent",
      paused: "Torrent mis en pause",
      resumeFailed: "Impossible de reprendre le torrent",
      resumed: "Torrent repris",
      invalidHash: "Hash torrent invalide",
      cleaned: "Torrent supprime de l'affichage",
      cleanFailed: "Impossible de supprimer le torrent",
      unmanaged: "Torrent n'est plus suivi",
      unmanageFailed: "Impossible d'arreter le suivi du torrent",
      duplicateTitle: "Torrent duplique",
      addedTitle: "Torrent ajoute",
      duplicateStatus: "duplique",
      addedStatus: "ajoute",
      addedToClient: "Torrent ajoute au client",
    },
    torznab: {
      invalidUrl: "URL Torznab invalide",
      invalidSearchResponse: "La reponse recue n'est pas une reponse Torznab de recherche valide",
      indexerNotConfigured: "Indexer Torznab non configure",
      searchDone: "Recherche Torznab effectuee",
      queryRequired: "Le parametre query est requis",
      searchTimeout: "La recherche Torznab a expire",
      searchFailed: "Echec de la recherche Torznab",
      urlRequired: "L'URL Torznab est requise",
      tokenRequired: "Le jeton API Torznab est requis",
      connectFailed: "Connexion Torznab impossible ({{status}})",
      connectOk: "Connexion Torznab OK",
      connectOkWithTitle: "Connexion Torznab OK: {{title}}",
      testTimeout: "Le test Torznab a expire",
      testFailed: "Echec du test Torznab",
      genericError: "Erreur Torznab ({{status}})",
    },
  },
  en: {
    common: {
      authRequired: "Authentication required",
    },
    auth: {
      failedReadSession: "Failed to read session",
      usernamePasswordRequired: "Username and password are required",
      invalidCredentials: "Invalid credentials",
      failedLogin: "Failed to log in",
      failedLogout: "Failed to log out",
      currentNewPasswordRequired: "Current and new passwords are required",
      newPasswordTooShort: "New password must be at least 6 characters",
      invalidCurrentPassword: "Invalid current password",
      failedChangePassword: "Failed to change password",
      failedLoadSettings: "Failed to load settings",
      failedUpdateSettings: "Failed to update settings",
      failedResetSettings: "Failed to reset settings",
    },
    tmdb: {
      apiKeyNotConfigured: "TMDB API key is not configured. Please set it in settings.",
      invalidResponse: "Invalid TMDB response",
      apiKeyRequired: "TMDB API key is required",
      invalidApiKey: "Invalid TMDB API key",
      validApiKey: "Valid TMDB API key",
      testApiKeyFailed: "Failed to test TMDB API key",
      fetchPopularMoviesFailed: "Failed to fetch popular movies",
      fetchMovieGenresFailed: "Failed to fetch movie genres",
      discoverMoviesFailed: "Failed to discover movies",
      queryRequired: "query is required",
      searchMoviesFailed: "Failed to search movies",
      invalidMovieId: "Invalid movie id",
      fetchMovieDetailsFailed: "Failed to fetch movie details",
      fetchPopularSeriesFailed: "Failed to fetch popular series",
      fetchSeriesGenresFailed: "Failed to fetch series genres",
      discoverSeriesFailed: "Failed to discover series",
      searchSeriesFailed: "Failed to search series",
      invalidSeriesId: "Invalid series id",
      fetchSeriesDetailsFailed: "Failed to fetch series details",
      invalidSeriesIdOrSeason: "Invalid series id or season number",
      fetchSeasonDetailsFailed: "Failed to fetch season details",
    },
    wishlist: {
      readWishlistFailed: "Failed to read wishlist",
      invalidMoviePayload: "Invalid movie payload",
      addMovieFailed: "Failed to add movie to wishlist",
      invalidMovieId: "Invalid movie id",
      removeMovieFailed: "Failed to remove movie from wishlist",
      removeMoviesFailed: "Failed to remove wishlist movies",
      checkMovieFailed: "Failed to check wishlist movie",
      readSeriesWishlistFailed: "Failed to read series wishlist",
      invalidSeriesId: "Invalid seriesId",
      getSeriesStatusFailed: "Failed to get wishlist status",
      invalidSeriesPayload: "Invalid series wishlist payload",
      addSeriesFailed: "Failed to add to series wishlist",
      removeSeriesEntryFailed: "Failed to remove series wishlist entry",
      removeSeriesEntriesFailed: "Failed to remove series wishlist entries",
    },
    notifications: {
      testSent: "Test notification sent",
      testFailed: "Unable to send test notification",
      notFound: "Notification not found",
      rejected: "Suggestion rejected",
      rejectNotSupported: "This notification cannot be rejected",
      testTitle: "Test notification",
      testMessage: "SeedFlix: the notification pipeline is working correctly.",
      testChannel: "Internal + active channels (Discord/Browser)",
      testTimestamp: "Timestamp",
      testChannelLabel: "Channel",
      indexerMovieAvailable: "Movie available on indexer",
      indexerSeriesAvailable: "Series available on indexer",
      indexerSeasonAvailable: "Season available on indexer",
      indexerEpisodeAvailable: "Episode available on indexer",
      indexerReleaseBatchLabelOne: "{{first}} (+{{extra}} more)",
      indexerReleaseBatchLabelMany: "{{first}} (+{{extra}} more)",
      indexerReleaseMessage: "{{title}}: {{count}} result(s) found.",
    },
    transmission: {
      urlRequired: "Transmission URL is required",
      invalidCredentials: "Invalid Transmission credentials",
      connectFailed: "Transmission connection failed ({{status}})",
      invalidResponse: "Invalid Transmission response",
      connectOk: "Transmission connection OK",
      connectOkWithVersion: "Transmission connection OK: {{version}}",
      testTimeout: "Transmission test timed out",
      testFailed: "Transmission test failed",
      torrentUrlRequired: "torrentUrl is required",
      addToClientFailed: "Unable to add torrent to client ({{status}})",
      addTimeout: "Adding torrent timed out",
      addFailed: "Failed to add torrent",
      readDownloadsFailed: "Unable to read downloads ({{status}})",
      downloadsTimeout: "Reading downloads timed out",
      downloadsFailed: "Failed to read downloads",
      invalidTorrentId: "Invalid torrent ID",
      pauseFailed: "Unable to pause torrent",
      paused: "Torrent paused",
      resumeFailed: "Unable to resume torrent",
      resumed: "Torrent resumed",
      invalidHash: "Invalid torrent hash",
      cleaned: "Torrent removed from view",
      cleanFailed: "Unable to remove torrent",
      unmanaged: "Torrent is no longer tracked",
      unmanageFailed: "Unable to stop tracking torrent",
      duplicateTitle: "Duplicate torrent",
      addedTitle: "Torrent added",
      duplicateStatus: "duplicate",
      addedStatus: "added",
      addedToClient: "Torrent added to client",
    },
    torznab: {
      invalidUrl: "Invalid Torznab URL",
      invalidSearchResponse: "The response is not a valid Torznab search response",
      indexerNotConfigured: "Torznab indexer is not configured",
      searchDone: "Torznab search completed",
      queryRequired: "query parameter is required",
      searchTimeout: "Torznab search timed out",
      searchFailed: "Torznab search failed",
      urlRequired: "Torznab URL is required",
      tokenRequired: "Torznab API token is required",
      connectFailed: "Torznab connection failed ({{status}})",
      connectOk: "Torznab connection OK",
      connectOkWithTitle: "Torznab connection OK: {{title}}",
      testTimeout: "Torznab test timed out",
      testFailed: "Torznab test failed",
      genericError: "Torznab error ({{status}})",
    },
  },
};

function getRequestedLanguage(req) {
  const header = String(req?.headers?.["accept-language"] || "").toLowerCase();
  if (header.startsWith("fr")) {
    return "fr";
  }
  if (header.startsWith("en")) {
    return "en";
  }
  return "en";
}

function getUserLanguage(user) {
  const language = String(
    user?.settings?.placeholders?.preferences?.language || ""
  ).toLowerCase();

  if (language === "fr" || language === "en") {
    return language;
  }

  return undefined;
}

function resolveMessage(language, key) {
  const selected = messages[language] || messages.en;
  const fallback = messages.en;

  const fromSelected = key.split(".").reduce((acc, segment) => {
    if (!acc || typeof acc === "string") {
      return undefined;
    }
    return acc[segment];
  }, selected);

  if (typeof fromSelected === "string") {
    return fromSelected;
  }

  const fromFallback = key.split(".").reduce((acc, segment) => {
    if (!acc || typeof acc === "string") {
      return undefined;
    }
    return acc[segment];
  }, fallback);

  return typeof fromFallback === "string" ? fromFallback : key;
}

export function getTranslator(req, user) {
  const language = getUserLanguage(user) || getRequestedLanguage(req);
  return (key, vars) => {
    const template = resolveMessage(language, key);
    if (!vars) {
      return template;
    }
    return template.replace(/\{\{(.*?)\}\}/g, (_match, token) => {
      const named = String(token || "").trim();
      return named in vars ? String(vars[named]) : "";
    });
  };
}
