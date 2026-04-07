import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Heart, Trash2, Tv, X } from "lucide-react";
import { Button } from "./ui/button";
import { MovieCard } from "./MovieCard";
import { Checkbox } from "./ui/checkbox";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { getWishlist, removeMultipleFromWishlist } from "../services/wishlistService";
import {
  getSeriesWishlist,
  removeMultipleFromSeriesWishlist,
} from "../services/seriesWishlistService";
import type { Movie } from "../types/movie";
import type { SeriesWishlistEntry } from "../types/seriesWishlist";

export function WishList() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const [seriesEntries, setSeriesEntries] = useState<SeriesWishlistEntry[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [isSeriesSelectionMode, setIsSeriesSelectionMode] = useState(false);

  useEffect(() => {
    loadWishlist();
    loadSeriesWishlist();
  }, []);

  const loadWishlist = async () => {
    const wishlist = await getWishlist();
    setMovies(wishlist);
    setSelectedIds([]);
  };

  const loadSeriesWishlist = async () => {
    const entries = await getSeriesWishlist();
    setSeriesEntries(entries);
    setSelectedEntryIds([]);
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

  // ── Series selection helpers ───────────────────────────────────────────────

  const toggleSeriesEntry = (entryId: string) => {
    setSelectedEntryIds((prev) =>
      prev.includes(entryId)
        ? prev.filter((id) => id !== entryId)
        : [...prev, entryId]
    );
  };

  const toggleSelectAllSeries = () => {
    if (selectedEntryIds.length === seriesEntries.length) {
      setSelectedEntryIds([]);
    } else {
      setSelectedEntryIds(seriesEntries.map((e) => e.entryId));
    }
  };

  const handleRemoveSelectedSeries = async () => {
    if (selectedEntryIds.length > 0) {
      await removeMultipleFromSeriesWishlist(selectedEntryIds);
      await loadSeriesWishlist();
      setIsSeriesSelectionMode(false);
    }
  };

  const cancelSeriesSelection = () => {
    setSelectedEntryIds([]);
    setIsSeriesSelectionMode(false);
  };

  // ── Series entry label ─────────────────────────────────────────────────────

  const entryLabel = (entry: SeriesWishlistEntry) => {
    if (entry.type === "series") return "Série complète";
    if (entry.type === "season")
      return entry.seasonName ?? `Saison ${entry.seasonNumber}`;
    return `S${entry.seasonNumber}E${entry.episodeNumber}${
      entry.episodeName ? ` – ${entry.episodeName}` : ""
    }`;
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
        <div className="text-center py-12">
          <Heart className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h3 className="text-2xl font-semibold text-white mb-2">
            Votre liste de films est vide
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

      {/* ── Series wishlist section ───────────────────────────────────────── */}
      <div className="space-y-6 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Tv className="w-7 h-7 text-cyan-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Mes séries</h2>
              <p className="text-white/60">
                {seriesEntries.length} favori
                {seriesEntries.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {seriesEntries.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {!isSeriesSelectionMode ? (
                <Button
                  onClick={() => setIsSeriesSelectionMode(true)}
                  variant="outline"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Gérer la liste
                </Button>
              ) : (
                <>
                  <Button
                    onClick={cancelSeriesSelection}
                    variant="outline"
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Annuler
                  </Button>
                  <Button
                    onClick={toggleSelectAllSeries}
                    variant="outline"
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    {selectedEntryIds.length === seriesEntries.length
                      ? "Tout désélectionner"
                      : "Tout sélectionner"}
                  </Button>
                  <Button
                    onClick={handleRemoveSelectedSeries}
                    disabled={selectedEntryIds.length === 0}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Retirer ({selectedEntryIds.length})
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {seriesEntries.length > 0 ? (
          <div className="space-y-3">
            {seriesEntries.map((entry) => (
              <div
                key={entry.entryId}
                className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4"
              >
                {isSeriesSelectionMode && (
                  <Checkbox
                    checked={selectedEntryIds.includes(entry.entryId)}
                    onCheckedChange={() => toggleSeriesEntry(entry.entryId)}
                    className="border-white/40"
                  />
                )}

                <Link to={`/series/${entry.seriesId}`} className="shrink-0">
                  <img
                    src={entry.seriesPoster}
                    alt={entry.seriesTitle}
                    className="w-12 h-18 rounded object-cover aspect-[2/3] w-12"
                  />
                </Link>

                <div className="flex-1 min-w-0">
                  <Link
                    to={`/series/${entry.seriesId}`}
                    className="text-white font-semibold hover:text-cyan-300 transition-colors line-clamp-1"
                  >
                    {entry.seriesTitle}
                  </Link>
                  <Badge
                    variant="outline"
                    className={`mt-1 text-xs ${
                      entry.type === "series"
                        ? "border-cyan-500/50 text-cyan-300"
                        : entry.type === "season"
                        ? "border-purple-500/50 text-purple-300"
                        : "border-white/20 text-white/60"
                    }`}
                  >
                    {entry.type === "series" && (
                      <Tv className="w-3 h-3 mr-1" />
                    )}
                    {entryLabel(entry)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Tv className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Aucune série en favoris
            </h3>
            <p className="text-white/60 mb-6">
              Ajoutez des séries, saisons ou épisodes depuis leur page de détails
            </p>
            <Link to="/">
              <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
                Découvrir des séries
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
