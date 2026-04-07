import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Heart, Trash2, Tv, X } from "lucide-react";
import { Button } from "./ui/button";
import { MovieCard } from "./MovieCard";
import { Checkbox } from "./ui/checkbox";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { getWishlist, removeMultipleFromWishlist } from "../services/wishlistService";
import {
  getSeriesWishlist,
  removeMultipleFromSeriesWishlist,
} from "../services/seriesWishlistService";
import type { Movie } from "../types/movie";
import type { SeriesWishlistEntry } from "../types/seriesWishlist";

export function WishList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("movies");

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

  const groupedSeries = seriesEntries.reduce<
    Array<{
      seriesId: number;
      seriesTitle: string;
      seriesPoster: string;
      seriesEntry?: SeriesWishlistEntry;
      seasons: SeriesWishlistEntry[];
      episodes: SeriesWishlistEntry[];
    }>
  >((groups, entry) => {
    const existing = groups.find((g) => g.seriesId === entry.seriesId);
    const group =
      existing ||
      {
        seriesId: entry.seriesId,
        seriesTitle: entry.seriesTitle,
        seriesPoster: entry.seriesPoster,
        seasons: [],
        episodes: [],
      };

    if (!existing) {
      groups.push(group);
    }

    if (entry.type === "series") {
      group.seriesEntry = entry;
    } else if (entry.type === "season") {
      group.seasons.push(entry);
    } else {
      group.episodes.push(entry);
    }

    return groups;
  }, []);

  groupedSeries.sort((a, b) => a.seriesTitle.localeCompare(b.seriesTitle, "fr"));
  for (const group of groupedSeries) {
    group.seasons.sort((a, b) => (a.seasonNumber || 0) - (b.seasonNumber || 0));
    group.episodes.sort((a, b) => {
      const seasonDelta = (a.seasonNumber || 0) - (b.seasonNumber || 0);
      if (seasonDelta !== 0) return seasonDelta;
      return (a.episodeNumber || 0) - (b.episodeNumber || 0);
    });
  }

  const uniqueSeriesCount = groupedSeries.length;

  const getGroupEntryIds = (group: {
    seriesEntry?: SeriesWishlistEntry;
    seasons: SeriesWishlistEntry[];
    episodes: SeriesWishlistEntry[];
  }) => {
    const ids: string[] = [];
    if (group.seriesEntry) {
      ids.push(group.seriesEntry.entryId);
    }
    ids.push(...group.seasons.map((season) => season.entryId));
    ids.push(...group.episodes.map((episode) => episode.entryId));
    return ids;
  };

  const isGroupFullySelected = (group: {
    seriesEntry?: SeriesWishlistEntry;
    seasons: SeriesWishlistEntry[];
    episodes: SeriesWishlistEntry[];
  }) => {
    const ids = getGroupEntryIds(group);
    if (ids.length === 0) return false;
    return ids.every((id) => selectedEntryIds.includes(id));
  };

  const toggleSeriesGroup = (group: {
    seriesEntry?: SeriesWishlistEntry;
    seasons: SeriesWishlistEntry[];
    episodes: SeriesWishlistEntry[];
  }) => {
    const ids = getGroupEntryIds(group);
    if (ids.length === 0) return;

    setSelectedEntryIds((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !ids.includes(id));
      }
      return Array.from(new Set([...prev, ...ids]));
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="w-8 h-8 text-purple-400 fill-purple-400" />
          <div>
            <h2 className="text-3xl font-bold text-white">Ma liste de souhaits</h2>
            <p className="text-white/60">
              {movies.length} film{movies.length > 1 ? "s" : ""} • {uniqueSeriesCount} série
              {uniqueSeriesCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white/10 border border-white/10 w-full max-w-md">
          <TabsTrigger
            value="movies"
            className="text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white"
          >
            Films ({movies.length})
          </TabsTrigger>
          <TabsTrigger
            value="series"
            className="text-white data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
          >
            Séries ({uniqueSeriesCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movies" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-white">Mes films</h3>

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
                      {selectedIds.length === movies.length
                        ? "Tout désélectionner"
                        : "Tout sélectionner"}
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
        </TabsContent>

        <TabsContent value="series" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-2xl font-bold text-white">Mes séries</h3>

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

          {groupedSeries.length > 0 ? (
            <div className="space-y-4">
              {groupedSeries.map((group) => (
                <Card
                  key={group.seriesId}
                  onClick={() => {
                    if (!isSeriesSelectionMode) {
                      navigate(`/series/${group.seriesId}`);
                    }
                  }}
                  className={`border-white/10 bg-white/5 transition-all ${
                    isSeriesSelectionMode
                      ? ""
                      : "cursor-pointer hover:bg-white/10 hover:scale-[1.01]"
                  }`}
                >
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-start gap-4">
                      <img
                        src={group.seriesPoster}
                        alt={group.seriesTitle}
                        className="w-16 rounded object-cover aspect-[2/3]"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-lg hover:text-cyan-300 transition-colors">
                          {group.seriesTitle}
                        </p>
                        <p className="text-white/60 text-sm mt-1">
                          {group.seriesEntry ? "Série complète favorite" : "Favoris partiels"}
                        </p>

                        {isSeriesSelectionMode && (
                          <div
                            className="mt-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <label className="inline-flex items-center gap-2 text-sm text-white/80">
                              <Checkbox
                                checked={isGroupFullySelected(group)}
                                onCheckedChange={() => toggleSeriesGroup(group)}
                                className="border-white/40"
                              />
                              Sélectionner toute la série (saisons + épisodes)
                            </label>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 pl-1">
                      {group.seriesEntry && (
                        <div
                          className="flex items-center gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {isSeriesSelectionMode && (
                            <Checkbox
                              checked={selectedEntryIds.includes(group.seriesEntry.entryId)}
                              onCheckedChange={() => toggleSeriesEntry(group.seriesEntry!.entryId)}
                              className="border-white/40"
                            />
                          )}
                          <Badge className="bg-cyan-600/20 text-cyan-200 border-cyan-500/30">
                            <Tv className="w-3 h-3 mr-1" />
                            Série complète
                          </Badge>
                        </div>
                      )}

                      {group.seasons.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-white/60 text-xs uppercase tracking-wide">Saisons</p>
                          <div className="flex flex-wrap gap-2">
                            {group.seasons.map((season) => (
                              <div
                                key={season.entryId}
                                className="flex items-center gap-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {isSeriesSelectionMode && (
                                  <Checkbox
                                    checked={selectedEntryIds.includes(season.entryId)}
                                    onCheckedChange={() => toggleSeriesEntry(season.entryId)}
                                    className="border-white/40"
                                  />
                                )}
                                <Badge
                                  variant="outline"
                                  className="border-purple-500/50 text-purple-300"
                                >
                                  {season.seasonName ?? `Saison ${season.seasonNumber}`}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {group.episodes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-white/60 text-xs uppercase tracking-wide">Épisodes</p>
                          <div className="flex flex-wrap gap-2">
                            {group.episodes.map((episode) => (
                              <div
                                key={episode.entryId}
                                className="flex items-center gap-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {isSeriesSelectionMode && (
                                  <Checkbox
                                    checked={selectedEntryIds.includes(episode.entryId)}
                                    onCheckedChange={() => toggleSeriesEntry(episode.entryId)}
                                    className="border-white/40"
                                  />
                                )}
                                <Badge
                                  variant="outline"
                                  className="border-white/20 text-white/70"
                                >
                                  S{episode.seasonNumber}E{episode.episodeNumber}
                                  {episode.episodeName ? ` – ${episode.episodeName}` : ""}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
