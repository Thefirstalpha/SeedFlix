// Configuration TMDB API
// Pour obtenir votre clé API gratuite :
// 1. Créez un compte sur https://www.themoviedb.org/
// 2. Allez dans Paramètres > API
// 3. Demandez une clé API (gratuit)
// 4. Remplacez 'YOUR_TMDB_API_KEY' ci-dessous par votre clé

export const TMDB_API_KEY = '';
export const TMDB_BASE_URL = '';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
export const TMDB_POSTER_SIZE = 'w500';
export const TMDB_BACKDROP_SIZE = 'original';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export function getTmdbLanguageParam(language: string | null | undefined): string {
  const normalized = String(language || '')
    .trim()
    .toLowerCase();

  if (!normalized || normalized.startsWith('fr')) {
    return 'fr-FR';
  }

  if (normalized.startsWith('en')) {
    return 'en-US';
  }

  if (normalized.includes('-')) {
    return normalized;
  }

  return `${normalized}-${normalized.toUpperCase()}`;
}

export function getTmdbImageUrl(path: string | null, size: string = TMDB_POSTER_SIZE): string {
  if (!path) {
    return 'https://via.placeholder.com/500x750/1a1a2e/ffffff?text=No+Image';
  }
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}
