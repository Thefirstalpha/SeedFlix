import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Calendar, Clapperboard, Download, Heart, Loader2, Star, Tv } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
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

export function SeriesDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
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

  useEffect(() => {
    loadSeriesDetails();
  }, [id]);

  useEffect(() => {
    if (!series || selectedSeason === null) {
      return;
    }

    loadSeasonEpisodes(series.id, selectedSeason);
  }, [series?.id, selectedSeason]);

  const availableSeasons = useMemo(() => {
    if (!series) {
      return [];
    }

    return series.seasons
      .filter((season) => season.seasonNumber > 0)
      .sort((a, b) => a.seasonNumber - b.seasonNumber);
  }, [series]);

  const loadSeriesDetails = async () => {
    setIsLoading(true);
    try {
      const seriesData = await getSeriesById(Number(id));
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
            12,
            seriesData.id
          );
          setReleaseResults(trackerResponse.items);
        } catch (trackerLoadError) {
          setReleaseError(
            trackerLoadError instanceof Error
              ? trackerLoadError.message
              : "Recherche tracker impossible"
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
      setEpisodes(await getSeriesSeasonEpisodes(seriesId, seasonNumber));
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
          ? "Ce torrent existe déjà dans votre client."
          : "Torrent série ajouté au client avec succès."
      );
    } catch (error) {
      setTorrentError(
        error instanceof Error ? error.message : "Impossible d'ajouter ce torrent"
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
        seasonName: seasonData?.name ?? `Saison ${selectedSeason}`,
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
            ?.name ?? `Saison ${selectedSeason}`,
        episodeNumber: episode.episodeNumber,
        episodeName: episode.name,
      });
    }
    await refreshStatus();
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
        <h2 className="text-2xl font-bold text-white mb-4">Série non trouvée</h2>
        <Link to="/">
          <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'accueil
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          className="border-cyan-500/40 bg-cyan-600/10 text-white hover:bg-cyan-600/20"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
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
              ? "Retirer la série"
              : "Ajouter la série"}
          </Button>

          <Badge className="bg-cyan-600/20 text-cyan-100 border border-cyan-500/30 px-3 py-1">
            <Tv className="w-4 h-4 mr-2" />
            {series.status || "Statut inconnu"}
          </Badge>
        </div>
      </div>

      {series.backdrop && (
        <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden">
          <img
            src={series.backdrop}
            alt={series.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6 md:p-8">
            <h1 className="text-4xl font-bold text-white mb-2">{series.title}</h1>
            {series.originalTitle && series.originalTitle !== series.title && (
              <p className="text-white/70 text-lg">{series.originalTitle}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card className="overflow-hidden bg-white/5 border-white/10">
            <img
              src={series.poster}
              alt={series.title}
              className="w-full aspect-[2/3] object-cover"
            />
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
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
              <span className="text-white/60">({series.voteCount.toLocaleString()} votes)</span>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-white mb-3">Synopsis</h2>
            <p className="text-white/80 text-lg leading-relaxed">{series.plot}</p>
          </div>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 space-y-3">
              <h3 className="text-xl font-semibold text-white">Créateurs et réseaux</h3>
              <p className="text-white/80">
                <span className="text-white/60">Créateurs: </span>
                {series.creators.length > 0 ? series.creators.join(", ") : "Non disponible"}
              </p>
              <p className="text-white/80">
                <span className="text-white/60">Diffusion: </span>
                {series.networks.length > 0 ? series.networks.join(", ") : "Non disponible"}
              </p>
              <p className="text-white/80">
                <span className="text-white/60">Saisons: </span>
                {series.seasons.length}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Résultats Tracker</h3>
                <p className="text-sm text-white/60 mt-1">
                  Versions détectées sur Torznab pour cette série.
                </p>
              </div>

              {isReleaseLoading && (
                <p className="text-sm text-white/60">Recherche en cours...</p>
              )}

              {releaseError && (
                <p className="text-sm text-red-300">{releaseError}</p>
              )}

              {torrentStatus && !releaseError && (
                <p className="text-sm text-emerald-300">{torrentStatus}</p>
              )}

              {torrentError && (
                <p className="text-sm text-red-300">{torrentError}</p>
              )}

              {!isReleaseLoading && !releaseError && releaseResults.length === 0 && (
                <p className="text-sm text-white/60">Aucune version trouvée pour cette série.</p>
              )}

              {releaseResults.length > 0 && (
                <div className="space-y-3">
                  {releaseResults.map((item, index) => (
                    <div
                      key={item.guid || item.link || `${item.title}_${index}`}
                      className="rounded-lg border border-white/10 bg-slate-900/40 p-3 space-y-2"
                    >
                      <p className="text-white font-medium line-clamp-2">{item.title}</p>

                      <div className="flex flex-wrap gap-2 items-center">
                        <Button
                          size="sm"
                          onClick={() => handleAddTorrent(item.downloadUrl || item.link)}
                          disabled={addingTorrentLink === (item.downloadUrl || item.link)}
                          className="bg-cyan-600 hover:bg-cyan-700 text-white"
                        >
                          {addingTorrentLink === (item.downloadUrl || item.link) ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Ajout...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Ajouter au client
                            </>
                          )}
                        </Button>

                        {item.quality && (
                          <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                            Qualité: {item.quality}
                          </Badge>
                        )}
                        {item.language && (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                            Langue: {item.language}
                          </Badge>
                        )}
                        {item.sizeHuman && (
                          <Badge variant="outline" className="border-white/30 text-white/80">
                            Taille: {item.sizeHuman}
                          </Badge>
                        )}
                        {Number.isFinite(item.seeders || NaN) && (item.seeders || 0) >= 0 && (
                          <Badge variant="outline" className="border-lime-500/40 text-lime-300">
                            Seeders: {item.seeders}
                          </Badge>
                        )}
                        {Number.isFinite(item.leechers || NaN) && (item.leechers || 0) >= 0 && (
                          <Badge variant="outline" className="border-orange-500/40 text-orange-300">
                            Peers: {item.leechers}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Clapperboard className="w-5 h-5 text-cyan-300" />
                <h3 className="text-xl font-semibold text-white">Saisons et épisodes</h3>
              </div>

              {availableSeasons.length > 0 ? (
                <>
                  {/* Season selector + season wishlist button */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <label htmlFor="season-select" className="text-white/80">
                      Saison
                    </label>
                    <select
                      id="season-select"
                      value={selectedSeason ?? ""}
                      onChange={(event) =>
                        setSelectedSeason(Number(event.target.value))
                      }
                      className="bg-slate-900 border border-white/20 text-white rounded-md px-3 py-2"
                    >
                      {availableSeasons.map((season) => (
                        <option key={season.id} value={season.seasonNumber}>
                          Saison {season.seasonNumber} – {season.name}
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
                          ? "Couvert par la série"
                          : isSeasonDirectlyInWishlist(selectedSeason)
                          ? "Retirer la saison"
                          : "Ajouter la saison"}
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
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
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

                        return (
                          <div
                            key={episode.id}
                            className="rounded-lg border border-white/10 bg-white/5 p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold">
                                  Épisode {episode.episodeNumber}
                                  {episode.name ? `: ${episode.name}` : ""}
                                </p>
                                <p className="text-white/60 text-sm mt-0.5">
                                  {episode.airDate || "Date inconnue"}
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
                                    Couvert
                                  </Badge>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleEpisodeWishlist(episode)
                                    }
                                    title={
                                      directlyInWishlist
                                        ? "Retirer l'épisode"
                                        : "Ajouter l'épisode"
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

                            {episode.overview && (
                              <p className="text-white/75 mt-3 text-sm leading-relaxed">
                                {episode.overview}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-white/60">
                      Les détails d'épisodes ne sont pas disponibles pour
                      cette saison.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-white/60">
                  Aucune information de saison disponible pour cette série.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
