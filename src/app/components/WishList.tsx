import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Heart, Trash2, X } from "lucide-react";
import { Button } from "./ui/button";
import { MovieCard } from "./MovieCard";
import { Checkbox } from "./ui/checkbox";
import { Card, CardContent } from "./ui/card";
import { getWishlist, removeMultipleFromWishlist } from "../services/wishlistService";
import type { Movie } from "../types/movie";

export function WishList() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  useEffect(() => {
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    const wishlist = await getWishlist();
    setMovies(wishlist);
    setSelectedIds([]);
  };

  const toggleSelection = (movieId: number) => {
    if (selectedIds.includes(movieId)) {
      setSelectedIds(selectedIds.filter(id => id !== movieId));
    } else {
      setSelectedIds([...selectedIds, movieId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === movies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(movies.map(m => m.id));
    }
  };

  const handleRemoveSelected = async () => {
    if (selectedIds.length > 0) {
      await removeMultipleFromWishlist(selectedIds);
      await loadWishlist();
      setIsSelectionMode(false);
    }
  };

  const cancelSelection = () => {
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="w-8 h-8 text-purple-400 fill-purple-400" />
          <div>
            <h2 className="text-3xl font-bold text-white">Ma liste de souhaits</h2>
            <p className="text-white/60">{movies.length} film{movies.length > 1 ? 's' : ''}</p>
          </div>
        </div>

        {movies.length > 0 && (
          <div className="flex gap-2">
            {!isSelectionMode ? (
              <Button
                onClick={() => setIsSelectionMode(true)}
                variant="outline"
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Gérer la liste
              </Button>
            ) : (
              <>
                <Button
                  onClick={cancelSelection}
                  variant="outline"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
                <Button
                  onClick={toggleSelectAll}
                  variant="outline"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {selectedIds.length === movies.length ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
                <Button
                  onClick={handleRemoveSelected}
                  disabled={selectedIds.length === 0}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Retirer ({selectedIds.length})
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Movies Grid */}
      {movies.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {movies.map((movie) => (
            <div key={movie.id} className="relative">
              {isSelectionMode && (
                <div className="absolute top-2 left-2 z-10">
                  <Card className="bg-white/90 border-none shadow-lg">
                    <CardContent className="p-2">
                      <Checkbox
                        checked={selectedIds.includes(movie.id)}
                        onCheckedChange={() => toggleSelection(movie.id)}
                        className="border-slate-900"
                      />
                    </CardContent>
                  </Card>
                </div>
              )}
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <Heart className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h3 className="text-2xl font-semibold text-white mb-2">
            Votre liste est vide
          </h3>
          <p className="text-white/60 mb-6">
            Ajoutez vos films préférés à votre liste de souhaits
          </p>
          <Link to="/">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              Découvrir des films
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
