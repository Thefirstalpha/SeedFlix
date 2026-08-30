import { Heart, Trash2, Tv, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getEpisodeCode, WishListCard } from '../components/WishListCard';
import { useI18n } from '../i18n/LanguageProvider';
import {
  getIndexerMovieResults,
  getIndexerSeriesResults,
  rejectAllIndexerResults,
  rejectIndexerResult,
} from '../services/indexerResultService';
import { addTorrentToClient } from '../services/torrentService';
import {
  getWishlist,
  removeMultipleFromWishlist,
  updateWishlistAutoGrab,
} from '../services/wishlistService';
import { WishListItem } from '../../../common/wishlist';
import { IndexerMovieResult, IndexerSeriesResult } from '../../../common/indexer';


function formatGroupedSeries(seriesItems: WishListItem[]) {
  return seriesItems
    .map((item) => {
      const seasonEntries = Object.entries(item.seasons)
        .map(([key, s]) => ({ seasonNumber: Number(key), all_episodes: s.all_episodes, episodes: s.episodes }))
        .sort((a, b) => a.seasonNumber - b.seasonNumber);
      const seasonsAllEpisodes = seasonEntries.filter((s) => s.all_episodes);
      const episodeEntries = seasonEntries
        .flatMap((s) => s.episodes.map((ep) => ({ seasonNumber: s.seasonNumber, episodeNumber: ep })))
        .sort((a, b) =>
          a.seasonNumber !== b.seasonNumber
            ? a.seasonNumber - b.seasonNumber
            : a.episodeNumber - b.episodeNumber,
        );
      return {
        tmdb: item.tmdb,
        title: item.title,
        poster_path: item.poster_path ?? '',
        genre: item.genre,
        rating: item.rating,
        all_seasons: item.all_seasons,
        releaseDate: item.releaseDate,
        seasons: seasonsAllEpisodes,
        episodes: episodeEntries,
        autoGrab: item.autoGrab,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
}

export function WishList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('movies');

  const [wishlist, setWishlist] = useState<WishListItem[]>([]);
  const [selectedMovieIds, setSelectedMovieIds] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const [selectedSeriesIds, setSelectedSeriesIds] = useState<number[]>([]);
  const [isSeriesSelectionMode, setIsSeriesSelectionMode] = useState(false);
  const [indexerMovieResults, setIndexerMovieResults] = useState<IndexerMovieResult[]>([]);
  const [indexerSeriesResults, setIndexerSeriesResults] = useState<IndexerSeriesResult[]>([]);
  const [indexerError, setIndexerError] = useState<string | null>(null);

  useEffect(() => {
    loadWishlist();
    loadIndexerResults();
  }, []);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab === 'movies' || requestedTab === 'series') {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  useEffect(() => {
    const targetKey = searchParams.get('target');
    if (!targetKey) {
      return;
    }

    const elementId = `wishlist-target-${encodeURIComponent(targetKey)}`;
    const timeoutId = window.setTimeout(() => {
      const element = document.getElementById(elementId);
      if (!element) {
        return;
      }

      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-cyan-400', 'ring-offset-2', 'ring-offset-slate-950');
      window.setTimeout(() => {
        element.classList.remove(
          'ring-2',
          'ring-cyan-400',
          'ring-offset-2',
          'ring-offset-slate-950',
        );
      }, 2200);
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [searchParams, activeTab, indexerMovieResults]);

  const loadWishlist = async () => {
    const data = await getWishlist();
    setWishlist(data);
    setSelectedMovieIds([]);
    setSelectedSeriesIds([]);
  };

  const loadIndexerResults = async () => {
    try {
      const moviesResults = await getIndexerMovieResults();
      setIndexerMovieResults(moviesResults);
      const seriesResults = await getIndexerSeriesResults();
      setIndexerSeriesResults(seriesResults);
      setIndexerError(null);
    } catch (error) {
      setIndexerError(error instanceof Error ? error.message : 'Failed to load indexer results');
    }
  };

  const movies = wishlist.filter((i) => i.type === 'movie');
  const seriesItems = wishlist.filter((i) => i.type === 'series');

  const toggleSelection = (tmdbId: number) => {
    setSelectedMovieIds((prev) =>
      prev.includes(tmdbId) ? prev.filter((id) => id !== tmdbId) : [...prev, tmdbId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedMovieIds.length === movies.length) {
      setSelectedMovieIds([]);
    } else {
      setSelectedMovieIds(movies.map((m) => m.tmdb));
    }
  };

  const handleRemoveSelected = async () => {
    if (selectedMovieIds.length > 0) {
      await removeMultipleFromWishlist(selectedMovieIds);
      await Promise.all([loadWishlist(), loadIndexerResults()]);
      setIsSelectionMode(false);
      window.dispatchEvent(new CustomEvent('seedflix:wishlist-refresh-request'));
      window.dispatchEvent(new CustomEvent('seedflix:notifications-refresh-request'));
    }
  };

  const cancelSelection = () => {
    setSelectedMovieIds([]);
    setIsSelectionMode(false);
  };

  // ── Series selection helpers ───────────────────────────────────────────────

  const toggleSeriesSelection = (tmdbId: number) => {
    setSelectedSeriesIds((prev) =>
      prev.includes(tmdbId) ? prev.filter((id) => id !== tmdbId) : [...prev, tmdbId],
    );
  };

  const toggleSelectAllSeries = () => {
    if (selectedSeriesIds.length === seriesItems.length) {
      setSelectedSeriesIds([]);
    } else {
      setSelectedSeriesIds(seriesItems.map((s) => s.tmdb));
    }
  };

  const handleRemoveSelectedSeries = async () => {
    if (selectedSeriesIds.length > 0) {
      await removeMultipleFromWishlist(selectedSeriesIds);
      await Promise.all([loadWishlist(), loadIndexerResults()]);
      setIsSeriesSelectionMode(false);
      window.dispatchEvent(new CustomEvent('seedflix:wishlist-refresh-request'));
      window.dispatchEvent(new CustomEvent('seedflix:notifications-refresh-request'));
    }
  };

  const cancelSeriesSelection = () => {
    setSelectedSeriesIds([]);
    setIsSeriesSelectionMode(false);
  };

  const groupedSeries = formatGroupedSeries(seriesItems);

  const uniqueSeriesCount = groupedSeries.length;
  const movieCountLabel = t(
    movies.length > 1 ? 'wishlistPage.summary.movies_many' : 'wishlistPage.summary.movies_one',
    { count: movies.length },
  );
  const seriesCountLabel = t(
    uniqueSeriesCount > 1 ? 'wishlistPage.summary.series_many' : 'wishlistPage.summary.series_one',
    { count: uniqueSeriesCount },
  );

  const movieResultsByTmdbId = new Map<string, IndexerMovieResult[]>();
  for (const result of indexerMovieResults) {
    const key = String(result.tmdbId ?? '');
    if (!movieResultsByTmdbId.has(key)) movieResultsByTmdbId.set(key, []);
    movieResultsByTmdbId.get(key)!.push(result);
  }

  const seriesResultsByTmdbId = new Map<string, IndexerSeriesResult[]>();
  for (const result of indexerSeriesResults) {
    const key = String(result.tmdbId ?? '');
    if (!seriesResultsByTmdbId.has(key)) seriesResultsByTmdbId.set(key, []);
    seriesResultsByTmdbId.get(key)!.push(result);
  }

  const handleRejectIndexerResult = async (target: IndexerMovieResult | IndexerSeriesResult) => {
    const key = `${target.guid}:reject`;
    setActionKey(key);
    try {
      await rejectIndexerResult(target.guid ?? '');
      await loadIndexerResults();
    } finally {
      setActionKey(null);
    }
  };

  const handleRejectAllIndexerResults = async (targets: (IndexerMovieResult | IndexerSeriesResult)[]) => {
    if (!targets.length) return;
    const groupKey = targets[0]?.tmdbId ?? '';
    setActionKey(`${groupKey}:reject-all`);
    try {
      await rejectAllIndexerResults(targets.map((t) => t.guid ?? '').filter(Boolean));
      await loadIndexerResults();
    } finally {
      setActionKey(null);
    }
  };

  const handleAddTorrent = async (
    target: IndexerMovieResult | IndexerSeriesResult,
    type: 'movie' | 'series',
  ) => {
    const key = `${target.guid}:add`;
    setActionKey(key);
    try {
      const tmdbId = target.tmdbId ? Number(target.tmdbId) : target.matchedWishlist?.tmdbId;
      const seasonNumber = 'seasonNumber' in target ? target.seasonNumber ?? target.matchedWishlist?.seasonNumber : target.matchedWishlist?.seasonNumber;
      const episodeNumber = 'episodeNumber' in target ? target.episodeNumber ?? target.matchedWishlist?.episodeNumber : target.matchedWishlist?.episodeNumber;

      await addTorrentToClient(target.guid, type, {
        tmdbId,
        seasonNumber: seasonNumber !== null && seasonNumber !== undefined ? Number(seasonNumber) : undefined,
        episodeNumber: episodeNumber !== null && episodeNumber !== undefined ? Number(episodeNumber) : undefined,
      });

      await Promise.allSettled([loadIndexerResults(), loadWishlist()]);
    } catch (error) {
      console.error('Error adding torrent from wishlist:', error);
    } finally {
      setActionKey(null);
    }
  };

  const handleToggleAutoGrab = async (
    tmdbId: number,
    type: 'movie' | 'series',
    autoGrab: boolean,
  ) => {
    // Optimistic update
    setWishlist((prev) =>
      prev.map((item) => {
        if (item.tmdb === tmdbId && item.type === type) {
          return { ...item, autoGrab };
        }
        return item;
      }),
    );
    await updateWishlistAutoGrab(tmdbId, type, autoGrab);
  };

  

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heart className="w-8 h-8 text-purple-400 fill-purple-400" />
          <div>
            <h2 className="text-3xl font-bold text-white">{t('wishlistPage.title')}</h2>
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
            {t('wishlistPage.tabs.movies', { count: movies.length })}
          </TabsTrigger>
          <TabsTrigger
            value="series"
            className="text-white data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
          >
            {t('wishlistPage.tabs.series', { count: uniqueSeriesCount })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movies" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-white">{t('wishlistPage.movies.title')}</h3>

            {movies.length > 0 && (
              <div className="flex gap-2">
                {!isSelectionMode ? (
                  <Button
                    onClick={() => setIsSelectionMode(true)}
                    variant="outline"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('wishlistPage.actions.manage')}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={cancelSelection}
                      variant="outline"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <X className="w-4 h-4 mr-2" />
                      {t('common.cancel')}
                    </Button>
                    <Button
                      onClick={toggleSelectAll}
                      variant="outline"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {selectedMovieIds.length === movies.length
                        ? t('wishlistPage.actions.deselectAll')
                        : t('wishlistPage.actions.selectAll')}
                    </Button>
                    <Button
                      onClick={handleRemoveSelected}
                      disabled={selectedMovieIds.length === 0}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('wishlistPage.actions.removeCount', { count: selectedMovieIds.length })}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {movies.length > 0 ? (
            <div className="space-y-4">
              {movies.map((movie) => {
                const movieTargets = movieResultsByTmdbId.get(`${movie.tmdb}`) ?? [];
                const movieYear = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : 0;
                return (
                  <div
                    key={movie.tmdb}
                    role={isSelectionMode ? undefined : 'button'}
                    tabIndex={isSelectionMode ? undefined : 0}
                    className={
                      isSelectionMode
                        ? undefined
                        : 'cursor-pointer hover:bg-white/10 hover:scale-[1.01] transition-all rounded-lg'
                    }
                    onClick={() => {
                      if (!isSelectionMode) {
                        navigate(`/movie/${movie.tmdb}`);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!isSelectionMode && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        navigate(`/movie/${movie.tmdb}`);
                      }
                    }}
                  >
                    <WishListCard
                      poster={movie.poster_path ?? ''}
                      title={movie.title}
                      year={movieYear}
                      rating={movie.rating ?? 0}
                      genre={movie.genre ?? ''}
                      autoGrab={movie.autoGrab}
                      onToggleAutoGrab={(val) => handleToggleAutoGrab(movie.tmdb, 'movie', val)}
                      targets={movieTargets}
                      type="movie"
                      actionKey={actionKey}
                      onRejectIndexerResult={handleRejectIndexerResult}
                      onRejectAllIndexerResults={handleRejectAllIndexerResults}
                      onAddTorrent={(t) => handleAddTorrent(t, 'movie')}
                    >
                      {isSelectionMode && (
                        <div
                          className="mb-2"
                        >
                          <Checkbox
                            checked={selectedMovieIds.includes(movie.tmdb)}
                            onCheckedChange={() => toggleSelection(movie.tmdb)}
                            className="border-slate-900"
                          />
                        </div>
                      )}
                    </WishListCard>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Heart className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold text-white mb-2">
                {t('wishlistPage.movies.emptyTitle')}
              </h3>
              <p className="text-white/60 mb-6">{t('wishlistPage.movies.emptyDescription')}</p>
              <Link to="/">
                <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                  {t('wishlistPage.movies.discover')}
                </Button>
              </Link>
            </div>
          )}
          {indexerError ? <p className="text-sm text-red-300">{indexerError}</p> : null}
        </TabsContent>

        <TabsContent value="series" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-2xl font-bold text-white">{t('wishlistPage.series.title')}</h3>

            {seriesItems.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {!isSeriesSelectionMode ? (
                  <Button
                    onClick={() => setIsSeriesSelectionMode(true)}
                    variant="outline"
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('wishlistPage.actions.manage')}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={cancelSeriesSelection}
                      variant="outline"
                      className="bg-cyan-600 hover:bg-cyan-700 text-white"
                    >
                      <X className="w-4 h-4 mr-2" />
                      {t('common.cancel')}
                    </Button>
                    <Button
                      onClick={toggleSelectAllSeries}
                      variant="outline"
                      className="bg-cyan-600 hover:bg-cyan-700 text-white"
                    >
                      {selectedSeriesIds.length === seriesItems.length
                        ? t('wishlistPage.actions.deselectAll')
                        : t('wishlistPage.actions.selectAll')}
                    </Button>
                    <Button
                      onClick={handleRemoveSelectedSeries}
                      disabled={selectedSeriesIds.length === 0}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('wishlistPage.actions.removeCount', { count: selectedSeriesIds.length })}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {groupedSeries.length > 0 ? (
            <div className="space-y-4">
              {groupedSeries.map((group) => {
                const year = group.releaseDate ? new Date(group.releaseDate).getFullYear() : 0;
                const groupTargets = seriesResultsByTmdbId.get(`${group.tmdb}`) ?? [];

                return (
                  <div
                    key={group.tmdb}
                    role={isSeriesSelectionMode ? undefined : 'button'}
                    tabIndex={isSeriesSelectionMode ? undefined : 0}
                    className={
                      isSeriesSelectionMode
                        ? undefined
                        : 'cursor-pointer hover:bg-white/10 hover:scale-[1.01] transition-all rounded-lg'
                    }
                    onClick={() => {
                      if (!isSeriesSelectionMode) {
                        navigate(`/series/${group.tmdb}`);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!isSeriesSelectionMode && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        navigate(`/series/${group.tmdb}`);
                      }
                    }}
                  >
                    <WishListCard
                      poster={group.poster_path}
                      title={group.title}
                      year={year}
                      genre={group.genre}
                      rating={group.rating}
                      autoGrab={group.autoGrab}
                      onToggleAutoGrab={(val) => handleToggleAutoGrab(group.tmdb, 'series', val)}
                      targets={groupTargets}
                      type="series"
                      actionKey={actionKey}
                      onRejectIndexerResult={handleRejectIndexerResult}
                      onRejectAllIndexerResults={handleRejectAllIndexerResults}
                      onAddTorrent={(t) => handleAddTorrent(t, 'series')}
                    >
                      {isSeriesSelectionMode && (
                        <div
                          className="mb-2"
                        >
                          <label className="inline-flex items-center gap-2 text-sm text-white/80">
                            <Checkbox
                              checked={selectedSeriesIds.includes(group.tmdb)}
                              onCheckedChange={() => toggleSeriesSelection(group.tmdb)}
                              className="border-white/40"
                            />
                            {t('wishlistPage.series.selectWhole')}
                          </label>
                        </div>
                      )}
                      <div className="space-y-3 pl-1">
                        {group.all_seasons && (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-cyan-600/20 text-cyan-200 border-cyan-500/30">
                              <Tv className="w-3 h-3 mr-1" />
                              {t('wishlistPage.series.fullSeries')}
                            </Badge>
                          </div>
                        )}
                        {group.seasons.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-white/60 text-xs uppercase tracking-wide">
                              {t('wishlistPage.series.seasons')}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {group.seasons.map((season) => (
                                <Badge
                                  key={season.seasonNumber}
                                  variant="outline"
                                  className="border-purple-500/50 text-purple-300"
                                >
                                  {t('wishlistPage.series.seasonNumber', {
                                    number: season.seasonNumber,
                                  })}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {group.episodes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-white/60 text-xs uppercase tracking-wide">
                              {t('wishlistPage.series.episodes')}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {group.episodes.map((episode) => (
                                <Badge
                                  key={`${episode.seasonNumber}-${episode.episodeNumber}`}
                                  variant="outline"
                                  className="border-white/20 text-white/70"
                                >
                                  {getEpisodeCode(
                                    '',
                                    episode.seasonNumber,
                                    episode.episodeNumber,
                                  )}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </WishListCard>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Tv className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {t('wishlistPage.series.emptyTitle')}
              </h3>
              <p className="text-white/60 mb-6">{t('wishlistPage.series.emptyDescription')}</p>
              <Link to="/">
                <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
                  {t('wishlistPage.series.discover')}
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
