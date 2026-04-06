import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Calendar, Clapperboard, Star, Tv } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  getSeriesById,
  getSeriesSeasonEpisodes,
} from "../services/seriesService";
import type {
  SeriesDetails as SeriesDetailsModel,
  SeriesEpisode,
} from "../types/series";

export function SeriesDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [series, setSeries] = useState<SeriesDetailsModel | null>(null);
  const [episodes, setEpisodes] = useState<SeriesEpisode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);

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
      const seasonEpisodes = await getSeriesSeasonEpisodes(seriesId, seasonNumber);
      setEpisodes(seasonEpisodes);
    } catch (error) {
      console.error("Error loading season episodes:", error);
      setEpisodes([]);
    } finally {
      setIsLoadingEpisodes(false);
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
      <div className="flex items-center justify-between">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          className="border-cyan-500/40 bg-cyan-600/10 text-white hover:bg-cyan-600/20"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>

        <Badge className="bg-cyan-600/20 text-cyan-100 border border-cyan-500/30 px-3 py-1">
          <Tv className="w-4 h-4 mr-2" />
          {series.status || "Statut inconnu"}
        </Badge>
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
              <div className="flex items-center gap-2">
                <Clapperboard className="w-5 h-5 text-cyan-300" />
                <h3 className="text-xl font-semibold text-white">Saisons et épisodes</h3>
              </div>

              {availableSeasons.length > 0 ? (
                <>
                  <div className="flex items-center gap-3">
                    <label htmlFor="season-select" className="text-white/80">
                      Saison
                    </label>
                    <select
                      id="season-select"
                      value={selectedSeason ?? ""}
                      onChange={(event) => setSelectedSeason(Number(event.target.value))}
                      className="bg-slate-900 border border-white/20 text-white rounded-md px-3 py-2"
                    >
                      {availableSeasons.map((season) => (
                        <option key={season.id} value={season.seasonNumber}>
                          Saison {season.seasonNumber} - {season.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isLoadingEpisodes ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, index) => (
                        <div
                          key={index}
                          className="h-20 bg-white/5 rounded-lg animate-pulse"
                        />
                      ))}
                    </div>
                  ) : episodes.length > 0 ? (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {episodes.map((episode) => (
                        <div
                          key={episode.id}
                          className="rounded-lg border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-white font-semibold">
                                Episode {episode.episodeNumber}: {episode.name}
                              </p>
                              <p className="text-white/60 text-sm mt-1">
                                {episode.airDate || "Date inconnue"}
                                {episode.runtime ? ` - ${episode.runtime} min` : ""}
                              </p>
                            </div>
                            <span className="text-yellow-400 text-sm font-semibold">
                              {episode.rating > 0 ? `${episode.rating}/10` : "N/A"}
                            </span>
                          </div>
                          <p className="text-white/75 mt-3 text-sm leading-relaxed">
                            {episode.overview || "Aucune description disponible."}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white/60">
                      Les détails d'épisodes ne sont pas disponibles pour cette saison.
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
