import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { MovieCard } from "./MovieCard";
import { SeriesCard } from "./SeriesCard";
import {
  getMovieGenres,
  getPopularMoviesPage,
  searchMoviesPage,
} from "../services/movieService";
import {
  getPopularSeriesPage,
  getSeriesGenres,
  searchSeriesPage,
} from "../services/seriesService";
import type { Movie } from "../types/movie";
import type { Series } from "../types/series";

type ContentFilter = "all" | "movie" | "series";
const CAROUSEL_WHEEL_SPEED = 3.8;

const DEFAULT_LANGUAGE_OPTIONS = [
  "Francais",
  "Anglais",
  "Japonais",
  "Coreen",
  "Espagnol",
  "Italien",
  "Allemand",
  "Portugais",
  "Russe",
  "Chinois",
  "Inconnu",
];

function toSortedUnique(items: string[]): string[] {
  return Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, "fr"));
}

function yearToDateBounds(yearFrom: string, yearTo: string) {
  const parsedFrom = Number(yearFrom);
  const parsedTo = Number(yearTo);

  const safeFrom = Number.isFinite(parsedFrom) && parsedFrom > 0 ? parsedFrom : undefined;
  const safeTo = Number.isFinite(parsedTo) && parsedTo > 0 ? parsedTo : undefined;

  return { safeFrom, safeTo };
}

function toTmdbOriginalLanguageCode(language: string): string | undefined {
  const normalized = String(language || "").trim().toLowerCase();
  if (!normalized || normalized === "all" || normalized === "inconnu") {
    return undefined;
  }

  const map: Record<string, string> = {
    francais: "fr",
    français: "fr",
    anglais: "en",
    japonais: "ja",
    coreen: "ko",
    coréen: "ko",
    espagnol: "es",
    italien: "it",
    allemand: "de",
    portugais: "pt",
    russe: "ru",
    chinois: "zh",
  };

  return map[normalized] || undefined;
}



