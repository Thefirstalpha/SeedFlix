import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Calendar, Clapperboard, Heart, Star, Tv } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { TorrentResultsPanel } from "./TorrentResultsPanel";
import {
  getSeriesById,
  getSeriesSeasonEpisodes,
  searchSeriesReleases,
  type TorznabSeriesResult,
} from "../services/seriesService";
import {
  addToSeriesWishlist,
  getSeriesWishlistStatus,
  removeFromSeriesWishlist,
} from "../services/seriesWishlistService";
import { addTorrentToClient } from "../services/torrentService";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/LanguageProvider";
import type { SeriesWishlistStatus } from "../types/seriesWishlist";
import type {
  SeriesDetails as SeriesDetailsModel,
  SeriesEpisode,
} from "../types/series";

const EMPTY_STATUS: SeriesWishlistStatus = {
  seriesInWishlist: false,
  seasonsInWishlist: [],
  episodesInWishlist: [],
};

const SERIES_QUALITY_FILTERS = ["all", "2160p", "1080p", "720p", "480p", "bluray", "webdl", "hdtv"];
const SERIES_RELEASE_SEARCH_LIMIT = 100;

function normalizeQuality(value: string | null | undefined) {
  const raw = String(value || "").toLowerCase();
  if (!raw) return "";
  if (raw.includes("2160")) return "2160p";
  if (raw.includes("1080")) return "1080p";
  if (raw.includes("720")) return "720p";
  if (raw.includes("480")) return "480p";
  if (raw.includes("bluray") || raw.includes("brrip") || raw.includes("remux")) return "bluray";
  if (raw.includes("webdl") || raw.includes("web-dl") || raw.includes("webrip")) return "webdl";
  if (raw.includes("hdtv")) return "hdtv";
  return raw;
}

function normalizeTrackerLanguage(value: string | null | undefined) {
  const raw = String(value || "").toUpperCase();
  if (!raw) return "";
  if (raw.includes("VOSTFR")) return "VOSTFR";
  if (raw.includes("VFF")) return "VFF";
  if (raw.includes("VFQ")) return "VFQ";
  if (raw.includes("MULTI")) return "MULTI";
  if (raw === "VF" || raw.includes("FRENCH") || raw.includes("TRUEFRENCH")) return "VF";
  if (raw === "VO") return "VO";
  return raw;
}

function detectSeasonFromRelease(item: TorznabSeriesResult): string {
  const title = String(item.title || "");
  const attrs = item.attributes || {};

  const attrSeason = String(attrs.season || attrs.seasonnum || attrs.seasonnumber || "").trim();
  if (/^\d+$/.test(attrSeason)) {
    return `S${attrSeason.padStart(2, "0")}`;
  }

  // Matcher S##E## (épisodes individuels) ou S## seul
  const seasonMatch = title.match(/S(\d{1,2})(?:E\d{1,2})?/i) || title.match(/\bSeason[ ._-]?(\d{1,2})\b/i);
  if (seasonMatch?.[1]) {
    return `S${String(seasonMatch[1]).padStart(2, "0")}`;
  }

  return "unknown";
}

