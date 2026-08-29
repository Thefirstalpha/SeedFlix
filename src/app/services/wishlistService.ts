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
export async function addToWishlist(tmdbId: number, autoGrab?: boolean): Promise<void> {
  await fetch(`${API_BASE_URL}/wishlist`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'movie',
      tmdbId: tmdbId,
      autoGrab: Boolean(autoGrab),
    }),
  });
}

// Mettre à jour le statut Auto-Grab d'un élément
export async function updateWishlistAutoGrab(
  tmdbId: number,
  type: 'movie' | 'series',
  autoGrab: boolean,
  season?: number,
  episode?: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/wishlist/${tmdbId}/autograb`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        autoGrab,
        season,
        episode,
      }),
    });
    window.dispatchEvent(new CustomEvent('seedflix:wishlist-refresh-request'));
    return res.ok;
  } catch {
    return false;
  }
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

// Vérifier si un film ou une série est dans la liste de souhaits
export async function checkMediaInWishlist(id: number, type: 'movie' | 'series'): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/wishlist/${id}?type=${type}`, {
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

// Récupérer les détails d'un élément de la liste de souhaits
export async function getWishlistItem(id: number, type: 'movie' | 'series'): Promise<WishListItem | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/wishlist/${id}?type=${type}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.exists && data.content ? (data.content as WishListItem) : null;
  } catch {
    return null;
  }
}

// Alias pour compatibilité
export const isInWishlist = (movieId: number): Promise<boolean> => checkMediaInWishlist(movieId, 'movie');

// Basculer l'état dans la liste de souhaits (ajout si absent, retrait si présent)
export async function toggleWishlistMedia(
  id: number,
  type: 'movie' | 'series',
  currentlyInWishlist: boolean,
  autoGrab?: boolean,
): Promise<boolean> {
  if (currentlyInWishlist) {
    if (type === 'movie') {
      await removeFromWishlist(id);
    } else {
      await fetch(`${API_BASE_URL}/wishlist`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'series', tmdbId: id }),
      });
    }
    window.dispatchEvent(new CustomEvent('seedflix:wishlist-refresh-request'));
    return false;
  } else {
    if (type === 'movie') {
      await addToWishlist(id, autoGrab);
    } else {
      await fetch(`${API_BASE_URL}/wishlist`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'series', tmdbId: id, autoGrab: Boolean(autoGrab) }),
      });
    }
    window.dispatchEvent(new CustomEvent('seedflix:wishlist-refresh-request'));
    return true;
  }
}

// Obtenir le nombre d'éléments dans la liste de souhaits
export async function getWishlistCount(): Promise<number> {
  const wishlist = await getWishlist();
  return wishlist.length;
}
