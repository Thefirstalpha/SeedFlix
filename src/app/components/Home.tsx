import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { MovieCard } from "./MovieCard";
import { SeriesCard } from "./SeriesCard";
import { searchMoviesPage, getPopularMoviesPage } from "../services/movieService";
import { searchSeriesPage, getPopularSeriesPage } from "../services/seriesService";
import type { Movie } from "../types/movie";
import type { Series } from "../types/series";

type ContentFilter = "all" | "movie" | "series";

function toSortedUnique(items: string[]): string[] {
  return Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, "fr"));
}

export function Home() {
  const [query, setQuery] = useState("");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [minRating, setMinRating] = useState("0");

  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [popularSeries, setPopularSeries] = useState<Series[]>([]);
  const [searchMovies, setSearchMovies] = useState<Movie[]>([]);
  const [searchSeries, setSearchSeries] = useState<Series[]>([]);

  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const hasSearch = query.trim().length > 0;

  useEffect(() => {
    const loadPopular = async () => {
      setIsLoadingInitial(true);
      try {
        const [movieResponse, seriesResponse] = await Promise.all([
          getPopularMoviesPage(1),
          getPopularSeriesPage(1),
        ]);
        setPopularMovies(movieResponse.movies);
        setPopularSeries(seriesResponse.series);
      } catch (error) {
        console.error("Error loading home content:", error);
      } finally {
        setIsLoadingInitial(false);
      }
    };

    loadPopular();
  }, []);

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

  const baseMovies = hasSearch ? searchMovies : popularMovies;
  const baseSeries = hasSearch ? searchSeries : popularSeries;

  const availableGenres = useMemo(() => {
    const movieGenres = contentFilter !== "series" ? baseMovies.map((m) => m.genre) : [];
    const seriesGenres = contentFilter !== "movie" ? baseSeries.map((s) => s.genre) : [];
    return toSortedUnique([...movieGenres, ...seriesGenres].filter(Boolean));
  }, [baseMovies, baseSeries, contentFilter]);

  useEffect(() => {
    if (genreFilter !== "all" && !availableGenres.includes(genreFilter)) {
      setGenreFilter("all");
    }
  }, [availableGenres, genreFilter]);

  const yearStart = Number(yearFrom) || 0;
  const yearEnd = Number(yearTo) || 9999;
  const ratingThreshold = Number(minRating) || 0;

  const filteredMovies = useMemo(() => {
    return baseMovies.filter((movie) => {
      const matchesGenre = genreFilter === "all" || movie.genre === genreFilter;
      const matchesYear = movie.year >= yearStart && movie.year <= yearEnd;
      const matchesRating = movie.rating >= ratingThreshold;
      return matchesGenre && matchesYear && matchesRating;
    });
  }, [baseMovies, genreFilter, yearStart, yearEnd, ratingThreshold]);

  const filteredSeries = useMemo(() => {
    return baseSeries.filter((show) => {
      const matchesGenre = genreFilter === "all" || show.genre === genreFilter;
      const matchesYear = show.year >= yearStart && show.year <= yearEnd;
      const matchesRating = show.rating >= ratingThreshold;
      return matchesGenre && matchesYear && matchesRating;
    });
  }, [baseSeries, genreFilter, yearStart, yearEnd, ratingThreshold]);

  const showMovies = contentFilter !== "series";
  const showSeries = contentFilter !== "movie";

  const emptyMessage = hasSearch
    ? "Aucun résultat trouvé pour cette recherche avec les filtres actifs."
    : "Aucun contenu disponible avec ces filtres.";

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4 py-8">
        <h2 className="text-4xl md:text-5xl font-bold text-white">
          Films et séries, au même endroit
        </h2>
        <p className="text-xl text-white/70 max-w-3xl mx-auto">
          Utilisez une seule recherche, filtrez par type, genre, date et note, puis
          explorez en mode carrousel ou en liste selon votre besoin.
        </p>
      </div>

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
          <div className="flex items-center gap-2 text-white">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-sm font-semibold">Filtres</span>
          </div>

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
              Series
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold text-white">Carrousel films</h3>
                <span className="text-white/60 text-sm">{filteredMovies.length} element(s)</span>
              </div>

              {filteredMovies.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {filteredMovies.map((movie) => (
                    <div key={movie.id} className="min-w-[220px] max-w-[220px] shrink-0">
                      <MovieCard movie={movie} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/60">{emptyMessage}</p>
              )}
            </section>
          )}

          {showSeries && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold text-white">Carrousel series</h3>
                <span className="text-white/60 text-sm">{filteredSeries.length} element(s)</span>
              </div>

              {filteredSeries.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {filteredSeries.map((show) => (
                    <div key={show.id} className="min-w-[220px] max-w-[220px] shrink-0">
                      <SeriesCard series={show} />
                    </div>
                  ))}
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
                <div className="grid grid-cols-1 gap-6">
                  {filteredMovies.map((movie) => (
                    <MovieCard key={movie.id} movie={movie} />
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
                <div className="grid grid-cols-1 gap-6">
                  {filteredSeries.map((show) => (
                    <SeriesCard key={show.id} series={show} />
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