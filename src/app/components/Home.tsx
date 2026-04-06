import { useState, useEffect } from "react";
import { Search, AlertCircle } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { MovieCard } from "./MovieCard";
import {
  searchMoviesPage,
  getPopularMoviesPage,
} from "../services/movieService";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "./ui/alert";
import type { Movie } from "../types/movie";

export function Home() {
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showApiWarning, setShowApiWarning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Charger les films populaires au démarrage
  useEffect(() => {
    loadPopularMovies();
  }, []);

  const loadPopularMovies = async (
    page = 1,
    append = false,
  ) => {
    if (page === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = await getPopularMoviesPage(page);
      setMovies((prevMovies) =>
        append
          ? [...prevMovies, ...response.movies]
          : response.movies,
      );
      setCurrentPage(response.page);
      setTotalPages(response.totalPages);
    } catch (error) {
      console.error("Error loading popular movies:", error);
    } finally {
      if (page === 1) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  };

  const runSearch = async (
    searchQuery: string,
    page = 1,
    append = false,
  ) => {
    if (page === 1) {
      setIsSearching(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = await searchMoviesPage(searchQuery, page);
      setMovies((prevMovies) =>
        append
          ? [...prevMovies, ...response.movies]
          : response.movies,
      );
      setCurrentPage(response.page);
      setTotalPages(response.totalPages);

      // Afficher l'avertissement si aucun résultat et pas de clé API
      if (
        page === 1 &&
        response.movies.length === 0 &&
        searchQuery.trim()
      ) {
        setShowApiWarning(true);
      } else if (page === 1) {
        setShowApiWarning(false);
      }
    } catch (error) {
      console.error("Error searching movies:", error);
    } finally {
      if (page === 1) {
        setIsSearching(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch(query, 1, false);
  };

  const handleLoadMore = async () => {
    const nextPage = currentPage + 1;
    if (query.trim()) {
      await runSearch(query, nextPage, true);
      return;
    }

    await loadPopularMovies(nextPage, true);
  };

  const hasMoreMovies = currentPage < totalPages;

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-8">
        <h2 className="text-4xl md:text-5xl font-bold text-white">
          Trouvez votre prochain film préféré
        </h2>
        <p className="text-xl text-white/70 max-w-2xl mx-auto">
          Explorez des milliers de films avec l'API TMDB et
          découvrez des informations détaillées
        </p>
      </div>

      {/* API Warning */}
      {showApiWarning && (
        <Alert className="max-w-3xl mx-auto bg-yellow-500/10 border-yellow-500/30">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-500">
            Configuration API requise
          </AlertTitle>
          <AlertDescription className="text-white/70">
            Pour utiliser la recherche en temps réel TMDB,
            ajoutez votre clé API dans{" "}
            <code className="bg-white/10 px-1 rounded">
              /src/app/config/tmdb.ts
            </code>
            . Obtenez votre clé gratuite sur{" "}
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              themoviedb.org
            </a>
            .
          </AlertDescription>
        </Alert>
      )}

      {/* Search Bar */}
      <form
        onSubmit={handleSearch}
        className="max-w-3xl mx-auto"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
            <Input
              type="text"
              placeholder="Rechercher un film..."
              value={query}
              onChange={async (e) => {
                const newQuery = e.target.value;
                setQuery(newQuery);
                await runSearch(newQuery, 1, false);
              }}
              className="pl-10 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
          </div>
        </div>
      </form>

      {/* Results Section */}
      <div>
        <h3 className="text-2xl font-semibold text-white mb-6">
          {query
            ? `Résultats pour "${query}"`
            : "Films populaires"}
        </h3>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] bg-white/5 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : movies.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {movies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>

            {hasMoreMovies && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="min-w-40"
                >
                  {isLoadingMore ? "Chargement..." : "Load More"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-white/60 text-lg">
              Aucun film trouvé
            </p>
          </div>
        )}
      </div>
    </div>
  );
}