export function Home() {
  const [query, setQuery] = useState("");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [movieGenres, setMovieGenres] = useState<Array<{ id: number; name: string }>>([]);
  const [seriesGenres, setSeriesGenres] = useState<Array<{ id: number; name: string }>>([]);

  const [recommendedMovies, setRecommendedMovies] = useState<Movie[]>([]);
  const [recommendedSeries, setRecommendedSeries] = useState<Series[]>([]);
  const [searchMovies, setSearchMovies] = useState<Movie[]>([]);
  const [searchSeries, setSearchSeries] = useState<Series[]>([]);

  const [moviePage, setMoviePage] = useState(1);
  const [movieTotalPages, setMovieTotalPages] = useState(1);
  const [seriesPage, setSeriesPage] = useState(1);
  const [seriesTotalPages, setSeriesTotalPages] = useState(1);

  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMoreMovies, setIsLoadingMoreMovies] = useState(false);
  const [isLoadingMoreSeries, setIsLoadingMoreSeries] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingGenres, setIsLoadingGenres] = useState(true);

  const movieCarouselRef = useRef<HTMLDivElement | null>(null);
  const seriesCarouselRef = useRef<HTMLDivElement | null>(null);

  const hasSearch = query.trim().length > 0;
  const showMovies = contentFilter !== "series";
  const showSeries = contentFilter !== "movie";

  const selectedMovieGenreId = useMemo(() => {
    if (genreFilter === "all") return undefined;
    return movieGenres.find((genre) => genre.name === genreFilter)?.id;
  }, [genreFilter, movieGenres]);

  const selectedSeriesGenreId = useMemo(() => {
    if (genreFilter === "all") return undefined;
    return seriesGenres.find((genre) => genre.name === genreFilter)?.id;
  }, [genreFilter, seriesGenres]);

  const ratingThreshold = Number(minRating) || 0;
  const { safeFrom: yearStart, safeTo: yearEnd } = yearToDateBounds(yearFrom, yearTo);
  const selectedOriginalLanguageCode = toTmdbOriginalLanguageCode(languageFilter);

  useEffect(() => {
    const loadGenres = async () => {
      setIsLoadingGenres(true);
      try {
        const [moviesGenresResponse, seriesGenresResponse] = await Promise.all([
          getMovieGenres(),
          getSeriesGenres(),
        ]);
        setMovieGenres(moviesGenresResponse);
        setSeriesGenres(seriesGenresResponse);
      } catch (error) {
        console.error("Error loading genres:", error);
      } finally {
        setIsLoadingGenres(false);
      }
    };

    loadGenres();
  }, []);

  const fetchMovieRecommendations = async (page = 1) => {
    return getPopularMoviesPage(page, {
      genreId: selectedMovieGenreId,
      yearFrom: yearStart,
      yearTo: yearEnd,
      minRating: ratingThreshold,
      originalLanguage: selectedOriginalLanguageCode,
    });
  };

  const fetchSeriesRecommendations = async (page = 1) => {
    return getPopularSeriesPage(page, {
      genreId: selectedSeriesGenreId,
      yearFrom: yearStart,
      yearTo: yearEnd,
      minRating: ratingThreshold,
      originalLanguage: selectedOriginalLanguageCode,
    });
  };

  const loadMovieRecommendations = async (page = 1, append = false) => {
    if (!showMovies) {
      setRecommendedMovies([]);
      setMoviePage(1);
      setMovieTotalPages(1);
      return;
    }

    try {
      if (page > 1) {
        setIsLoadingMoreMovies(true);
      }

      const response = await fetchMovieRecommendations(page);
      setRecommendedMovies((prev) =>
        append ? [...prev, ...response.movies] : response.movies
      );
      setMoviePage(response.page);
      setMovieTotalPages(response.totalPages);
    } catch (error) {
      console.error("Error loading movie recommendations:", error);
      if (!append) {
        setRecommendedMovies([]);
      }
    } finally {
      setIsLoadingMoreMovies(false);
    }
  };

  const loadSeriesRecommendations = async (page = 1, append = false) => {
    if (!showSeries) {
      setRecommendedSeries([]);
      setSeriesPage(1);
      setSeriesTotalPages(1);
      return;
    }

    try {
      if (page > 1) {
        setIsLoadingMoreSeries(true);
      }

      const response = await fetchSeriesRecommendations(page);
      setRecommendedSeries((prev) =>
        append ? [...prev, ...response.series] : response.series
      );
      setSeriesPage(response.page);
      setSeriesTotalPages(response.totalPages);
    } catch (error) {
      console.error("Error loading series recommendations:", error);
      if (!append) {
        setRecommendedSeries([]);
      }
    } finally {
      setIsLoadingMoreSeries(false);
    }
  };

  useEffect(() => {
    if (hasSearch) return;

    const loadInitialRecommendations = async () => {
      // Reset visible data first so filter changes clearly reload both lists
      setRecommendedMovies([]);
      setRecommendedSeries([]);
      setMoviePage(1);
      setMovieTotalPages(1);
      setSeriesPage(1);
      setSeriesTotalPages(1);
      if (movieCarouselRef.current) {
        movieCarouselRef.current.scrollLeft = 0;
      }
      if (seriesCarouselRef.current) {
        seriesCarouselRef.current.scrollLeft = 0;
      }

      setIsLoadingInitial(true);
      try {
        await Promise.all([
          loadMovieRecommendations(1, false),
          loadSeriesRecommendations(1, false),
        ]);
      } finally {
        setIsLoadingInitial(false);
      }
    };

    loadInitialRecommendations();
  }, [
    hasSearch,
    contentFilter,
    genreFilter,
    languageFilter,
    yearFrom,
    yearTo,
    minRating,
    selectedMovieGenreId,
    selectedSeriesGenreId,
    selectedOriginalLanguageCode,
  ]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchMovies([]);
      setSearchSeries([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [movieResponse, seriesResponse] = await Promise.all([
          searchMoviesPage(trimmed, 1),
          searchSeriesPage(trimmed, 1),
        ]);
        setSearchMovies(movieResponse.movies);
        setSearchSeries(seriesResponse.series);
      } catch (error) {
        console.error("Error searching mixed content:", error);
        setSearchMovies([]);
        setSearchSeries([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const maybeLoadMoreMovies = async (container: HTMLDivElement | null) => {
    if (!container || hasSearch || isLoadingMoreMovies || moviePage >= movieTotalPages) {
      return;
    }

    const remaining = container.scrollWidth - container.clientWidth - container.scrollLeft;
    if (remaining <= 120) {
      await loadMovieRecommendations(moviePage + 1, true);
    }
  };

  const maybeLoadMoreSeries = async (container: HTMLDivElement | null) => {
    if (!container || hasSearch || isLoadingMoreSeries || seriesPage >= seriesTotalPages) {
      return;
    }

    const remaining = container.scrollWidth - container.clientWidth - container.scrollLeft;
    if (remaining <= 120) {
      await loadSeriesRecommendations(seriesPage + 1, true);
    }
  };

  const scrollCarousel = (
    container: HTMLDivElement | null,
    direction: "left" | "right"
  ) => {
    if (!container) {
      return;
    }

    container.scrollBy({
      left: (direction === "right" ? 1 : -1) * container.clientWidth * 0.85,
      behavior: "smooth",
    });
  };

  const handleCarouselWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    if (container.scrollWidth <= container.clientWidth) {
      return;
    }

    const dominantDelta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

    if (dominantDelta !== 0) {
      container.scrollLeft += dominantDelta * CAROUSEL_WHEEL_SPEED;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  useEffect(() => {
    const attachWheelBlocker = (container: HTMLDivElement | null) => {
      if (!container) {
        return () => {};
      }

      const onWheel = (event: WheelEvent) => {
        if (container.scrollWidth <= container.clientWidth) {
          return;
        }

        const dominantDelta =
          Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

        if (dominantDelta !== 0) {
          container.scrollLeft += dominantDelta * CAROUSEL_WHEEL_SPEED;
          event.preventDefault();
          event.stopPropagation();
        }
      };

      container.addEventListener("wheel", onWheel, { passive: false });
      return () => container.removeEventListener("wheel", onWheel);
    };

    const cleanupMovie = attachWheelBlocker(movieCarouselRef.current);
    const cleanupSeries = attachWheelBlocker(seriesCarouselRef.current);

    return () => {
      cleanupMovie();
      cleanupSeries();
    };
  }, []);

  const baseMovies = hasSearch ? searchMovies : recommendedMovies;
  const baseSeries = hasSearch ? searchSeries : recommendedSeries;

  const availableGenres = useMemo(() => {
    const namesFromMovies = showMovies ? movieGenres.map((genre) => genre.name) : [];
    const namesFromSeries = showSeries ? seriesGenres.map((genre) => genre.name) : [];
    return toSortedUnique([...namesFromMovies, ...namesFromSeries]);
  }, [movieGenres, seriesGenres, showMovies, showSeries]);

  const availableLanguages = useMemo(() => {
    const movieLanguages = showMovies ? baseMovies.map((movie) => movie.language || "Inconnu") : [];
    const seriesLanguages = showSeries ? baseSeries.map((show) => show.language || "Inconnu") : [];
    return toSortedUnique([...DEFAULT_LANGUAGE_OPTIONS, ...movieLanguages, ...seriesLanguages]);
  }, [baseMovies, baseSeries, showMovies, showSeries]);

  useEffect(() => {
    if (genreFilter !== "all" && !availableGenres.includes(genreFilter)) {
      setGenreFilter("all");
    }
  }, [availableGenres, genreFilter]);

  useEffect(() => {
    if (languageFilter !== "all" && !availableLanguages.includes(languageFilter)) {
      setLanguageFilter("all");
    }
  }, [availableLanguages, languageFilter]);

  const localYearStart = yearStart ?? 0;
  const localYearEnd = yearEnd ?? 9999;

  const filteredMovies = useMemo(() => {
    return baseMovies.filter((movie) => {
      const matchesLanguage =
        languageFilter === "all" || (movie.language || "Inconnu") === languageFilter;

      if (!hasSearch) {
        return matchesLanguage;
      }

      const matchesGenre = genreFilter === "all" || movie.genre === genreFilter;
      const matchesYear = movie.year >= localYearStart && movie.year <= localYearEnd;
      const matchesRating = movie.rating >= ratingThreshold;
      return matchesGenre && matchesYear && matchesRating && matchesLanguage;
    });
  }, [baseMovies, genreFilter, hasSearch, languageFilter, localYearStart, localYearEnd, ratingThreshold]);

  const filteredSeries = useMemo(() => {
    return baseSeries.filter((show) => {
      const matchesLanguage =
        languageFilter === "all" || (show.language || "Inconnu") === languageFilter;

      if (!hasSearch) {
        return matchesLanguage;
      }

      const matchesGenre = genreFilter === "all" || show.genre === genreFilter;
      const matchesYear = show.year >= localYearStart && show.year <= localYearEnd;
      const matchesRating = show.rating >= ratingThreshold;
      return matchesGenre && matchesYear && matchesRating && matchesLanguage;
    });
  }, [baseSeries, genreFilter, hasSearch, languageFilter, localYearStart, localYearEnd, ratingThreshold]);

  const emptyMessage = hasSearch
    ? "Aucun résultat trouvé pour cette recherche avec les filtres actifs."
    : "Aucun contenu disponible avec ces filtres.";





  return (
    <div className="space-y-8">

      <div className="max-w-5xl mx-auto space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
          <Input
            type="text"
            placeholder="Rechercher un film ou une série..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-10 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFiltersOpen((prev) => !prev)}
            className="w-full justify-between px-2 text-white hover:bg-white/10"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="w-4 h-4" />
              Filtres
            </span>
            <span className="flex items-center gap-2 text-xs text-white/70">
              {filtersOpen ? "Masquer" : "Afficher"}
              <ChevronDown className={`w-4 h-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
            </span>
          </Button>

          {filtersOpen && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => setContentFilter("all")}
                  className={contentFilter === "all" ? "bg-white text-slate-900 hover:bg-white/90" : "bg-white/10 text-white hover:bg-white/20"}
                >
                  Tout
                </Button>
                <Button
                  size="sm"
                  onClick={() => setContentFilter("movie")}
                  className={contentFilter === "movie" ? "bg-purple-500 text-white hover:bg-purple-600" : "bg-white/10 text-white hover:bg-white/20"}
                >
                  Films
                </Button>
                <Button
                  size="sm"
                  onClick={() => setContentFilter("series")}
                  className={contentFilter === "series" ? "bg-cyan-500 text-slate-900 hover:bg-cyan-400" : "bg-white/10 text-white hover:bg-white/20"}
                >
                  Séries
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <select
                  value={genreFilter}
                  onChange={(event) => setGenreFilter(event.target.value)}
                  className="h-10 rounded-md border border-white/20 bg-slate-900 px-3 text-white"
                >
                  <option value="all">Tous les genres</option>
                  {availableGenres.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>

                <select
                  value={languageFilter}
                  onChange={(event) => setLanguageFilter(event.target.value)}
                  className="h-10 rounded-md border border-white/20 bg-slate-900 px-3 text-white"
                >
                  <option value="all">Toutes les langues</option>
                  {availableLanguages.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </select>

                <Input
                  type="number"
                  min={1900}
                  max={2100}
                  placeholder="Date min (annee)"
                  value={yearFrom}
                  onChange={(event) => setYearFrom(event.target.value)}
                  className="h-10 bg-slate-900 border-white/20 text-white"
                />

                <Input
                  type="number"
                  min={1900}
                  max={2100}
                  placeholder="Date max (annee)"
                  value={yearTo}
                  onChange={(event) => setYearTo(event.target.value)}
                  className="h-10 bg-slate-900 border-white/20 text-white"
                />

                <select
                  value={minRating}
                  onChange={(event) => setMinRating(event.target.value)}
                  className="h-10 rounded-md border border-white/20 bg-slate-900 px-3 text-white"
                >
                  <option value="0">Toutes les notes</option>
                  <option value="6">Note {">="} 6</option>
                  <option value="7">Note {">="} 7</option>
                  <option value="8">Note {">="} 8</option>
                  <option value="9">Note {">="} 9</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {(isLoadingInitial || isSearching) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!isLoadingInitial && !isSearching && !hasSearch && (
        <div className="space-y-8">
          {showMovies && (
            <section className="space-y-4">
              <h3 className="text-2xl font-semibold text-white">Films populaires</h3>

              {filteredMovies.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => scrollCarousel(movieCarouselRef.current, "left")}
                      className="hidden lg:inline-flex shrink-0 border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    <div
                      ref={movieCarouselRef}
                      onScroll={(event) => {
                        const container = event.currentTarget;
                        void maybeLoadMoreMovies(container);
                      }}
                      onWheelCapture={handleCarouselWheel}
                      className="-mx-4 lg:mx-0 flex-1 overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth touch-pan-x overscroll-contain"
                    >
                      <div className="flex gap-3 sm:gap-4 py-4 pr-4 lg:pr-4 pl-4 lg:pl-0">
                        {filteredMovies.map((movie) => (
                          <div key={movie.id} className="min-w-[172px] max-w-[172px] sm:min-w-[196px] sm:max-w-[196px] md:min-w-[220px] md:max-w-[220px] shrink-0">
                            <MovieCard
                              movie={movie}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => scrollCarousel(movieCarouselRef.current, "right")}
                      className="hidden lg:inline-flex shrink-0 border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-3 lg:hidden">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => scrollCarousel(movieCarouselRef.current, "left")}
                      className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => scrollCarousel(movieCarouselRef.current, "right")}
                      className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-white/60">{emptyMessage}</p>
              )}
            </section>
          )}

          {showSeries && (
            <section className="space-y-4">
              <h3 className="text-2xl font-semibold text-white">Séries populaires</h3>

              {filteredSeries.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => scrollCarousel(seriesCarouselRef.current, "left")}
                      className="hidden lg:inline-flex shrink-0 border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    <div
                      ref={seriesCarouselRef}
                      onScroll={(event) => {
                        const container = event.currentTarget;
                        void maybeLoadMoreSeries(container);
                      }}
                      onWheelCapture={handleCarouselWheel}
                      className="-mx-4 lg:mx-0 flex-1 overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth touch-pan-x overscroll-contain"
                    >
                      <div className="flex gap-3 sm:gap-4 py-4 pr-4 lg:pr-4 pl-4 lg:pl-0">
                        {filteredSeries.map((show) => (
                          <div key={show.id} className="min-w-[172px] max-w-[172px] sm:min-w-[196px] sm:max-w-[196px] md:min-w-[220px] md:max-w-[220px] shrink-0">
                            <SeriesCard
                              series={show}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => scrollCarousel(seriesCarouselRef.current, "right")}
                      className="hidden lg:inline-flex shrink-0 border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-3 lg:hidden">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => scrollCarousel(seriesCarouselRef.current, "left")}
                      className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => scrollCarousel(seriesCarouselRef.current, "right")}
                      className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-white/60">{emptyMessage}</p>
              )}
            </section>
          )}
        </div>
      )}

      {!isLoadingInitial && !isSearching && hasSearch && (
        <div className="space-y-8">
          <h3 className="text-2xl font-semibold text-white">Resultats en liste verticale pour "{query.trim()}"</h3>

          {showMovies && (
            <section className="space-y-4">
              <h4 className="text-xl font-semibold text-white">Films</h4>
              {filteredMovies.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredMovies.map((movie) => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-white/60">Aucun film ne correspond.</p>
              )}
            </section>
          )}

          {showSeries && (
            <section className="space-y-4">
              <h4 className="text-xl font-semibold text-white">Series</h4>
              {filteredSeries.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredSeries.map((show) => (
                    <SeriesCard
                      key={show.id}
                      series={show}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-white/60">Aucune serie ne correspond.</p>
              )}
            </section>
          )}

          {((showMovies && filteredMovies.length === 0) &&
            (showSeries && filteredSeries.length === 0)) && (
            <p className="text-white/60">{emptyMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}