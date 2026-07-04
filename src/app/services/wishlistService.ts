import { WishListItem } from '../../../common/wishlist';

import { API_BASE_URL, getTmdbImageUrl } from '../config/tmdb';

async function parseArrayResponse<T>(response: Response): Promise<T[]> {
  const data = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }
  for (const item of data) {
    if (item.poster_path) {
      item.poster_path = getTmdbImageUrl(item.poster_path, 'w500');
    }
  }
  return data as T[];
}

// Récupérer la liste de souhaits unifiée (films + séries)
export async function getWishlist(): Promise<WishListItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/wishlist`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch wishlist');
    }
    return parseArrayResponse<WishListItem>(response);
  } catch {
    return [];
  }
}

// Ajouter un film à la liste de souhaits
export async function addToWishlist(tmdbId: number): Promise<void> {
  await fetch(`${API_BASE_URL}/wishlist`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'movie',
      tmdbId: tmdbId,
    }),
  });
}

// Retirer un film de la liste de souhaits
export async function removeFromWishlist(movieId: number): Promise<void> {
  await fetch(`${API_BASE_URL}/wishlist/${movieId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

// Retirer plusieurs films de la liste de souhaits
export async function removeMultipleFromWishlist(movieIds: number[]): Promise<void> {
  await fetch(`${API_BASE_URL}/wishlists`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items: movieIds.map(id => ({ tmdbId: id, type: 'movie' })) }),
  });
}

// Vérifier si un film est dans la liste de souhaits
export async function isInWishlist(movieId: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/wishlist/${movieId}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return Boolean(data.exists);
  } catch {
    return false;
  }
}

// Obtenir le nombre d'éléments dans la liste de souhaits
export async function getWishlistCount(): Promise<number> {
  const wishlist = await getWishlist();
  return wishlist.length;
}
