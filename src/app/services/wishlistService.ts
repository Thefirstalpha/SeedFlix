import { API_BASE_URL } from '../config/tmdb';
import type { Movie } from '../types/movie';

async function parseArrayResponse<T>(response: Response): Promise<T[]> {
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// Récupérer la liste de souhaits
export async function getWishlist(): Promise<Movie[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/wishlist`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch wishlist');
    }
    return parseArrayResponse<Movie>(response);
  } catch {
    return [];
  }
}

// Ajouter un film à la liste de souhaits
export async function addToWishlist(movie: Movie): Promise<void> {
  await fetch(`${API_BASE_URL}/wishlist`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(movie),
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
  await fetch(`${API_BASE_URL}/wishlist`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: movieIds }),
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
