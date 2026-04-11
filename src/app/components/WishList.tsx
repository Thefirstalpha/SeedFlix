import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Download, Heart, Trash2, Tv, X } from "lucide-react";
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
import { addTorrentToClient } from "../services/torrentService";
import {
  getIndexerResults,
  rejectIndexerResult,
  validateIndexerResult,
  type IndexerResultTarget,
} from "../services/indexerResultService";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/LanguageProvider";
import type { Movie } from "../types/movie";
import type { SeriesWishlistEntry } from "../types/seriesWishlist";

export function WishList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const { settings } = useAuth();
  const [activeTab, setActiveTab] = useState("movies");

  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const [seriesEntries, setSeriesEntries] = useState<SeriesWishlistEntry[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [isSeriesSelectionMode, setIsSeriesSelectionMode] = useState(false);
  const [indexerTargets, setIndexerTargets] = useState<IndexerResultTarget[]>([]);
  const [indexerError, setIndexerError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  useEffect(() => {
    loadWishlist();
    loadSeriesWishlist();
    loadIndexerResults();
  }, []);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "movies" || requestedTab === "series") {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  useEffect(() => {
    const targetKey = searchParams.get("target");
    if (!targetKey) {
      return;
    }

    const elementId = `wishlist-target-${encodeURIComponent(targetKey)}`;
    const timeoutId = window.setTimeout(() => {
      const element = document.getElementById(elementId);
      if (!element) {
        return;
      }

      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-cyan-400", "ring-offset-2", "ring-offset-slate-950");
      window.setTimeout(() => {
        element.classList.remove("ring-2", "ring-cyan-400", "ring-offset-2", "ring-offset-slate-950");
      }, 2200);
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [searchParams, activeTab, indexerTargets]);

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

  const loadIndexerResults = async () => {
    try {
      const results = await getIndexerResults();
      setIndexerTargets(results);
      setIndexerError(null);
    } catch (error) {
      setIndexerError(error instanceof Error ? error.message : "Failed to load indexer results");
    }
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
      await Promise.all([loadWishlist(), loadIndexerResults()]);
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
      await Promise.all([loadSeriesWishlist(), loadIndexerResults()]);
      setIsSeriesSelectionMode(false);
    }
  };

  const handleRejectIndexerResult = async (targetKey: string, indexerStateKey: string) => {
    const key = `${targetKey}:${indexerStateKey}:reject`;
    setActionKey(key);
    try {
      await rejectIndexerResult(targetKey, indexerStateKey);
      await loadIndexerResults();
    } finally {
      setActionKey(null);
    }
  };

  const handleRejectAllIndexerResults = async (target: IndexerResultTarget) => {
    if (!target.items.length) {
      return;
    }

    const key = `${target.targetKey}:reject-all`;
    setActionKey(key);
    try {
      await Promise.all(
        target.items.map((item) => rejectIndexerResult(target.targetKey, item.indexerStateKey))
      );
      await loadIndexerResults();
    } finally {
      setActionKey(null);
    }
  };

  const handleAddTorrentFromWishlist = async (
    target: IndexerResultTarget,
    torrentUrl: string,
    indexerStateKey: string
  ) => {
    const key = `${target.targetKey}:${indexerStateKey}:add`;
    setActionKey(key);
    try {
      const mediaType = target.targetType === "movie" ? "movie" : "series";
      await addTorrentToClient(torrentUrl, mediaType, target.targetKey);
      
      // Validate indexer result (best effort)
      try {
        await validateIndexerResult(target.targetKey, indexerStateKey);
      } catch {
        // Silent fail - indexer validation is optional
      }
      
      // Reload data (best effort - continue even if one fails)
      await Promise.allSettled([loadIndexerResults(), loadWishlist(), loadSeriesWishlist()]);
    } catch (error) {
      console.error("Error adding torrent from wishlist:", error);
      // Data stays visible even if error occurs
    } finally {
      setActionKey(null);
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
  const movieCountLabel = t(
    movies.length > 1 ? "wishlistPage.summary.movies_many" : "wishlistPage.summary.movies_one",
    { count: movies.length }
  );
  const seriesCountLabel = t(
    uniqueSeriesCount > 1 ? "wishlistPage.summary.series_many" : "wishlistPage.summary.series_one",
    { count: uniqueSeriesCount }
  );

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

  const indexerTargetsByKey = new Map(
    indexerTargets.map((target) => [target.targetKey, target])
  );

  const spoilerModeEnabled = Boolean(
    (settings?.placeholders?.preferences as Record<string, unknown> | undefined)?.spoilerMode
  );

  const getEpisodeCode = (targetKey: string, fallbackSeason?: number | null, fallbackEpisode?: number | null) => {
    const match = String(targetKey || "").match(/^episode:\d+:(\d+):(\d+)$/i);
    const season = match?.[1] ? Number(match[1]) : Number(fallbackSeason || 0);
    const episode = match?.[2] ? Number(match[2]) : Number(fallbackEpisode || 0);
    if (!Number.isFinite(season) || !Number.isFinite(episode) || season <= 0 || episode <= 0) {
      return "";
    }
    return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
  };

  const getSpoilerSafeIndexerLabel = (target: IndexerResultTarget) => {
    if (!spoilerModeEnabled || target.targetType !== "episode") {
      return target.label || target.title;
    }

    const episodeCode = getEpisodeCode(target.targetKey);
    return episodeCode ? `${target.title} - ${episodeCode}` : target.title;
  };

  const renderIndexerTarget = (target: IndexerResultTarget, stopPropagation = false) => {
    if (!target.items.length) {
      return null;
    }

    return (
      <div
        key={target.targetKey}
        id={`wishlist-target-${encodeURIComponent(target.targetKey)}`}
        className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-3"
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-white font-medium">{getSpoilerSafeIndexerLabel(target)}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="border-white/20 text-white/70">
              {target.items.length}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                if (stopPropagation) {
                  event.stopPropagation();
                }
                handleRejectAllIndexerResults(target);
              }}
              disabled={actionKey === `${target.targetKey}:reject-all`}
              className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
            >
              {actionKey === `${target.targetKey}:reject-all` 
                ? t("wishlistPage.indexerResults.actions.rejectingAll")
                : t("wishlistPage.indexerResults.actions.rejectAll")}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {target.items.map((item) => {
            const torrentUrl = item.downloadUrl || item.link;
            const addKey = `${target.targetKey}:${item.indexerStateKey}:add`;
            const rejectKey = `${target.targetKey}:${item.indexerStateKey}:reject`;

            return (
              <div
                key={item.indexerStateKey}
                className="rounded border border-white/10 bg-slate-900/60 p-3 space-y-2"
              >
                <p className="text-sm text-white font-medium break-all">{item.title}</p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={(event) => {
                      if (stopPropagation) {
                        event.stopPropagation();
                      }
                      handleAddTorrentFromWishlist(target, torrentUrl, item.indexerStateKey);
                    }}
                    disabled={actionKey === addKey}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {actionKey === addKey
                      ? t("wishlistPage.indexerResults.actions.adding")
                      : t("wishlistPage.indexerResults.actions.add")}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      if (stopPropagation) {
                        event.stopPropagation();
                      }
                      handleRejectIndexerResult(target.targetKey, item.indexerStateKey);
                    }}
                    disabled={actionKey === rejectKey}
                    className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
                  >
                    {t("wishlistPage.indexerResults.actions.reject")}
                  </Button>

                  {item.quality ? (
                    <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                      {item.quality}
                    </Badge>
                  ) : null}

                  {item.language ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-300"
                    >
                      {item.language}
                    </Badge>
                  ) : null}

                  {item.sizeHuman ? (
                    <Badge variant="outline" className="border-white/30 text-white/80">
                      {item.sizeHuman}
                    </Badge>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="w-8 h-8 text-purple-400 fill-purple-400" />
          <div>
            <h2 className="text-3xl font-bold text-white">{t("wishlistPage.title")}</h2>
            <p className="text-white/60">
              {movieCountLabel} • {seriesCountLabel}
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
            {t("wishlistPage.tabs.movies", { count: movies.length })}
          </TabsTrigger>
          <TabsTrigger
            value="series"
            className="text-white data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
          >
            {t("wishlistPage.tabs.series", { count: uniqueSeriesCount })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movies" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-white">{t("wishlistPage.movies.title")}</h3>

            {movies.length > 0 && (
              <div className="flex gap-2">
                {!isSelectionMode ? (
                  <Button
                    onClick={() => setIsSelectionMode(true)}
                    variant="outline"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t("wishlistPage.actions.manage")}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={cancelSelection}
                      variant="outline"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <X className="w-4 h-4 mr-2" />
                      {t("common.cancel")}
                    </Button>
                    <Button
                      onClick={toggleSelectAll}
                      variant="outline"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {selectedIds.length === movies.length
                        ? t("wishlistPage.actions.deselectAll")
                        : t("wishlistPage.actions.selectAll")}
                    </Button>
                    <Button
                      onClick={handleRemoveSelected}
                      disabled={selectedIds.length === 0}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t("wishlistPage.actions.removeCount", { count: selectedIds.length })}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {movies.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {movies.map((movie) => {
                const movieIndexerTarget = indexerTargetsByKey.get(`movie:${movie.id}`);
                return (
                <div key={movie.id} className="relative space-y-3">
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
                  {movieIndexerTarget ? renderIndexerTarget(movieIndexerTarget) : null}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Heart className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold text-white mb-2">
                {t("wishlistPage.movies.emptyTitle")}
              </h3>
              <p className="text-white/60 mb-6">
                {t("wishlistPage.movies.emptyDescription")}
              </p>
              <Link to="/">
                <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                  {t("wishlistPage.movies.discover")}
                </Button>
              </Link>
            </div>
          )}
          {indexerError ? <p className="text-sm text-red-300">{indexerError}</p> : null}
        </TabsContent>

        <TabsContent value="series" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-2xl font-bold text-white">{t("wishlistPage.series.title")}</h3>

            {seriesEntries.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {!isSeriesSelectionMode ? (
                  <Button
                    onClick={() => setIsSeriesSelectionMode(true)}
                    variant="outline"
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t("wishlistPage.actions.manage")}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={cancelSeriesSelection}
                      variant="outline"
                      className="bg-cyan-600 hover:bg-cyan-700 text-white"
                    >
                      <X className="w-4 h-4 mr-2" />
                      {t("common.cancel")}
                    </Button>
                    <Button
                      onClick={toggleSelectAllSeries}
                      variant="outline"
                      className="bg-cyan-600 hover:bg-cyan-700 text-white"
                    >
                      {selectedEntryIds.length === seriesEntries.length
                        ? t("wishlistPage.actions.deselectAll")
                        : t("wishlistPage.actions.selectAll")}
                    </Button>
                    <Button
                      onClick={handleRemoveSelectedSeries}
                      disabled={selectedEntryIds.length === 0}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t("wishlistPage.actions.removeCount", { count: selectedEntryIds.length })}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {groupedSeries.length > 0 ? (
            <div className="space-y-4">
              {groupedSeries.map((group) => {
                const seriesIndexerKeys = Array.from(
                  new Set([
                    `series:${group.seriesId}`,
                    ...group.seasons.map((season) => `season:${group.seriesId}:${season.seasonNumber}`),
                    ...group.episodes.map(
                      (episode) =>
                        `episode:${group.seriesId}:${episode.seasonNumber}:${episode.episodeNumber}`
                    ),
                  ])
                );
                const groupIndexerTargets = seriesIndexerKeys
                  .map((key) => indexerTargetsByKey.get(key))
                  .filter((target): target is IndexerResultTarget => Boolean(target));

                return (
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
                          {group.seriesEntry ? t("wishlistPage.series.fullFavorite") : t("wishlistPage.series.partialFavorite")}
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
                              {t("wishlistPage.series.selectWhole")}
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
                            {t("wishlistPage.series.fullSeries")}
                          </Badge>
                        </div>
                      )}

                      {group.seasons.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-white/60 text-xs uppercase tracking-wide">{t("wishlistPage.series.seasons")}</p>
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
                                  {season.seasonName ?? t("wishlistPage.series.seasonNumber", { number: season.seasonNumber || 0 })}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {group.episodes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-white/60 text-xs uppercase tracking-wide">{t("wishlistPage.series.episodes")}</p>
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
                                  {getEpisodeCode("", episode.seasonNumber, episode.episodeNumber)}
                                  {!spoilerModeEnabled && episode.episodeName
                                    ? ` - ${episode.episodeName}`
                                    : ""}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {groupIndexerTargets.length > 0 ? (
                        <div className="space-y-3" onClick={(event) => event.stopPropagation()}>
                          {groupIndexerTargets.map((target) => renderIndexerTarget(target, true))}
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Tv className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {t("wishlistPage.series.emptyTitle")}
              </h3>
              <p className="text-white/60 mb-6">
                {t("wishlistPage.series.emptyDescription")}
              </p>
              <Link to="/">
                <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
                  {t("wishlistPage.series.discover")}
                </Button>
              </Link>
            </div>
          )}
          {indexerError ? <p className="text-sm text-red-300">{indexerError}</p> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