export function SeriesDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useAuth();
  const { t, language } = useI18n();
  const [series, setSeries] = useState<SeriesDetailsModel | null>(null);
  const [episodes, setEpisodes] = useState<SeriesEpisode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [wishlistStatus, setWishlistStatus] =
    useState<SeriesWishlistStatus>(EMPTY_STATUS);
  const [releaseResults, setReleaseResults] = useState<TorznabSeriesResult[]>([]);
  const [isReleaseLoading, setIsReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [addingTorrentLink, setAddingTorrentLink] = useState<string | null>(null);
  const [torrentStatus, setTorrentStatus] = useState<string | null>(null);
  const [torrentError, setTorrentError] = useState<string | null>(null);
  const [qualityFilter, setQualityFilter] = useState("all");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"size" | "date">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [revealedEpisodeIds, setRevealedEpisodeIds] = useState<number[]>([]);
  const ITEMS_PER_PAGE = 10;
  const spoilerModeEnabled = Boolean(
    (settings?.placeholders?.preferences as Record<string, unknown> | undefined)?.spoilerMode
  );

  useEffect(() => {
    const preferred = String(settings?.placeholders?.indexer?.defaultQuality || "all").toLowerCase();
    setQualityFilter(SERIES_QUALITY_FILTERS.includes(preferred) ? preferred : "all");
  }, [settings?.placeholders?.indexer?.defaultQuality]);

  useEffect(() => {
    loadSeriesDetails();
  }, [id, language]);

  useEffect(() => {
    if (!series || selectedSeason === null) {
      return;
    }

    loadSeasonEpisodes(series.id, selectedSeason);
  }, [series?.id, selectedSeason, language]);

  // Recherche additionnelle quand on filtre sur une saison pour attraper les épisodes individuels
  useEffect(() => {
    if (!series || seasonFilter === "all") {
      return;
    }

    const loadSeasonEpisodeReleases = async () => {
      try {
        // Recherche ciblée avec le format "Series S01E" pour attraper les épisodes individuels
        const episodeQuery = `${series.originalTitle || series.title} ${seasonFilter}E`;
        const trackerResponse = await searchSeriesReleases(episodeQuery, 50);
        
        // Fusionner avec les résultats existants en évitant les doublons
        setReleaseResults((prev) => {
          const existingGuids = new Set(prev.map(item => item.guid).filter(Boolean));
          const existingUrls = new Set(prev.map(item => item.downloadUrl).filter(Boolean));
          
          const newItems = trackerResponse.items.filter(item => {
            const guidExists = item.guid && existingGuids.has(item.guid);
            const urlExists = item.downloadUrl && existingUrls.has(item.downloadUrl);
            return !guidExists && !urlExists;
          });
          
          return [...prev, ...newItems];
        });
      } catch (error) {
        // Silencieusement ignorer les erreurs de recherche additionnelle
        console.debug("Recherche épisodes additionnelle échouée:", error);
      }
    };

    loadSeasonEpisodeReleases();
  }, [series, seasonFilter]);

  const availableSeasons = useMemo(() => {
    if (!series) {
      return [];
    }

    return series.seasons
      .filter((season) => season.seasonNumber > 0)
      .sort((a, b) => a.seasonNumber - b.seasonNumber);
  }, [series]);

  const availableReleaseSeasons = useMemo(
    () => availableSeasons.map((season) => `S${String(season.seasonNumber).padStart(2, "0")}`),
    [availableSeasons]
  );

  const filteredReleaseResults = useMemo(() => {
    let filtered = releaseResults.filter((item) => {
      const qualityOk = qualityFilter === "all" || normalizeQuality(item.quality) === qualityFilter;
      const seasonOk = seasonFilter === "all" || detectSeasonFromRelease(item) === seasonFilter;
      const languageOk =
        languageFilter === "all" || normalizeTrackerLanguage(item.language) === languageFilter;
      return qualityOk && seasonOk && languageOk;
    });

    // Appliquer le tri
    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortBy === "size") {
        const sizeA = Number(a.size || 0);
        const sizeB = Number(b.size || 0);
        comparison = sizeA - sizeB;
      } else if (sortBy === "date") {
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        comparison = dateA - dateB;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [releaseResults, qualityFilter, seasonFilter, languageFilter, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredReleaseResults.length / ITEMS_PER_PAGE);
  const paginatedResults = filteredReleaseResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [qualityFilter, seasonFilter, languageFilter, sortBy, sortOrder]);

  useEffect(() => {
    setRevealedEpisodeIds([]);
  }, [selectedSeason, spoilerModeEnabled, language]);

  const availableReleaseLanguages = useMemo(() => {
    const values = Array.from(
      new Set(
        releaseResults
          .map((item) => normalizeTrackerLanguage(item.language))
          .filter(Boolean)
      )
    );

    return values.sort((a, b) => a.localeCompare(b, "fr"));
  }, [releaseResults]);

  const loadSeriesDetails = async () => {
    setIsLoading(true);
    try {
      const seriesData = await getSeriesById(Number(id), language);
      setSeries(seriesData);

      if (seriesData) {
        const defaultSeason = seriesData.seasons
          .filter((season) => season.seasonNumber > 0)
          .sort((a, b) => a.seasonNumber - b.seasonNumber)[0];
        setSelectedSeason(defaultSeason ? defaultSeason.seasonNumber : null);
        setWishlistStatus(await getSeriesWishlistStatus(seriesData.id));

        setIsReleaseLoading(true);
        setReleaseError(null);
        try {
          const trackerResponse = await searchSeriesReleases(
            seriesData.originalTitle || seriesData.title,
            SERIES_RELEASE_SEARCH_LIMIT,
            seriesData.id
          );
          setReleaseResults(trackerResponse.items);
        } catch (trackerLoadError) {
          setReleaseError(
            trackerLoadError instanceof Error
              ? trackerLoadError.message
              : t("seriesDetails.errors.trackerSearchFailed")
          );
          setReleaseResults([]);
        } finally {
          setIsReleaseLoading(false);
        }
      } else {
        setReleaseResults([]);
      }
    } catch (error) {
      console.error("Error loading series details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSeasonEpisodes = async (
    seriesId: number,
    seasonNumber: number
  ) => {
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

  const handleAddTorrent = async (torrentUrl: string) => {
    setTorrentStatus(null);
    setTorrentError(null);
    setAddingTorrentLink(torrentUrl);

    try {
      const response = await addTorrentToClient(torrentUrl, "series");
      setTorrentStatus(
        response.duplicate
          ? t("seriesDetails.messages.duplicateTorrent")
          : t("seriesDetails.messages.torrentAdded")
      );
    } catch (error) {
      setTorrentError(
        error instanceof Error ? error.message : t("seriesDetails.errors.addTorrentFailed")
      );
    } finally {
      setAddingTorrentLink(null);
    }
  };

  // ── Wishlist helpers ────────────────────────────────────────────────────────

  const isSeasonCoveredBySeries = wishlistStatus.seriesInWishlist;

  const isSeasonDirectlyInWishlist = (seasonNumber: number) =>
    wishlistStatus.seasonsInWishlist.includes(seasonNumber);

  const isSeasonInWishlist = (seasonNumber: number) =>
    wishlistStatus.seriesInWishlist ||
    wishlistStatus.seasonsInWishlist.includes(seasonNumber);

  const isEpisodeDirectlyInWishlist = (
    seasonNumber: number,
    episodeNumber: number
  ) =>
    wishlistStatus.episodesInWishlist.some(
      (e) =>
        e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber
    );

  // ── Wishlist actions ────────────────────────────────────────────────────────

  const handleSeriesWishlist = async () => {
    if (!series) return;
    if (wishlistStatus.seriesInWishlist) {
      await removeFromSeriesWishlist(`series_${series.id}`);
    } else {
      await addToSeriesWishlist({
        type: "series",
        seriesId: series.id,
        seriesTitle: series.title,
        seriesPoster: series.poster,
      });
    }
    await refreshStatus();
  };

  const handleSeasonWishlist = async () => {
    if (!series || selectedSeason === null) return;
    const seasonData = availableSeasons.find(
      (s) => s.seasonNumber === selectedSeason
    );
    if (isSeasonDirectlyInWishlist(selectedSeason)) {
      await removeFromSeriesWishlist(`season_${series.id}_${selectedSeason}`);
    } else {
      await addToSeriesWishlist({
        type: "season",
        seriesId: series.id,
        seriesTitle: series.title,
        seriesPoster: series.poster,
        seasonNumber: selectedSeason,
        seasonName: seasonData?.name ?? t("seriesDetails.seasonNumber", { number: selectedSeason }),
      });
    }
    await refreshStatus();
  };

  const handleEpisodeWishlist = async (episode: SeriesEpisode) => {
    if (!series || selectedSeason === null) return;
    if (isEpisodeDirectlyInWishlist(selectedSeason, episode.episodeNumber)) {
      await removeFromSeriesWishlist(
        `episode_${series.id}_${selectedSeason}_${episode.episodeNumber}`
      );
    } else {
      await addToSeriesWishlist({
        type: "episode",
        seriesId: series.id,
        seriesTitle: series.title,
        seriesPoster: series.poster,
        seasonNumber: selectedSeason,
        seasonName:
          availableSeasons.find((s) => s.seasonNumber === selectedSeason)
            ?.name ?? t("seriesDetails.seasonNumber", { number: selectedSeason }),
        episodeNumber: episode.episodeNumber,
        episodeName: episode.name,
      });
    }
    await refreshStatus();
  };

  const toggleEpisodeReveal = (episodeId: number) => {
    setRevealedEpisodeIds((prev) =>
      prev.includes(episodeId)
        ? prev.filter((id) => id !== episodeId)
        : [...prev, episodeId]
    );
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
        <h2 className="text-2xl font-bold text-white mb-4">{t("seriesDetails.notFoundTitle")}</h2>
        <Link to="/">
          <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("seriesDetails.backHome")}
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
          {t("seriesDetails.back")}
        </Button>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleSeriesWishlist}
            className={
              wishlistStatus.seriesInWishlist
                ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
            }
          >
            <Heart
              className={`w-5 h-5 mr-2 ${
                wishlistStatus.seriesInWishlist ? "fill-current" : ""
              }`}
            />
            {wishlistStatus.seriesInWishlist
              ? t("seriesDetails.removeSeries")
              : t("seriesDetails.addSeries")}
          </Button>

          <Badge className="bg-cyan-600/20 text-cyan-100 border border-cyan-500/30 px-3 py-1">
            <Tv className="w-4 h-4 mr-2" />
            {series.status || t("seriesDetails.unknownStatus")}
          </Badge>
        </div>
      </div>

      {series.backdrop && (
        <div className="relative mb-20 lg:mb-0">
          <div className="relative w-full h-44 sm:h-56 md:h-80 lg:h-96 rounded-lg overflow-hidden">
            <img
              src={series.backdrop}
              alt={series.title}
              className="w-full h-full object-cover"
            />
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

      <div className="grid lg:grid-cols-3 gap-8 justify-items-center lg:justify-items-stretch">
        <div className={`lg:col-span-1 max-w-[280px] sm:max-w-sm lg:max-w-none mx-auto lg:mx-0 w-full ${series.backdrop ? "hidden lg:block" : ""}`}>
          <Card className="overflow-hidden bg-white/5 border-white/10">
            <img
              src={series.poster}
              alt={series.title}
              className="w-full aspect-[2/3] object-cover"
            />
          </Card>
        </div>

        <div className={`lg:col-span-2 space-y-6 ${series.backdrop ? "lg:pt-4" : ""}`}>
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
              <span>{series.year || "N/A"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
              <span>{series.rating}/10</span>
            </div>
            <Badge className="bg-cyan-600 text-white">{series.genre}</Badge>
            {series.voteCount && (
              <span className="text-white/60">{t("seriesDetails.votes", { count: series.voteCount.toLocaleString() })}</span>
            )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-white mb-3">{t("seriesDetails.synopsis")}</h2>
            <p className="text-white/80 text-lg leading-relaxed break-words">{series.plot}</p>
          </div>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 space-y-3">
              <h3 className="text-xl font-semibold text-white">{t("seriesDetails.creatorsAndNetworks")}</h3>
              <p className="text-white/80 break-words">
                <span className="text-white/60">{t("seriesDetails.creatorsLabel")} </span>
                {series.creators.length > 0 ? series.creators.join(", ") : t("seriesDetails.notAvailable")}
              </p>
              <p className="text-white/80 break-words">
                <span className="text-white/60">{t("seriesDetails.networksLabel")} </span>
                {series.networks.length > 0 ? series.networks.join(", ") : t("seriesDetails.notAvailable")}
              </p>
              <p className="text-white/80">
                <span className="text-white/60">{t("seriesDetails.seasonsLabel")} </span>
                {series.seasons.length}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Clapperboard className="w-5 h-5 text-cyan-300" />
                <h3 className="text-xl font-semibold text-white">{t("seriesDetails.seasonsAndEpisodes")}</h3>
              </div>

              {availableSeasons.length > 0 ? (
                <>
                  {/* Season selector + season wishlist button */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <label htmlFor="season-select" className="text-white/80">
                      {t("seriesDetails.season")}
                    </label>
                    <select
                      id="season-select"
                      value={selectedSeason ?? ""}
                      onChange={(event) =>
                        setSelectedSeason(Number(event.target.value))
                      }
                      className="max-w-full bg-slate-900 border border-white/20 text-white rounded-md px-3 py-2"
                    >
                      {availableSeasons.map((season) => (
                        <option key={season.id} value={season.seasonNumber}>
                          {t("seriesDetails.seasonWithName", { number: season.seasonNumber, name: season.name })}
                          {isSeasonInWishlist(season.seasonNumber) ? " ♥" : ""}
                        </option>
                      ))}
                    </select>

                    {/* Season-level wishlist button */}
                    {selectedSeason !== null && (
                      <Button
                        size="sm"
                        disabled={isSeasonCoveredBySeries}
                        onClick={handleSeasonWishlist}
                        className={
                          isSeasonCoveredBySeries
                            ? "bg-white/5 text-white/40 border border-white/10 cursor-not-allowed"
                            : isSeasonDirectlyInWishlist(selectedSeason)
                            ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                            : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                        }
                      >
                        <Heart
                          className={`w-4 h-4 mr-1 ${
                            !isSeasonCoveredBySeries &&
                            isSeasonDirectlyInWishlist(selectedSeason)
                              ? "fill-current"
                              : ""
                          }`}
                        />
                        {isSeasonCoveredBySeries
                          ? t("seriesDetails.coveredBySeries")
                          : isSeasonDirectlyInWishlist(selectedSeason)
                          ? t("seriesDetails.removeSeason")
                          : t("seriesDetails.addSeason")}
                      </Button>
                    )}
                  </div>

                  {/* Episodes list */}
                  {isLoadingEpisodes ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="h-20 bg-white/5 rounded-lg animate-pulse"
                        />
                      ))}
                    </div>
                  ) : episodes.length > 0 ? (
                    <ScrollArea className="h-[500px] w-full rounded-lg border border-white/10">
                      <div className="space-y-3 p-4">
                        {episodes.map((episode) => {
                        const coveredByParent =
                          wishlistStatus.seriesInWishlist ||
                          (selectedSeason !== null &&
                            wishlistStatus.seasonsInWishlist.includes(
                              selectedSeason
                            ));
                        const directlyInWishlist =
                          selectedSeason !== null &&
                          isEpisodeDirectlyInWishlist(
                            selectedSeason,
                            episode.episodeNumber
                          );
                        const isEpisodeHidden =
                          spoilerModeEnabled && !revealedEpisodeIds.includes(episode.id);

                        return (
                          <div
                            key={episode.id}
                            className="rounded-lg border border-white/10 bg-white/5 p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => spoilerModeEnabled && toggleEpisodeReveal(episode.id)}
                                  className={`w-full text-left rounded-md ${
                                    spoilerModeEnabled ? "transition-colors hover:bg-white/5 px-2 py-1 -mx-2 -my-1" : ""
                                  }`}
                                >
                                  <p className="text-white font-semibold">
                                    {t("seriesDetails.episodeNumber", { number: episode.episodeNumber })}
                                    {!isEpisodeHidden && (episode.name ? `: ${episode.name}` : "")}
                                  </p>
                                </button>
                                <p className="text-white/60 text-sm mt-0.5">
                                  {episode.airDate || t("seriesDetails.unknownDate")}
                                  {episode.runtime
                                    ? ` · ${episode.runtime} min`
                                    : ""}
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
                                    {t("seriesDetails.covered")}
                                  </Badge>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleEpisodeWishlist(episode)
                                    }
                                    title={
                                      directlyInWishlist
                                        ? t("seriesDetails.removeEpisode")
                                        : t("seriesDetails.addEpisode")
                                    }
                                    className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                                  >
                                    <Heart
                                      className={`w-4 h-4 ${
                                        directlyInWishlist
                                          ? "fill-cyan-400 text-cyan-400"
                                          : "text-white/50 hover:text-white"
                                      }`}
                                    />
                                  </button>
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
                                {t("seriesDetails.spoilers.noOverview")}
                              </p>
                            ) : null}
                          </div>
                        );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-white/60">
                      {t("seriesDetails.episodesUnavailable")}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-white/60">
                  {t("seriesDetails.noSeasonInfo")}
                </p>
              )}
            </CardContent>
          </Card>

          <TorrentResultsPanel
            title={t("seriesDetails.tracker.title")}
            description={t("seriesDetails.tracker.description")}
            qualityFilter={qualityFilter}
            onQualityFilterChange={setQualityFilter}
            languageFilter={languageFilter}
            onLanguageFilterChange={setLanguageFilter}
            seasonFilter={seasonFilter}
            onSeasonFilterChange={setSeasonFilter}
            availableReleaseSeasons={availableReleaseSeasons}
            availableReleaseLanguages={availableReleaseLanguages}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderToggle={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            isReleaseLoading={isReleaseLoading}
            releaseError={releaseError}
            torrentStatus={torrentStatus}
            torrentError={torrentError}
            filteredResults={filteredReleaseResults}
            paginatedResults={paginatedResults}
            addingTorrentLink={addingTorrentLink}
            onAddTorrent={handleAddTorrent}
            currentPage={currentPage}
            onCurrentPageChange={setCurrentPage}
            totalPages={totalPages}
            locale={language === "fr" ? "fr-FR" : "en-US"}
            labels={{
              season: t("seriesDetails.season"),
              quality: t("seriesDetails.tracker.quality"),
              language: t("seriesDetails.tracker.language"),
              all: t("seriesDetails.tracker.all"),
              sort: t("seriesDetails.tracker.sort"),
              date: t("seriesDetails.tracker.date"),
              size: t("seriesDetails.tracker.size"),
              searching: t("seriesDetails.tracker.searching"),
              empty: t("seriesDetails.tracker.empty"),
              adding: t("seriesDetails.tracker.adding"),
              addToClient: t("seriesDetails.tracker.addToClient"),
              qualityBadge: (value) => t("seriesDetails.tracker.qualityBadge", { value }),
              languageBadge: (value) => t("seriesDetails.tracker.languageBadge", { value }),
              sizeBadge: (value) => t("seriesDetails.tracker.sizeBadge", { value }),
              seeders: (count) => t("seriesDetails.tracker.seeders", { count }),
              peers: (count) => t("seriesDetails.tracker.peers", { count }),
              categories: (value) => t("seriesDetails.tracker.categories", { value }),
              previous: t("seriesDetails.pagination.previous"),
              current: (current, total) => t("seriesDetails.pagination.current", { current, total }),
              page: (page) => t("seriesDetails.pagination.page", { page }),
              next: t("seriesDetails.pagination.next"),
              sortByDateAria: "Sort by date",
              sortBySizeAria: "Sort by size",
            }}
          />
        </div>
      </div>
    </div>
  );
}
