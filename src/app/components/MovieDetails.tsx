import { useParams, Link, useNavigate } from "react-router";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Download, Loader2, Star, Calendar, Clock, User, Heart } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { getMovieById, searchMovieReleases, type TorznabMovieResult } from "../services/movieService";
import { addTorrentToClient } from "../services/torrentService";
import { addToWishlist, removeFromWishlist, isInWishlist } from "../services/wishlistService";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/LanguageProvider";
import type { Movie } from "../types/movie";

const MOVIE_QUALITY_FILTERS = ["all", "2160p", "1080p", "720p", "480p", "bluray", "webdl", "hdtv"];

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

export function MovieDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useAuth();
  const { t, language } = useI18n();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inWishlist, setInWishlist] = useState(false);
  const [releaseResults, setReleaseResults] = useState<TorznabMovieResult[]>([]);
  const [isReleaseLoading, setIsReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [addingTorrentLink, setAddingTorrentLink] = useState<string | null>(null);
  const [torrentStatus, setTorrentStatus] = useState<string | null>(null);
  const [torrentError, setTorrentError] = useState<string | null>(null);
  const [qualityFilter, setQualityFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<"size" | "date">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const preferred = String(settings?.placeholders?.indexer?.defaultQuality || "all").toLowerCase();
    setQualityFilter(MOVIE_QUALITY_FILTERS.includes(preferred) ? preferred : "all");
  }, [settings?.placeholders?.indexer?.defaultQuality]);

  const filteredReleaseResults = useMemo(() => {
    let results = releaseResults.filter((item) => {
      const languageOk =
        languageFilter === "all" || normalizeTrackerLanguage(item.language) === languageFilter;

      if (qualityFilter === "all") {
        return languageOk;
      }

      return normalizeQuality(item.quality) === qualityFilter && languageOk;
    });

    // Apply sorting
    if (sortBy === "size") {
      results.sort((a, b) => {
        const sizeA = a.sizeBytes || 0;
        const sizeB = b.sizeBytes || 0;
        return sortOrder === "desc" ? sizeB - sizeA : sizeA - sizeB;
      });
    } else if (sortBy === "date") {
      results.sort((a, b) => {
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      });
    }

    return results;
  }, [releaseResults, qualityFilter, languageFilter, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredReleaseResults.length / ITEMS_PER_PAGE);
  const paginatedResults = filteredReleaseResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [qualityFilter, languageFilter, sortBy, sortOrder]);

  const availableReleaseLanguages = Array.from(
    new Set(
      releaseResults
        .map((item) => normalizeTrackerLanguage(item.language))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "fr"));

  useEffect(() => {
    loadMovieDetails();
  }, [id]);

  const loadMovieDetails = async () => {
    setIsLoading(true);
    try {
      const movieData = await getMovieById(Number(id));
      setMovie(movieData);
      if (movieData) {
        setInWishlist(await isInWishlist(movieData.id));

        setIsReleaseLoading(true);
        setReleaseError(null);
        try {
          const trackerResponse = await searchMovieReleases(
            movieData.originalTitle || movieData.title,
            12,
            movieData.id
          );
          setReleaseResults(trackerResponse.items);
        } catch (trackerError) {
          setReleaseError(
            trackerError instanceof Error
              ? trackerError.message
              : t("movieDetails.errors.trackerSearchFailed")
          );
          setReleaseResults([]);
        } finally {
          setIsReleaseLoading(false);
        }
      } else {
        setReleaseResults([]);
      }
    } catch (error) {
      console.error('Error loading movie details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWishlist = async () => {
    if (!movie) return;

    if (inWishlist) {
      await removeFromWishlist(movie.id);
      setInWishlist(false);
    } else {
      await addToWishlist(movie);
      setInWishlist(true);
    }
  };

  const handleAddTorrent = async (torrentUrl: string) => {
    setTorrentStatus(null);
    setTorrentError(null);
    setAddingTorrentLink(torrentUrl);

    try {
      const response = await addTorrentToClient(torrentUrl);
      setTorrentStatus(
        response.duplicate
          ? t("movieDetails.messages.duplicateTorrent")
          : t("movieDetails.messages.torrentAdded")
      );
    } catch (error) {
      setTorrentError(
        error instanceof Error ? error.message : t("movieDetails.errors.addTorrentFailed")
      );
    } finally {
      setAddingTorrentLink(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-10 w-32 bg-white/5 rounded animate-pulse" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="aspect-[2/3] bg-white/5 rounded-lg animate-pulse" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="h-10 w-3/4 bg-white/5 rounded animate-pulse" />
            <div className="h-6 w-1/2 bg-white/5 rounded animate-pulse" />
            <div className="h-20 w-full bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">{t("movieDetails.notFoundTitle")}</h2>
        <Link to="/">
          <Button className="bg-purple-600 hover:bg-purple-700 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("movieDetails.backHome")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 overflow-x-hidden">
      {/* Back Button and Wishlist */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button 
          onClick={() => navigate(-1)}
          variant="outline" 
          className="border-purple-500/30 bg-purple-600/10 text-white hover:bg-purple-600/20 hover:border-purple-500/50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("movieDetails.back")}
        </Button>

        <Button
          onClick={toggleWishlist}
          className={`${
            inWishlist
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
          }`}
        >
          <Heart className={`w-5 h-5 mr-2 ${inWishlist ? 'fill-current' : ''}`} />
          {inWishlist ? t("movieDetails.removeFromWishlist") : t("movieDetails.addToWishlist")}
        </Button>
      </div>

      {/* Backdrop Image */}
      {movie.backdrop && (
        <div className="relative mb-20 lg:mb-0">
          <div className="relative w-full h-44 sm:h-56 md:h-80 lg:h-96 rounded-lg overflow-hidden">
            <img
              src={movie.backdrop}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
            <div className="hidden lg:block absolute bottom-0 left-0 p-8">
              <h1 className="text-4xl font-bold text-white mb-2 line-clamp-2">{movie.title}</h1>
              {movie.originalTitle && movie.originalTitle !== movie.title && (
                <p className="text-white/70 text-lg line-clamp-1">{movie.originalTitle}</p>
              )}
            </div>
          </div>

          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-40 sm:w-44 md:w-48 lg:hidden">
            <Card className="overflow-hidden bg-white/5 border-white/20 shadow-2xl shadow-black/50">
              <img
                src={movie.poster}
                alt={movie.title}
                className="w-full aspect-[2/3] object-cover"
              />
            </Card>
          </div>
        </div>
      )}

      {/* Movie Header */}
      <div className="grid lg:grid-cols-3 gap-8 justify-items-center lg:justify-items-stretch">
        {/* Poster */}
        <div className={`lg:col-span-1 max-w-[280px] sm:max-w-sm lg:max-w-none mx-auto lg:mx-0 w-full ${movie.backdrop ? "hidden lg:block" : ""}`}>
          <Card className="overflow-hidden bg-white/5 border-white/10">
            <img
              src={movie.poster}
              alt={movie.title}
              className="w-full aspect-[2/3] object-cover"
            />
          </Card>
        </div>

        {/* Details */}
        <div className={`lg:col-span-2 space-y-6 ${movie.backdrop ? "lg:pt-4" : ""}`}>
          <div>
            {movie.backdrop ? (
              <div className="lg:hidden">
                <h1 className="text-3xl font-bold text-white mb-2">{movie.title}</h1>
                {movie.originalTitle && movie.originalTitle !== movie.title && (
                  <p className="text-base text-white/50 mb-2">{movie.originalTitle}</p>
                )}
              </div>
            ) : (
              <>
                <h1 className="text-4xl font-bold text-white mb-2">{movie.title}</h1>
                {movie.originalTitle && movie.originalTitle !== movie.title && (
                  <p className="text-lg text-white/50 mb-2">{movie.originalTitle}</p>
                )}
              </>
            )}
            <div className="flex flex-wrap items-center gap-4 text-white/70">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>{movie.year}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>{movie.duration}</span>
              </div>
              <Badge className="bg-purple-600 text-white">
                {movie.genre}
              </Badge>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-lg border border-yellow-500/30">
              <Star className="w-6 h-6 fill-yellow-500 text-yellow-500" />
              <span className="text-2xl font-bold text-white">{movie.rating}</span>
              <span className="text-white/60">/10</span>
            </div>
            {movie.voteCount && (
              <span className="text-white/60">{t("movieDetails.votes", { count: movie.voteCount.toLocaleString() })}</span>
            )}
          </div>

          {/* Plot */}
          <div>
            <h2 className="text-2xl font-semibold text-white mb-3">{t("movieDetails.synopsis")}</h2>
            <p className="text-white/80 text-lg leading-relaxed break-words">{movie.plot}</p>
          </div>

          {/* Director */}
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-5 h-5 text-purple-400" />
                <h3 className="text-xl font-semibold text-white">{t("movieDetails.director")}</h3>
              </div>
              <p className="text-white/80 text-lg break-words">{movie.director}</p>
            </CardContent>
          </Card>

          {/* Cast */}
          {movie.actors.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">{t("movieDetails.cast")}</h3>
                <div className="flex flex-wrap gap-2">
                  {movie.actors.map((actor, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="max-w-full border-white/20 text-white bg-white/5 px-3 py-1 break-words"
                    >
                      {actor}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{t("movieDetails.tracker.title")}</h3>
                <p className="text-sm text-white/60 mt-1">
                  {t("movieDetails.tracker.description")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
                  <label htmlFor="movie-quality-filter" className="text-sm text-white/70 font-medium whitespace-nowrap">
                    {t("movieDetails.tracker.quality")}
                  </label>
                  <select
                    id="movie-quality-filter"
                    value={qualityFilter}
                    onChange={(event) => setQualityFilter(event.target.value)}
                    className="max-w-full bg-slate-900 border border-white/20 text-white rounded-md px-3 py-2 text-sm"
                  >
                    <option value="all">{t("movieDetails.tracker.all")}</option>
                    <option value="2160p">2160p</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                    <option value="bluray">BluRay</option>
                    <option value="webdl">WEB-DL</option>
                    <option value="hdtv">HDTV</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
                  <label htmlFor="movie-language-filter" className="text-sm text-white/70 font-medium whitespace-nowrap">
                    {t("movieDetails.tracker.language")}
                  </label>
                  <select
                    id="movie-language-filter"
                    value={languageFilter}
                    onChange={(event) => setLanguageFilter(event.target.value)}
                    className="max-w-full bg-slate-900 border border-white/20 text-white rounded-md px-3 py-2 text-sm"
                  >
                    <option value="all">{t("movieDetails.tracker.all")}</option>
                    {availableReleaseLanguages.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                  <span className="text-sm text-white/70 font-medium">{t("movieDetails.tracker.sort")}</span>
                  <ToggleGroup
                    type="single"
                    value={sortBy}
                    onValueChange={(value) => {
                      if (value) setSortBy(value as "size" | "date");
                    }}
                    className="border border-white/20 rounded-md bg-slate-900/30"
                  >
                    <ToggleGroupItem 
                      value="date" 
                      aria-label="Sort by date" 
                      className="text-sm data-[state=on]:bg-cyan-600 data-[state=on]:text-white hover:bg-white/10 data-[state=off]:text-white/60 data-[state=off]:hover:text-white/80"
                    >
                      {t("movieDetails.tracker.date")}
                    </ToggleGroupItem>
                    <ToggleGroupItem 
                      value="size" 
                      aria-label="Sort by size" 
                      className="text-sm data-[state=on]:bg-cyan-600 data-[state=on]:text-white hover:bg-white/10 data-[state=off]:text-white/60 data-[state=off]:hover:text-white/80"
                    >
                      {t("movieDetails.tracker.size")}
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <Button
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                    className="h-9 px-3 border border-white/20 text-white/80 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all"
                  >
                    {sortOrder === "desc" ? "↓" : "↑"}
                  </Button>
                </div>
              </div>

              {isReleaseLoading && (
                <p className="text-sm text-white/60">{t("movieDetails.tracker.searching")}</p>
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

              {!isReleaseLoading && !releaseError && filteredReleaseResults.length === 0 && (
                <p className="text-sm text-white/60">{t("movieDetails.tracker.empty")}</p>
              )}

              {filteredReleaseResults.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {paginatedResults.map((item, index) => (
                    <div
                      key={item.guid || item.link || `${item.title}_${index}`}
                      className="rounded-lg border border-white/10 bg-slate-900/40 p-3 space-y-2"
                    >
                      <p className="text-white font-medium line-clamp-2 break-all">
                        {item.title}
                      </p>

                      <div className="flex flex-wrap gap-2 items-center">
                        <Button
                          size="sm"
                          onClick={() => handleAddTorrent(item.downloadUrl || item.link)}
                          disabled={addingTorrentLink === (item.downloadUrl || item.link)}
                          className="bg-cyan-600 hover:bg-cyan-700 text-white w-full sm:w-auto"
                        >
                          {addingTorrentLink === (item.downloadUrl || item.link) ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t("movieDetails.tracker.adding")}
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              {t("movieDetails.tracker.addToClient")}
                            </>
                          )}
                        </Button>

                        {item.quality && (
                          <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                            {t("movieDetails.tracker.qualityBadge", { value: item.quality })}
                          </Badge>
                        )}
                        {item.language && (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                            {t("movieDetails.tracker.languageBadge", { value: item.language })}
                          </Badge>
                        )}
                        {item.sizeHuman && (
                          <Badge variant="outline" className="border-white/30 text-white/80">
                            {t("movieDetails.tracker.sizeBadge", { value: item.sizeHuman })}
                          </Badge>
                        )}
                        {item.pubDate && (
                          <Badge variant="outline" className="border-blue-500/40 text-blue-300">
                            <Calendar className="w-3 h-3 mr-1 inline" />
                            {new Date(item.pubDate).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US")}
                          </Badge>
                        )}
                        {Number.isFinite(item.seeders || NaN) && (item.seeders || 0) >= 0 && (
                          <Badge variant="outline" className="border-lime-500/40 text-lime-300">
                            {t("movieDetails.tracker.seeders", { count: item.seeders || 0 })}
                          </Badge>
                        )}
                        {Number.isFinite(item.leechers || NaN) && (item.leechers || 0) >= 0 && (
                          <Badge variant="outline" className="border-orange-500/40 text-orange-300">
                            {t("movieDetails.tracker.peers", { count: item.leechers || 0 })}
                          </Badge>
                        )}
                      </div>

                      {Array.isArray(item.categories) && item.categories.length > 0 && (
                        <p className="text-xs text-white/50 line-clamp-1 break-all">
                          {t("movieDetails.tracker.categories", { value: item.categories.join(", ") })}
                        </p>
                      )}
                    </div>
                  ))}
                  </div>

                  <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      {t("movieDetails.pagination.previous")}
                    </Button>

                    <span className="text-sm text-white/80">
                      {t("movieDetails.pagination.current", { current: currentPage, total: totalPages })}
                    </span>

                    <select
                      value={currentPage}
                      onChange={(event) => setCurrentPage(Number(event.target.value))}
                      className="bg-slate-900 border border-white/20 text-white rounded-md px-2 py-1 text-sm"
                    >
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <option key={page} value={page}>
                          {t("movieDetails.pagination.page", { page })}
                        </option>
                      ))}
                    </select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      {t("movieDetails.pagination.next")}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div>
            <Button
              onClick={toggleWishlist}
              className={`w-full sm:w-auto ${
                inWishlist
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }`}
            >
              <Heart className={`w-5 h-5 mr-2 ${inWishlist ? 'fill-current' : ''}`} />
              {inWishlist ? t("movieDetails.removeFromWishlist") : t("movieDetails.addToWishlist")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}