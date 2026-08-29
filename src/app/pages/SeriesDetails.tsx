import { ArrowLeft, Calendar, Clapperboard, Heart, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { TorrentResultsPanel, FilterOption } from '../components/TorrentResultsPanel';
import { TrailersSection } from '../components/TrailersSection';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { WishlistButtons, WishlistMode } from '../components/WishlistDropdown';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/LanguageProvider';
import { normalizeIndexerLanguage, normalizeQuality } from '../services/indexerNormalization';
import {
  getSeriesById,
  getSeriesSeasonEpisodes,
  searchSeriesReleases,
} from '../services/seriesService';
import {
  addToWishlist,
  getSeriesWishlistStatus,
  removeFromWishlist,
} from '../services/seriesWishlistService';
import { updateWishlistAutoGrab } from '../services/wishlistService';
import { getTmdbVideos, extractTrailers, TmdbVideo } from '../services/tmdbService';
import { buildTorrentResultsLabels } from '../services/torrentResultsLabels';
import type { SeriesDetails as SeriesDetailsModel, SeriesEpisode } from '../types/series';
import { WishListItem } from '../../../common/wishlist';
import { IndexerSeriesResult } from '../../../common/indexer';
import { SimilarMediaSection } from '../components/SimilarMediaSection';
import { PersonFilmographyModal } from '../components/PersonFilmographyModal';


const SERIES_QUALITY_FILTERS = new Set(['all', '2160p', '1080p', '720p', '480p', 'bluray', 'webdl', 'hdtv']);

function getSeasonWishlistMode(
  wishlistStatus: WishListItem | undefined,
  seasonNumber: number | null,
): WishlistMode {
  if (!wishlistStatus || seasonNumber === null) return 'none';
  const season = wishlistStatus.seasons?.[seasonNumber];
  if (!season || !season.all_episodes) return 'none';
  return season.autoGrab ? 'autograb' : 'classic';
}

function getEpisodeWishlistMode(
  wishlistStatus: WishListItem | undefined,
  seasonNumber: number | null,
  episodeNumber: number,
): WishlistMode {
  if (!wishlistStatus || seasonNumber === null) return 'none';
  const season = wishlistStatus.seasons?.[seasonNumber];
  if (!season || season.all_episodes) return 'none';
  if (!season.episodes?.includes(episodeNumber)) return 'none';
  const isAutoGrab = Boolean(
    season.autoGrab || season.autoGrabEpisodes?.includes(episodeNumber),
  );
  return isAutoGrab ? 'autograb' : 'classic';
}

interface SeriesSeasonsAndEpisodesProps {
  availableSeasons: SeriesDetailsModel['seasons'];
  selectedSeason: number | null;
  setSelectedSeason: (s: number) => void;
  wishlistStatus: WishListItem | undefined;
  isSeasonCoveredBySeries: boolean;
  handleSelectSeasonMode: (season: number, mode: WishlistMode) => void;
  isLoadingEpisodes: boolean;
  episodes: SeriesEpisode[];
  spoilerModeEnabled: boolean;
  revealedEpisodeIds: number[];
  toggleEpisodeReveal: (id: number) => void;
  handleSelectEpisodeMode: (season: number, ep: number, mode: WishlistMode) => void;
  t: (k: string, params?: Record<string, any>) => string;
}

function SeriesSeasonsAndEpisodes({
  availableSeasons,
  selectedSeason,
  setSelectedSeason,
  wishlistStatus,
  isSeasonCoveredBySeries,
  handleSelectSeasonMode,
  isLoadingEpisodes,
  episodes,
  spoilerModeEnabled,
  revealedEpisodeIds,
  toggleEpisodeReveal,
  handleSelectEpisodeMode,
  t,
}: Readonly<SeriesSeasonsAndEpisodesProps>) {
  return (
    <Card className="bg-white/5 border-white/10 w-full min-w-0 overflow-hidden">
      <CardContent className="p-4 sm:p-6 space-y-4 min-w-0">
        <div className="flex items-center gap-2">
          <Clapperboard className="w-5 h-5 text-cyan-300" />
          <h3 className="text-xl font-semibold text-white">
            {t('seriesDetails.seasonsAndEpisodes')}
          </h3>
        </div>

        {availableSeasons.length > 0 ? (
          <>
            {/* Season selector + season wishlist dropdown */}
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <label htmlFor="season-select" className="text-white/80 shrink-0">
                {t('seriesDetails.season')}
              </label>
              <select
                id="season-select"
                value={selectedSeason ?? ''}
                onChange={(event) => setSelectedSeason(Number(event.target.value))}
                className="w-full sm:w-auto max-w-full min-w-0 bg-slate-900 border border-white/20 text-white rounded-md px-3 py-2 text-sm truncate"
              >
                {availableSeasons.map((season) => (
                  <option key={season.id} value={season.seasonNumber}>
                    {t('seriesDetails.seasonWithName', {
                      number: season.seasonNumber,
                      name: season.name,
                    })}
                  </option>
                ))}
              </select>

              {/* Season-level wishlist buttons */}
              {selectedSeason !== null && (
                isSeasonCoveredBySeries ? (
                  <Badge
                    variant="outline"
                    className="border-cyan-500/30 text-cyan-300 text-xs py-1 px-2.5 h-8 flex items-center"
                  >
                    <Heart className="w-3.5 h-3.5 mr-1.5 fill-current" />
                    {t('seriesDetails.coveredBySeries')}
                  </Badge>
                ) : (
                  <WishlistButtons
                    mode={getSeasonWishlistMode(wishlistStatus, selectedSeason)}
                    size="sm"
                    onToggleClassic={() => {
                      const currentMode = getSeasonWishlistMode(wishlistStatus, selectedSeason);
                      handleSelectSeasonMode(
                        selectedSeason,
                        currentMode !== 'none' ? 'none' : 'classic',
                      );
                    }}
                    onToggleAutoGrab={() => {
                      const currentMode = getSeasonWishlistMode(wishlistStatus, selectedSeason);
                      handleSelectSeasonMode(
                        selectedSeason,
                        currentMode === 'autograb' ? 'classic' : 'autograb',
                      );
                    }}
                  />
                )
              )}
            </div>

            {/* Episodes list */}
            {isLoadingEpisodes && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={`episode-skeleton-${i}`}
                    className="h-20 bg-white/5 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            )}

            {!isLoadingEpisodes && episodes.length > 0 ? (
              <ScrollArea className="h-[500px] w-full rounded-lg border border-white/10 min-w-0">
                <div className="space-y-3 p-3 sm:p-4 min-w-0">
                  {episodes.map((episode) => {
                    const coveredByParent =
                      wishlistStatus &&
                      (wishlistStatus?.all_seasons ||
                        (selectedSeason !== null &&
                          wishlistStatus?.seasons?.[selectedSeason]?.all_episodes));
                    const isEpisodeHidden =
                      spoilerModeEnabled && !revealedEpisodeIds.includes(episode.id);

                    return (
                      <div
                        key={episode.id}
                        className="rounded-lg border border-white/10 bg-white/5 p-3 sm:p-4 min-w-0"
                      >
                        <div className="flex items-start justify-between gap-3 sm:gap-4 min-w-0">
                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() =>
                                spoilerModeEnabled && toggleEpisodeReveal(episode.id)
                              }
                              className={`w-full text-left rounded-md ${
                                spoilerModeEnabled
                                  ? 'transition-colors hover:bg-white/5 px-2 py-1 -mx-2 -my-1'
                                  : ''
                              }`}
                            >
                              <p className="text-white font-semibold break-words">
                                {t('seriesDetails.episodeNumber', {
                                  number: episode.episodeNumber,
                                })}
                                {!isEpisodeHidden &&
                                  (episode.name ? `: ${episode.name}` : '')}
                              </p>
                            </button>
                            <p className="text-white/60 text-sm mt-0.5 truncate">
                              {episode.airDate || t('seriesDetails.unknownDate')}
                              {episode.runtime ? ` · ${episode.runtime} min` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {episode.rating > 0 && (
                              <span className="text-yellow-400 text-sm font-semibold">
                                {episode.rating}/10
                              </span>
                            )}

                            {coveredByParent ? (
                              <Badge
                                variant="outline"
                                className="border-cyan-500/30 text-cyan-300 text-xs"
                              >
                                <Heart className="w-3 h-3 mr-1 fill-current" />
                                {t('seriesDetails.covered')}
                              </Badge>
                            ) : (
                              <WishlistButtons
                                mode={getEpisodeWishlistMode(
                                  wishlistStatus,
                                  selectedSeason,
                                  episode.episodeNumber,
                                )}
                                size="icon"
                                onToggleClassic={() => {
                                  if (selectedSeason === null) return;
                                  const currentMode = getEpisodeWishlistMode(
                                    wishlistStatus,
                                    selectedSeason,
                                    episode.episodeNumber,
                                  );
                                  handleSelectEpisodeMode(
                                    selectedSeason,
                                    episode.episodeNumber,
                                    currentMode !== 'none' ? 'none' : 'classic',
                                  );
                                }}
                                onToggleAutoGrab={() => {
                                  if (selectedSeason === null) return;
                                  const currentMode = getEpisodeWishlistMode(
                                    wishlistStatus,
                                    selectedSeason,
                                    episode.episodeNumber,
                                  );
                                  handleSelectEpisodeMode(
                                    selectedSeason,
                                    episode.episodeNumber,
                                    currentMode === 'autograb' ? 'classic' : 'autograb',
                                  );
                                }}
                              />
                            )}
                          </div>
                        </div>

                        {isEpisodeHidden ? (
                          <button
                            type="button"
                            onClick={() => toggleEpisodeReveal(episode.id)}
                            className="mt-3 block w-full rounded-md border border-dashed border-violet-400/30 bg-violet-500/5 p-1 text-left transition-colors hover:bg-violet-500/10"
                          >
                            <div className="relative space-y-1.5">
                              <div className="h-2 w-1/3 rounded bg-white/10" />
                              <div className="h-2 w-full rounded bg-white/10" />
                              <div className="h-2 w-5/6 rounded bg-white/10" />
                              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-widest text-violet-200/70">
                                Mode spoiler
                              </span>
                            </div>
                          </button>
                        ) : episode.overview ? (
                          <p className="text-white/75 mt-3 text-sm leading-relaxed break-words">
                            {episode.overview}
                          </p>
                        ) : spoilerModeEnabled ? (
                          <p className="text-white/45 mt-3 text-sm">
                            {t('seriesDetails.spoilers.noOverview')}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-white/60">{t('seriesDetails.episodesUnavailable')}</p>
            )}
          </>
        ) : (
          <p className="text-white/60">{t('seriesDetails.noSeasonInfo')}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function SeriesDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useI18n();
  const [series, setSeries] = useState<SeriesDetailsModel | null>(null);
  const [episodes, setEpisodes] = useState<SeriesEpisode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<{ id: number; name: string } | null>(null);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [wishlistStatus, setWishlistStatus] = useState<WishListItem | undefined>(undefined);
  const [releaseResults, setReleaseResults] = useState<IndexerSeriesResult[]>([]);
  const [isReleaseLoading, setIsReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [trailersList, setTrailersList] = useState<TmdbVideo[]>([]);
  const [filter, setFilter] = useState<FilterOption>({
    quality: 'all',
    season: 'all',
    language: 'all',
    sortBy: 'date' as 'size' | 'date',
    sortOrder: 'desc' as 'asc' | 'desc',
  });
  const [revealedEpisodeIds, setRevealedEpisodeIds] = useState<number[]>([]);
  const spoilerModeEnabled = user?.settings?.spoilerMode || false;

  useEffect(() => {
    const preferred = String(
      user?.settings?.indexer?.qualities || 'all',
    ).toLowerCase();
    setFilter((prev) => ({
      ...prev,
      quality: SERIES_QUALITY_FILTERS.has(preferred) ? preferred : 'all',
    }));
  }, [user?.settings?.indexer?.qualities]);

  useEffect(() => {
    if (!id) return;
    const seriesId = Number(id);
    if (!Number.isFinite(seriesId)) return;

    loadSeriesDetails(seriesId);
    loadSeriesTrailers(seriesId);
  }, [id, language]);

  useEffect(() => {
    if (!series || selectedSeason === null) {
      return;
    }

    loadSeasonEpisodes(series.id, selectedSeason);
  }, [series?.id, selectedSeason, language]);

  // Recherche additionnelle quand on filtre sur une saison pour attraper les épisodes individuels
  useEffect(() => {
    if (!series || filter.season === 'all') {
      return;
    }

    const loadSeasonEpisodeReleases = async () => {
      try {
        // Recherche ciblée avec le format "Series S01E" pour attraper les épisodes individuels
        const indexerResponse = await searchSeriesReleases({
          tmdbId: series.id,
          season: filter.season === 'all' ? undefined : filter.season,
        });

        // Fusionner avec les résultats existants en évitant les doublons
        setReleaseResults((prev) => {
          const existingGuids = new Set(prev.map((item) => item.guid).filter(Boolean));
          const existingUrls = new Set(prev.map((item) => item.downloadUrl).filter(Boolean));

          const newItems = indexerResponse.items.filter((item) => {
            const guidExists = item.guid && existingGuids.has(item.guid);
            const urlExists = item.downloadUrl && existingUrls.has(item.downloadUrl);
            return !guidExists && !urlExists;
          });

          return [...prev, ...newItems];
        });
      } catch (error) {
        // Silencieusement ignorer les erreurs de recherche additionnelle
        console.debug('Recherche épisodes additionnelle échouée:', error);
      }
    };

    loadSeasonEpisodeReleases();
  }, [series, filter.season]);

  useEffect(() => {
    if (series) {
      loadReleases(series.id);
    }
  }, [filter.season, series]);

  const availableSeasons = useMemo(() => {
    if (!series) {
      return [];
    }

    return series.seasons
      .filter((season) => season.seasonNumber > 0)
      .sort((a, b) => a.seasonNumber - b.seasonNumber);
  }, [series]);

  const availableReleaseSeasons = useMemo(
    () => availableSeasons.map((season) => `S${String(season.seasonNumber).padStart(2, '0')}`),
    [availableSeasons],
  );

  const filteredReleaseResults = useMemo(() => {
    let filtered = releaseResults.filter((item) => {
      const qualityOk = filter.quality === 'all' || normalizeQuality(item.quality) === filter.quality;
      const languageOk =
        filter.language === 'all' || normalizeIndexerLanguage(item.language) === filter.language;
      return qualityOk && languageOk;
    });

    // Appliquer le tri
    filtered.sort((a, b) => {
      let comparison = 0;

      if (filter.sortBy === 'size') {
        const sizeA = Number(a.size || 0);
        const sizeB = Number(b.size || 0);
        comparison = sizeA - sizeB;
      } else if (filter.sortBy === 'date') {
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        comparison = dateA - dateB;
      }

      return filter.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [releaseResults, filter]);


  useEffect(() => {
    setRevealedEpisodeIds([]);
  }, [selectedSeason, spoilerModeEnabled, language]);

  const availableReleaseLanguages = useMemo(() => {
    const values = Array.from(
      new Set(
        releaseResults.map((item) => normalizeIndexerLanguage(item.language)).filter(Boolean),
      ),
    );

    return values.sort((a, b) => a.localeCompare(b, 'fr'));
  }, [releaseResults]);

  const torrentPanelLabels = useMemo(
    () => buildTorrentResultsLabels(t, { sectionKey: 'seriesDetails', includeSeason: true }),
    [t],
  );

  const loadSeriesDetails = async (seriesId: number) => {
    setIsLoading(true);
    try {
      const seriesData = await getSeriesById(seriesId, language);
      setSeries(seriesData);

      if (seriesData) {
        const defaultSeason = seriesData.seasons
          .filter((season) => season.seasonNumber > 0)
          .sort((a, b) => a.seasonNumber - b.seasonNumber)[0];
        setSelectedSeason(defaultSeason ? defaultSeason.seasonNumber : null);
        setWishlistStatus(await getSeriesWishlistStatus(seriesData.id));


      } else {
        setReleaseResults([]);
      }
    } catch (error) {
      console.error('Error loading series details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSeriesTrailers = async (seriesId: number) => {
    try {
      const videos = await getTmdbVideos(seriesId, 'series');
      const allVideos = videos?.results || [];
      const sortedTrailers = extractTrailers(allVideos, 'fr')[0];
      const englishTrailers = extractTrailers(allVideos, 'en')[0];
      const combinedTrailers = [sortedTrailers, englishTrailers]
        .filter((t): t is TmdbVideo => Boolean(t?.key))
        .filter((v, idx, arr) => arr.findIndex((x) => x.key === v.key) === idx);
      setTrailersList(combinedTrailers);
    } catch (error) {
      console.error('Error loading trailers:', error);
      setTrailersList([]);
    }
  };

  const loadSeasonEpisodes = async (seriesId: number, seasonNumber: number) => {
    setIsLoadingEpisodes(true);
    try {
      setEpisodes(await getSeriesSeasonEpisodes(seriesId, seasonNumber, language));
    } catch {
      setEpisodes([]);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  const refreshStatus = async () => {
    if (!series) return;
    setWishlistStatus(await getSeriesWishlistStatus(series.id));
  };

  // ── Wishlist helpers ────────────────────────────────────────────────────────
  const isSeasonCoveredBySeries = wishlistStatus?.all_seasons;

  // ── Wishlist actions ────────────────────────────────────────────────────────
  const isSeriesInWishlist = Boolean(
    wishlistStatus &&
      (wishlistStatus.all_seasons || Object.keys(wishlistStatus.seasons || {}).length > 0),
  );
  const isSeriesAutoGrab = Boolean(
    wishlistStatus &&
      (wishlistStatus.autoGrab ||
        Object.values(wishlistStatus.seasons || {}).some(
          (s) => s.autoGrab || (s.autoGrabEpisodes && s.autoGrabEpisodes.length > 0),
        )),
  );

  const seriesWishlistMode: WishlistMode = !isSeriesInWishlist
    ? 'none'
    : isSeriesAutoGrab
      ? 'autograb'
      : 'classic';

  const handleSelectSeriesMode = async (mode: WishlistMode) => {
    if (!series) return;
    if (mode === 'none') {
      setWishlistStatus(undefined);
      await removeFromWishlist(series.id);
      toast.info(`"${series.title}" retiré des favoris`);
    } else {
      const autoGrab = mode === 'autograb';
      if (!isSeriesInWishlist) {
        await addToWishlist(series.id, undefined, undefined, autoGrab);
        toast.success(
          autoGrab
            ? `"${series.title}" ajouté en Auto-Grab (Téléchargement auto)`
            : `"${series.title}" ajouté aux favoris`,
        );
      } else {
        await updateWishlistAutoGrab(series.id, 'series', autoGrab);
        toast.success(
          autoGrab
            ? `Passé en mode Auto-Grab pour "${series.title}"`
            : `Auto-Grab désactivé pour "${series.title}"`,
        );
      }
    }
    await refreshStatus();
    window.dispatchEvent(new CustomEvent('seedflix:wishlist-refresh-request'));
    window.dispatchEvent(new CustomEvent('seedflix:notifications-refresh-request'));
  };

  const handleSelectSeasonMode = async (seasonNumber: number, mode: WishlistMode) => {
    if (!series) return;
    if (mode === 'none') {
      await removeFromWishlist(series.id, seasonNumber);
      toast.info(`Saison ${seasonNumber} retirée des favoris`);
    } else {
      const autoGrab = mode === 'autograb';
      const seasonItem = wishlistStatus?.seasons?.[seasonNumber];
      if (!seasonItem || !seasonItem.all_episodes) {
        await addToWishlist(series.id, seasonNumber, undefined, autoGrab);
        toast.success(
          autoGrab
            ? `Saison ${seasonNumber} ajoutée en Auto-Grab`
            : `Saison ${seasonNumber} ajoutée aux favoris`,
        );
      } else {
        await updateWishlistAutoGrab(series.id, 'series', autoGrab, seasonNumber);
        toast.success(
          autoGrab
            ? `Saison ${seasonNumber} passée en mode Auto-Grab`
            : `Auto-Grab désactivé pour la saison ${seasonNumber}`,
        );
      }
    }
    await refreshStatus();
    window.dispatchEvent(new CustomEvent('seedflix:wishlist-refresh-request'));
    window.dispatchEvent(new CustomEvent('seedflix:notifications-refresh-request'));
  };

  const handleSelectEpisodeMode = async (
    seasonNumber: number,
    episodeNumber: number,
    mode: WishlistMode,
  ) => {
    if (!series) return;
    if (mode === 'none') {
      await removeFromWishlist(series.id, seasonNumber, episodeNumber);
      toast.info(`Épisode S${seasonNumber}E${episodeNumber} retiré des favoris`);
    } else {
      const autoGrab = mode === 'autograb';
      const seasonConfig = wishlistStatus?.seasons?.[seasonNumber];
      const inEpList = Boolean(
        seasonConfig &&
          !seasonConfig.all_episodes &&
          seasonConfig.episodes?.includes(episodeNumber),
      );
      if (!inEpList) {
        await addToWishlist(series.id, seasonNumber, episodeNumber, autoGrab);
        toast.success(
          autoGrab
            ? `Épisode S${seasonNumber}E${episodeNumber} ajouté en Auto-Grab`
            : `Épisode S${seasonNumber}E${episodeNumber} ajouté aux favoris`,
        );
      } else {
        await updateWishlistAutoGrab(
          series.id,
          'series',
          autoGrab,
          seasonNumber,
          episodeNumber,
        );
        toast.success(
          autoGrab
            ? `Épisode S${seasonNumber}E${episodeNumber} passé en mode Auto-Grab`
            : `Auto-Grab désactivé pour l'épisode S${seasonNumber}E${episodeNumber}`,
        );
      }
    }
    await refreshStatus();
    window.dispatchEvent(new CustomEvent('seedflix:wishlist-refresh-request'));
    window.dispatchEvent(new CustomEvent('seedflix:notifications-refresh-request'));
  };

  const toggleEpisodeReveal = (episodeId: number) => {
    setRevealedEpisodeIds((prev) =>
      prev.includes(episodeId) ? prev.filter((id) => id !== episodeId) : [...prev, episodeId],
    );
  };



  const loadReleases = async (id: number) => {
    setIsReleaseLoading(true);
    setReleaseError(null);
    try {
      const indexerResponse = await searchSeriesReleases({
        tmdbId: id,
        season: filter.season === 'all' ? undefined : filter.season,
      });
      setReleaseResults(indexerResponse.items);
    } catch (indexerLoadError) {
      setReleaseError(
        indexerLoadError instanceof Error
          ? indexerLoadError.message
          : t('seriesDetails.errors.indexerSearchFailed'),
      );
      setReleaseResults([]);
    } finally {
      setIsReleaseLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-10 w-32 bg-white/5 rounded animate-pulse" />
        <div className="h-80 w-full bg-white/5 rounded-lg animate-pulse" />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="h-40 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-40 bg-white/5 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">{t('seriesDetails.notFoundTitle')}</h2>
        <Link to="/">
          <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('seriesDetails.backHome')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 overflow-x-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          className="border-cyan-500/40 bg-cyan-600/10 text-white hover:bg-cyan-600/20"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('seriesDetails.back')}
        </Button>

        <div className="flex items-center gap-2">
          <WishlistButtons
            mode={seriesWishlistMode}
            onToggleClassic={() =>
              handleSelectSeriesMode(
                seriesWishlistMode !== 'none' ? 'none' : 'classic',
              )
            }
            onToggleAutoGrab={() =>
              handleSelectSeriesMode(
              )
            }
          />
        </div>
      </div>
      {series.backdrop && (
        <div className="relative mb-20 lg:mb-0">
          <div className="relative w-full h-44 sm:h-56 md:h-80 lg:h-96 rounded-lg overflow-hidden">
            <img src={series.backdrop} alt={series.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
            <div className="hidden lg:block absolute bottom-0 left-0 p-8">
              <h1 className="text-4xl font-bold text-white mb-2 line-clamp-2">{series.title}</h1>
              {series.originalTitle && series.originalTitle !== series.title && (
                <p className="text-white/70 text-lg line-clamp-1">{series.originalTitle}</p>
              )}
            </div>
          </div>

          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-40 sm:w-44 md:w-48 lg:hidden">
            <Card className="overflow-hidden bg-white/5 border-white/20 shadow-2xl shadow-black/50">
              <img
                src={series.poster}
                alt={series.title}
                className="w-full aspect-[2/3] object-cover"
              />
            </Card>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div
          className={`lg:col-span-1 max-w-[280px] sm:max-w-sm lg:max-w-none mx-auto lg:mx-0 w-full ${series.backdrop ? 'hidden lg:block' : ''}`}
        >
          <Card className="overflow-hidden bg-white/5 border-white/10">
            <img
              src={series.poster}
              alt={series.title}
              className="w-full aspect-[2/3] object-cover"
            />
          </Card>
        </div>

        <div className={`lg:col-span-2 space-y-6 w-full min-w-0 ${series.backdrop ? 'lg:pt-4' : ''}`}>
          <div>
            {series.backdrop ? (
              <div className="lg:hidden mb-3">
                <h1 className="text-3xl font-bold text-white mb-2">{series.title}</h1>
                {series.originalTitle && series.originalTitle !== series.title && (
                  <p className="text-base text-white/50">{series.originalTitle}</p>
                )}
              </div>
            ) : (
              <div className="mb-3">
                <h1 className="text-4xl font-bold text-white mb-2">{series.title}</h1>
                {series.originalTitle && series.originalTitle !== series.title && (
                  <p className="text-lg text-white/50">{series.originalTitle}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-white/80">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>{series.year || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                <span>{series.rating}/10</span>
              </div>
              <Badge className="bg-cyan-600 text-white">{series.genre}</Badge>
              {!!(series.voteCount) && (
                <span className="text-white/60">
                  {t('seriesDetails.votes', { count: series.voteCount.toLocaleString() })}
                </span>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-white mb-3">
              {t('seriesDetails.synopsis')}
            </h2>
            <p className="text-white/80 text-lg leading-relaxed break-words">{series.plot}</p>
          </div>

          {/* Trailers */}
          <TrailersSection trailers={trailersList} mediaTitle={series.title} type="series" />

          <Card className="bg-white/5 border-white/10 w-full min-w-0 overflow-hidden">
            <CardContent className="p-4 sm:p-6 space-y-4 min-w-0">
              <h3 className="text-xl font-semibold text-white">
                {t('seriesDetails.creatorsAndNetworks')}
              </h3>

              {series.creatorsList && series.creatorsList.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-white/60">{t('seriesDetails.creatorsLabel')}</span>
                  <div className="flex flex-wrap gap-2">
                    {series.creatorsList.map((creator) => (
                      <button
                        key={creator.id}
                        type="button"
                        onClick={() => setSelectedPerson({ id: creator.id, name: creator.name })}
                        className="px-3 py-1 rounded-lg border border-cyan-500/30 bg-cyan-900/20 text-cyan-200 hover:bg-cyan-900/40 hover:text-white transition-all text-xs sm:text-sm font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        {creator.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {series.castMembers && series.castMembers.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-white/60">{language === 'fr' ? 'Distribution' : 'Cast'}</span>
                  <div className="flex flex-wrap gap-2">
                    {series.castMembers.map((actor) => (
                      <button
                        key={actor.id}
                        type="button"
                        onClick={() => setSelectedPerson({ id: actor.id, name: actor.name })}
                        className="border border-white/20 text-white bg-white/5 hover:bg-white/15 hover:border-white/40 px-3 py-1 rounded-lg text-xs sm:text-sm transition-all cursor-pointer flex flex-col items-start gap-0.5"
                      >
                        <span className="font-semibold text-white">{actor.name}</span>
                        {actor.character && (
                          <span className="text-[11px] text-white/50">{actor.character}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-white/80 break-words">
                <span className="text-white/60">{t('seriesDetails.networksLabel')} </span>
                {series.networks.length > 0
                  ? series.networks.join(', ')
                  : t('seriesDetails.notAvailable')}
              </p>
              <p className="text-white/80">
                <span className="text-white/60">{t('seriesDetails.seasonsLabel')} </span>
                {series.seasons.length}
              </p>
            </CardContent>
          </Card>

          <SeriesSeasonsAndEpisodes
            availableSeasons={availableSeasons}
            selectedSeason={selectedSeason}
            setSelectedSeason={setSelectedSeason}
            wishlistStatus={wishlistStatus}
            isSeasonCoveredBySeries={Boolean(isSeasonCoveredBySeries)}
            handleSelectSeasonMode={handleSelectSeasonMode}
            isLoadingEpisodes={isLoadingEpisodes}
            episodes={episodes}
            spoilerModeEnabled={spoilerModeEnabled}
            revealedEpisodeIds={revealedEpisodeIds}
            toggleEpisodeReveal={toggleEpisodeReveal}
            handleSelectEpisodeMode={handleSelectEpisodeMode}
            t={t}
          />

          <TorrentResultsPanel
            title={t('seriesDetails.indexer.title')}
            type="series"
            filter={filter}
            onFilterChange={setFilter}
            availableReleaseSeasons={availableReleaseSeasons}
            availableReleaseLanguages={availableReleaseLanguages}
            isReleaseLoading={isReleaseLoading}
            releaseError={releaseError}
            filteredResults={filteredReleaseResults}
            locale={language === 'fr' ? 'fr-FR' : 'en-US'}
            labels={torrentPanelLabels}
          />

          {/* Similar & Recommended Series */}
          <SimilarMediaSection id={series.id} type="series" />
        </div>
      </div>

      {/* Person Filmography Modal */}
      <PersonFilmographyModal
        personId={selectedPerson?.id || null}
        personName={selectedPerson?.name}
        onClose={() => setSelectedPerson(null)}
      />
    </div>
  );
}
