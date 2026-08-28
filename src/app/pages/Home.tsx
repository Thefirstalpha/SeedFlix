import { ChevronLeft, ChevronRight, LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { MovieCard } from '../components/MovieCard';
import { MovieListItem } from '../components/MovieListItem';
import { SeriesCard } from '../components/SeriesCard';
import { SeriesListItem } from '../components/SeriesListItem';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useSearchState } from '../context/SearchStateContext';
import { Translator, useI18n } from '../i18n/LanguageProvider';
import { getMovieGenres, getPopularMoviesPage, searchMoviesPage } from '../services/movieService';
import { getPopularSeriesPage, getSeriesGenres, searchSeriesPage } from '../services/seriesService';
import { searchMultiPage } from '../services/tmdbService';

const CAROUSEL_WHEEL_SPEED = 3.8;

const DEFAULT_LANGUAGE_OPTIONS = [
  'fr',
  'en',
  'ja',
  'ko',
  'es',
  'it',
  'de',
  'pt',
  'ru',
  'zh',
  'unknown',
];

function toSortedUnique(items: string[]): string[] {
  return Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, 'fr'));
}

function normalizeLanguageCode(language: string | null | undefined): string {
  const normalized = String(language || '')
    .trim()
    .toLowerCase();

  if (!normalized) {
    return 'unknown';
  }

  const map: Record<string, string> = {
    fr: 'fr',
    francais: 'fr',
    français: 'fr',
    french: 'fr',
    en: 'en',
    anglais: 'en',
    english: 'en',
    ja: 'ja',
    japonais: 'ja',
    japanese: 'ja',
    ko: 'ko',
    coreen: 'ko',
    coréen: 'ko',
    korean: 'ko',
    es: 'es',
    espagnol: 'es',
    spanish: 'es',
    it: 'it',
    italien: 'it',
    italian: 'it',
    de: 'de',
    allemand: 'de',
    german: 'de',
    pt: 'pt',
    portugais: 'pt',
    portuguese: 'pt',
    ru: 'ru',
    russe: 'ru',
    russian: 'ru',
    zh: 'zh',
    chinois: 'zh',
    chinese: 'zh',
    inconnu: 'unknown',
    unknown: 'unknown',
  };

  return map[normalized] || normalized;
}

function getLanguageLabel(
  language: string,
  t: Translator,
): string {
  const normalized = normalizeLanguageCode(language);

  const map: Record<string, string> = {
    fr: t('home.languages.french'),
    en: t('home.languages.english'),
    ja: t('home.languages.japanese'),
    ko: t('home.languages.korean'),
    es: t('home.languages.spanish'),
    it: t('home.languages.italian'),
    de: t('home.languages.german'),
    pt: t('home.languages.portuguese'),
    ru: t('home.languages.russian'),
    zh: t('home.languages.chinese'),
    unknown: t('home.languages.unknown'),
  };

  return map[normalized] || language;
}

function yearToDateBounds(yearFrom: string, yearTo: string) {
  const parsedFrom = Number(yearFrom);
  const parsedTo = Number(yearTo);

  const safeFrom = Number.isFinite(parsedFrom) && parsedFrom > 0 ? parsedFrom : undefined;
  const safeTo = Number.isFinite(parsedTo) && parsedTo > 0 ? parsedTo : undefined;

  return { safeFrom, safeTo };
}

function toTmdbOriginalLanguageCode(language: string): string | undefined {
  const normalized = normalizeLanguageCode(language);
  if (!normalized || normalized === 'all' || normalized === 'unknown') {
    return undefined;
  }

  return normalized;
}

export function Home() {
  const { t, language } = useI18n();
  const { state, updateSearchState } = useSearchState();

  // Destructure state for easier access
  const {
    query,
    debouncedQuery,
    activeSearchQuery,
    popularCacheKey,
    contentFilter,
    viewMode,
    genreFilter,
    languageFilter,
    yearFrom,
    yearTo,
    minRating,
    filtersOpen,
    searchMultiItems,
    movieGenres,
    recommendedMovies,
    searchMovies,
    moviePage,
    movieTotalPages,
    seriesGenres,
    recommendedSeries,
    searchSeries,
    seriesPage,
    seriesTotalPages,
    isLoadingInitial,
    isLoadingMoreMovies,
    isLoadingMoreSeries,
    isSearching,
  } = state;

  const movieCarouselRef = useRef<HTMLDivElement | null>(null);
  const seriesCarouselRef = useRef<HTMLDivElement | null>(null);
  const skipNextPopularReloadRef = useRef(false);
  const scrollRestoredRef = useRef(false);
  const filtersPanelRef = useRef<HTMLDivElement | null>(null);

  const trimmedQuery = query.trim();
  const hasTypedSearch = trimmedQuery.length > 0;
  const stableSearchQuery = debouncedQuery.trim();
  const hasActiveSearch = activeSearchQuery.length > 0;
  const isSearchPending = hasTypedSearch && stableSearchQuery !== trimmedQuery;
  const showMovies = contentFilter !== 'series';
  const showSeries = contentFilter !== 'movie';

  const selectedMovieGenreId = useMemo(() => {
    if (genreFilter === 'all') return undefined;
    return movieGenres.find((genre) => genre.name === genreFilter)?.id;
  }, [genreFilter, movieGenres]);

  const selectedSeriesGenreId = useMemo(() => {
    if (genreFilter === 'all') return undefined;
    return seriesGenres.find((genre) => genre.name === genreFilter)?.id;
  }, [genreFilter, seriesGenres]);

  const ratingThreshold = Number(minRating) || 0;
  const { safeFrom: yearStart, safeTo: yearEnd } = yearToDateBounds(yearFrom, yearTo);
  const selectedOriginalLanguageCode = toTmdbOriginalLanguageCode(languageFilter);
  const popularRequestKey = useMemo(
    () =>
      JSON.stringify({
        language,
        contentFilter,
        selectedMovieGenreId: selectedMovieGenreId ?? null,
        selectedSeriesGenreId: selectedSeriesGenreId ?? null,
        yearStart: yearStart ?? null,
        yearEnd: yearEnd ?? null,
        minRating: ratingThreshold,
        originalLanguage: selectedOriginalLanguageCode ?? null,
      }),
    [
      language,
      contentFilter,
      selectedMovieGenreId,
      selectedSeriesGenreId,
      yearStart,
      yearEnd,
      ratingThreshold,
      selectedOriginalLanguageCode,
    ],
  );

  useEffect(() => {
    const loadGenres = async () => {
      updateSearchState({ isLoadingGenres: true });
      try {
        const [moviesGenresResponse, seriesGenresResponse] = await Promise.all([
          getMovieGenres(language),
          getSeriesGenres(language),
        ]);
        updateSearchState({
          movieGenres: moviesGenresResponse,
          seriesGenres: seriesGenresResponse,
        });
      } catch (error) {
        console.error('Error loading genres:', error);
      } finally {
        updateSearchState({ isLoadingGenres: false });
      }
    };

    loadGenres();
  }, [language]);

  const fetchMovieRecommendations = async (page = 1) => {
    return getPopularMoviesPage(
      page,
      {
        genreId: selectedMovieGenreId,
        yearFrom: yearStart,
        yearTo: yearEnd,
        minRating: ratingThreshold,
        originalLanguage: selectedOriginalLanguageCode,
      },
      language,
    );
  };

  const fetchSeriesRecommendations = async (page = 1) => {
    return getPopularSeriesPage(
      page,
      {
        genreId: selectedSeriesGenreId,
        yearFrom: yearStart,
        yearTo: yearEnd,
        minRating: ratingThreshold,
        originalLanguage: selectedOriginalLanguageCode,
      },
      language,
    );
  };

  const loadMovieRecommendations = async (page = 1, append = false) => {
    if (!showMovies) {
      updateSearchState({
        recommendedMovies: [],
        moviePage: 1,
        movieTotalPages: 1,
      });
      return;
    }

    try {
      if (page > 1) {
        updateSearchState({ isLoadingMoreMovies: true });
      }

      const response = await fetchMovieRecommendations(page);
      updateSearchState((prev) => ({
        recommendedMovies: append
          ? [...prev.recommendedMovies, ...response.movies]
          : response.movies,
        moviePage: response.page,
        movieTotalPages: response.totalPages,
        isLoadingMoreMovies: false,
      }));
    } catch (error) {
      console.error('Error loading movie recommendations:', error);
      if (!append) {
        updateSearchState({ recommendedMovies: [] });
      }
      updateSearchState({ isLoadingMoreMovies: false });
    }
  };

  const loadSeriesRecommendations = async (page = 1, append = false) => {
    if (!showSeries) {
      updateSearchState({
        recommendedSeries: [],
        seriesPage: 1,
        seriesTotalPages: 1,
      });
      return;
    }

    try {
      if (page > 1) {
        updateSearchState({ isLoadingMoreSeries: true });
      }

      const response = await fetchSeriesRecommendations(page);
      updateSearchState((prev) => ({
        recommendedSeries: append
          ? [...prev.recommendedSeries, ...response.series]
          : response.series,
        seriesPage: response.page,
        seriesTotalPages: response.totalPages,
        isLoadingMoreSeries: false,
      }));
    } catch (error) {
      console.error('Error loading series recommendations:', error);
      if (!append) {
        updateSearchState({ recommendedSeries: [] });
      }
      updateSearchState({ isLoadingMoreSeries: false });
    }
  };

  useEffect(() => {
    if (hasTypedSearch || hasActiveSearch) return;
    if (skipNextPopularReloadRef.current) {
      skipNextPopularReloadRef.current = false;
      return;
    }

    const hasMoviesForView = !showMovies || recommendedMovies.length > 0;
    const hasSeriesForView = !showSeries || recommendedSeries.length > 0;
    const isPopularCacheValid = popularCacheKey === popularRequestKey;

    // Skip reload if same filters/langue and we already have data for current view.
    if (isPopularCacheValid && hasMoviesForView && hasSeriesForView) {
      if (isLoadingInitial) {
        updateSearchState({ isLoadingInitial: false });
      }
      return;
    }

    const loadInitialRecommendations = async () => {
      // Reset visible data first so filter/language changes clearly reload both lists.
      updateSearchState({
        recommendedMovies: [],
        recommendedSeries: [],
        moviePage: 1,
        movieTotalPages: 1,
        seriesPage: 1,
        seriesTotalPages: 1,
        isLoadingInitial: true,
      });

      if (movieCarouselRef.current) {
        movieCarouselRef.current.scrollLeft = 0;
      }
      if (seriesCarouselRef.current) {
        seriesCarouselRef.current.scrollLeft = 0;
      }

      try {
        await Promise.all([
          loadMovieRecommendations(1, false),
          loadSeriesRecommendations(1, false),
        ]);
        updateSearchState({ popularCacheKey: popularRequestKey });
      } finally {
        updateSearchState({ isLoadingInitial: false });
      }
    };

    loadInitialRecommendations();
  }, [hasTypedSearch, hasActiveSearch, showMovies, showSeries, popularCacheKey, popularRequestKey]);

  useEffect(() => {
    if (!trimmedQuery) {
      if (hasActiveSearch) {
        skipNextPopularReloadRef.current = true;
      }
      updateSearchState({
        debouncedQuery: '',
        activeSearchQuery: '',
        searchMultiItems: [],
        searchMovies: [],
        searchSeries: [],
        isSearching: false,
      });
      return;
    }

    const timeoutId = setTimeout(() => {
      updateSearchState({ debouncedQuery: trimmedQuery });
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [trimmedQuery, hasActiveSearch]);

  useEffect(() => {
    if (!stableSearchQuery) {
      return;
    }

    let cancelled = false;

    const runSearch = async () => {
      updateSearchState({ isSearching: true });
      try {
        if (contentFilter === 'all') {
          const multiResponse = await searchMultiPage(stableSearchQuery, 1, language);

          if (cancelled) {
            return;
          }

          updateSearchState({
            searchMultiItems: multiResponse.items,
            searchMovies: multiResponse.movies,
            searchSeries: multiResponse.series,
            activeSearchQuery: stableSearchQuery,
            isSearching: false,
          });
        } else if (contentFilter === 'movie') {
          const movieResponse = await searchMoviesPage(stableSearchQuery, 1, language);

          if (cancelled) {
            return;
          }

          updateSearchState({
            searchMultiItems: movieResponse.movies.map((movie) => ({ type: 'movie', data: movie })),
            searchMovies: movieResponse.movies,
            searchSeries: [],
            activeSearchQuery: stableSearchQuery,
            isSearching: false,
          });
        } else {
          const seriesResponse = await searchSeriesPage(stableSearchQuery, 1, language);

          if (cancelled) {
            return;
          }

          updateSearchState({
            searchMultiItems: seriesResponse.series.map((show) => ({ type: 'series', data: show })),
            searchMovies: [],
            searchSeries: seriesResponse.series,
            activeSearchQuery: stableSearchQuery,
            isSearching: false,
          });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Error searching content:', error);
        updateSearchState({
          searchMultiItems: [],
          searchMovies: [],
          searchSeries: [],
          activeSearchQuery: stableSearchQuery,
          isSearching: false,
        });
      }
    };

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [stableSearchQuery, contentFilter, language]);

  const maybeLoadMoreMovies = async (container: HTMLDivElement | null) => {
    if (!container || hasTypedSearch || isLoadingMoreMovies || moviePage >= movieTotalPages) {
      return;
    }

    const remaining = container.scrollWidth - container.clientWidth - container.scrollLeft;
    if (remaining <= 120) {
      await loadMovieRecommendations(moviePage + 1, true);
    }
  };

  const maybeLoadMoreSeries = async (container: HTMLDivElement | null) => {
    if (!container || hasTypedSearch || isLoadingMoreSeries || seriesPage >= seriesTotalPages) {
      return;
    }

    const remaining = container.scrollWidth - container.clientWidth - container.scrollLeft;
    if (remaining <= 120) {
      await loadSeriesRecommendations(seriesPage + 1, true);
    }
  };

  const scrollCarousel = (container: HTMLDivElement | null, direction: 'left' | 'right') => {
    if (!container) {
      return;
    }

    container.scrollBy({
      left: (direction === 'right' ? 1 : -1) * container.clientWidth * 0.85,
      behavior: 'smooth',
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
        return () => { };
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

      container.addEventListener('wheel', onWheel, { passive: false });
      return () => container.removeEventListener('wheel', onWheel);
    };

    const cleanupMovie = attachWheelBlocker(movieCarouselRef.current);
    const cleanupSeries = attachWheelBlocker(seriesCarouselRef.current);

    return () => {
      cleanupMovie();
      cleanupSeries();
    };
  }, []);

  // Restore scroll positions on mount and attach scroll listeners
  useEffect(() => {
    // Restore scroll positions only once on mount
    if (!scrollRestoredRef.current && movieCarouselRef.current && seriesCarouselRef.current) {
      if (state.movieCarouselScrollLeft > 0) {
        movieCarouselRef.current.scrollLeft = state.movieCarouselScrollLeft;
      }
      if (state.seriesCarouselScrollLeft > 0) {
        seriesCarouselRef.current.scrollLeft = state.seriesCarouselScrollLeft;
      }
      scrollRestoredRef.current = true;
    }

    // Attach scroll listeners to save scroll positions
    const onMovieScroll = () => {
      if (movieCarouselRef.current) {
        updateSearchState({ movieCarouselScrollLeft: movieCarouselRef.current.scrollLeft });
      }
    };

    const onSeriesScroll = () => {
      if (seriesCarouselRef.current) {
        updateSearchState({ seriesCarouselScrollLeft: seriesCarouselRef.current.scrollLeft });
      }
    };

    const movieCarousel = movieCarouselRef.current;
    const seriesCarousel = seriesCarouselRef.current;

    movieCarousel?.addEventListener('scroll', onMovieScroll);
    seriesCarousel?.addEventListener('scroll', onSeriesScroll);

    return () => {
      movieCarousel?.removeEventListener('scroll', onMovieScroll);
      seriesCarousel?.removeEventListener('scroll', onSeriesScroll);
    };
  }, []);

  const isSearchBusy = isSearchPending || isSearching;
  const shouldShowSearchResults = hasActiveSearch;
  const shouldShowPopularSections = !hasActiveSearch;

  const baseMovies = shouldShowSearchResults ? searchMovies : recommendedMovies;
  const baseSeries = shouldShowSearchResults ? searchSeries : recommendedSeries;

  const availableGenres = useMemo(() => {
    const namesFromMovies = showMovies ? movieGenres.map((genre) => genre.name) : [];
    const namesFromSeries = showSeries ? seriesGenres.map((genre) => genre.name) : [];
    return toSortedUnique([...namesFromMovies, ...namesFromSeries]);
  }, [movieGenres, seriesGenres, showMovies, showSeries]);

  const availableLanguages = useMemo(() => {
    const movieLanguages = showMovies
      ? baseMovies.map((movie) => normalizeLanguageCode(movie.language))
      : [];
    const seriesLanguages = showSeries
      ? baseSeries.map((show) => normalizeLanguageCode(show.language))
      : [];
    return toSortedUnique([...DEFAULT_LANGUAGE_OPTIONS, ...movieLanguages, ...seriesLanguages]);
  }, [baseMovies, baseSeries, showMovies, showSeries]);

  useEffect(() => {
    if (genreFilter !== 'all' && !availableGenres.includes(genreFilter)) {
      updateSearchState({ genreFilter: 'all' });
    }
  }, [availableGenres, genreFilter]);

  useEffect(() => {
    if (languageFilter !== 'all' && !availableLanguages.includes(languageFilter)) {
      updateSearchState({ languageFilter: 'all' });
    }
  }, [availableLanguages, languageFilter]);

  useEffect(() => {
    if (!filtersOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!filtersPanelRef.current?.contains(event.target as Node)) {
        updateSearchState({ filtersOpen: false });
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [filtersOpen]);

  const localYearStart = yearStart ?? 0;
  const localYearEnd = yearEnd ?? 9999;

  const filteredMovies = useMemo(() => {
    return baseMovies.filter((movie) => {
      const matchesLanguage =
        languageFilter === 'all' || normalizeLanguageCode(movie.language) === languageFilter;

      if (!shouldShowSearchResults) {
        const matchesRating = ratingThreshold === 0 || movie.rating >= ratingThreshold;
        return matchesLanguage && matchesRating;
      }

      const matchesGenre = genreFilter === 'all' || movie.genre === genreFilter;
      const matchesYear = movie.year >= localYearStart && movie.year <= localYearEnd;
      const matchesRating = movie.rating >= ratingThreshold;
      return matchesGenre && matchesYear && matchesRating && matchesLanguage;
    });
  }, [
    baseMovies,
    genreFilter,
    shouldShowSearchResults,
    languageFilter,
    localYearStart,
    localYearEnd,
    ratingThreshold,
  ]);

  const filteredSeries = useMemo(() => {
    return baseSeries.filter((show) => {
      const matchesLanguage =
        languageFilter === 'all' || normalizeLanguageCode(show.language) === languageFilter;

      if (!shouldShowSearchResults) {
        const matchesRating = ratingThreshold === 0 || show.rating >= ratingThreshold;
        return matchesLanguage && matchesRating;
      }

      const matchesGenre = genreFilter === 'all' || show.genre === genreFilter;
      const matchesYear = show.year >= localYearStart && show.year <= localYearEnd;
      const matchesRating = show.rating >= ratingThreshold;
      return matchesGenre && matchesYear && matchesRating && matchesLanguage;
    });
  }, [
    baseSeries,
    genreFilter,
    shouldShowSearchResults,
    languageFilter,
    localYearStart,
    localYearEnd,
    ratingThreshold,
  ]);

  const filteredMultiItems = useMemo(() => {
    if (!shouldShowSearchResults) return [];
    return searchMultiItems.filter((item) => {
      const media = item.data;
      const matchesLanguage =
        languageFilter === 'all' || normalizeLanguageCode(media.language) === languageFilter;
      const matchesGenre = genreFilter === 'all' || media.genre === genreFilter;
      const matchesYear = media.year >= localYearStart && media.year <= localYearEnd;
      const matchesRating = media.rating >= ratingThreshold;
      return matchesGenre && matchesYear && matchesRating && matchesLanguage;
    });
  }, [
    shouldShowSearchResults,
    searchMultiItems,
    genreFilter,
    languageFilter,
    localYearStart,
    localYearEnd,
    ratingThreshold,
  ]);

  const emptyMessage = shouldShowSearchResults ? t('home.emptySearch') : t('home.emptyFilters');

  const activeFilterCount = [
    genreFilter !== 'all',
    languageFilter !== 'all',
    yearFrom.trim() !== '',
    yearTo.trim() !== '',
    minRating !== '0',
  ].filter(Boolean).length;

  const resetFilters = () => {
    updateSearchState({
      genreFilter: 'all',
      languageFilter: 'all',
      yearFrom: '',
      yearTo: '',
      minRating: '0',
    });
  };

  return (
    <div className="space-y-5">
      <div className="max-w-5xl mx-auto space-y-2">
        <div ref={filtersPanelRef} className="relative">
          <div className="relative overflow-hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
            <Input
              type="text"
              placeholder={t('home.searchPlaceholder')}
              value={query}
              onChange={(event) => updateSearchState({ query: event.target.value })}
              className="pl-10 pr-20 h-12 bg-white/10 text-white placeholder:text-white/50 rounded-xl border border-white/20 focus-visible:none"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query && (
                <X type="button" className="flex items-center justify-center w-6 h-6 text-red-500 hover:bg-red-700 rounded-full focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                  onClick={() => updateSearchState({ query: '' })} />
              )}
              <button
                type="button"
                onClick={() => updateSearchState((prev) => ({ filtersOpen: !prev.filtersOpen }))}
                title={t('home.filters')}
                className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${filtersOpen ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-bold text-slate-900">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
            <div
              className={`search-wave-overlay pointer-events-none absolute rounded-xl border inset-0 transition-opacity duration-500 ${isSearchBusy ? 'opacity-100' : 'opacity-0'}`}
              aria-hidden="true"
            />
          </div>

          {filtersOpen && (
            <div className="absolute left-0 right-0 z-20 mt-2 rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur-md p-4 shadow-2xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="home-filter-genre" className="text-xs font-medium text-white/60">
                    {t('home.genreLabel')}
                  </label>
                  <select
                    id="home-filter-genre"
                    value={genreFilter}
                    onChange={(event) => updateSearchState({ genreFilter: event.target.value })}
                    className="h-10 w-full rounded-md border border-white/20 bg-slate-900 px-3 text-white"
                  >
                    <option value="all">{t('home.allGenres')}</option>
                    {availableGenres.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="home-filter-language" className="text-xs font-medium text-white/60">
                    {t('home.languageLabel')}
                  </label>
                  <select
                    id="home-filter-language"
                    value={languageFilter}
                    onChange={(event) => updateSearchState({ languageFilter: event.target.value })}
                    className="h-10 w-full rounded-md border border-white/20 bg-slate-900 px-3 text-white"
                  >
                    <option value="all">{t('home.allLanguages')}</option>
                    {availableLanguages.map((language) => (
                      <option key={language} value={language}>
                        {getLanguageLabel(language, t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-white/60">{t('home.yearLabel')}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1900}
                      max={2100}
                      aria-label={t('home.minYear')}
                      placeholder={t('home.minYear')}
                      value={yearFrom}
                      onChange={(event) => updateSearchState({ yearFrom: event.target.value })}
                      className="h-10 bg-slate-900 border-white/20 text-white"
                    />
                    <span className="text-xs text-white/40 shrink-0">{t('home.yearTo')}</span>
                    <Input
                      type="number"
                      min={1900}
                      max={2100}
                      aria-label={t('home.maxYear')}
                      placeholder={t('home.maxYear')}
                      value={yearTo}
                      onChange={(event) => updateSearchState({ yearTo: event.target.value })}
                      className="h-10 bg-slate-900 border-white/20 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="home-filter-rating" className="text-xs font-medium text-white/60">
                    {t('home.ratingLabel')}
                  </label>
                  <select
                    id="home-filter-rating"
                    value={minRating}
                    onChange={(event) => updateSearchState({ minRating: event.target.value })}
                    className="h-10 w-full rounded-md border border-white/20 bg-slate-900 px-3 text-white"
                  >
                    <option value="0">{t('home.allRatings')}</option>
                    <option value="6">{t('home.minRating', { value: 6 })}</option>
                    <option value="7">{t('home.minRating', { value: 7 })}</option>
                    <option value="8">{t('home.minRating', { value: 8 })}</option>
                    <option value="9">{t('home.minRating', { value: 9 })}</option>
                  </select>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={resetFilters}
                    className="text-white/60 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    {t('home.resetFilters')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1 flex-1">
            <Button
              size="sm"
              onClick={() => updateSearchState({ contentFilter: 'all' })}
              className={`flex-1 ${contentFilter === 'all'
                ? 'bg-white text-slate-900 hover:bg-white/90 font-medium'
                : 'bg-transparent text-white hover:bg-white/10'
                }`}
            >
              {t('home.all')}
            </Button>
            <Button
              size="sm"
              onClick={() => updateSearchState({ contentFilter: 'movie' })}
              className={`flex-1 ${contentFilter === 'movie'
                ? 'bg-purple-600 text-white hover:bg-purple-700 font-medium'
                : 'bg-transparent text-white hover:bg-white/10'
                }`}
            >
              {t('home.movies')}
            </Button>
            <Button
              size="sm"
              onClick={() => updateSearchState({ contentFilter: 'series' })}
              className={`flex-1 ${contentFilter === 'series'
                ? 'bg-cyan-600 text-white hover:bg-cyan-700 font-medium'
                : 'bg-transparent text-white hover:bg-white/10'
                }`}
            >
              {t('home.series')}
            </Button>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => updateSearchState({ viewMode: 'card' })}
              title={t('home.viewModeCard')}
              className={`h-8 px-2.5 rounded-lg transition-colors ${
                viewMode === 'card'
                  ? 'bg-white/20 text-white font-medium shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => updateSearchState({ viewMode: 'list' })}
              title={t('home.viewModeList')}
              className={`h-8 px-2.5 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-white/20 text-white font-medium shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoadingInitial && !shouldShowSearchResults && (
        viewMode === 'list' ? (
          <div className="space-y-3">
            {[...new Array(6)].map((_, i) => (
              <div key={i} className="h-28 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...new Array(8)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        )
      )}

      {!isLoadingInitial && shouldShowPopularSections && (
        <div className="space-y-8">
          {showMovies && (
            <section className="space-y-4">
              <h3 className="text-2xl font-semibold text-white">{t('home.popularMovies')}</h3>

              {filteredMovies.length > 0 ? (
                viewMode === 'card' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => scrollCarousel(movieCarouselRef.current, 'left')}
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
                        className="-mx-4 lg:mx-0 flex-1 overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth touch-auto overscroll-x-contain"
                      >
                        <div className="flex gap-3 sm:gap-4 py-4 pr-4 lg:pr-4 pl-4 lg:pl-0">
                          {filteredMovies.map((movie) => (
                            <div
                              key={movie.id}
                              className="min-w-[172px] max-w-[172px] sm:min-w-[196px] sm:max-w-[196px] md:min-w-[220px] md:max-w-[220px] shrink-0"
                            >
                              <MovieCard movie={movie} />
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => scrollCarousel(movieCarouselRef.current, 'right')}
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
                        onClick={() => scrollCarousel(movieCarouselRef.current, 'left')}
                        className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => scrollCarousel(movieCarouselRef.current, 'right')}
                        className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMovies.map((movie) => (
                      <MovieListItem key={movie.id} movie={movie} />
                    ))}
                  </div>
                )
              ) : (
                <p className="text-white/60">{emptyMessage}</p>
              )}
            </section>
          )}

          {showSeries && (
            <section className="space-y-4">
              <h3 className="text-2xl font-semibold text-white">{t('home.popularSeries')}</h3>

              {filteredSeries.length > 0 ? (
                viewMode === 'card' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => scrollCarousel(seriesCarouselRef.current, 'left')}
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
                        className="-mx-4 lg:mx-0 flex-1 overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth touch-auto overscroll-x-contain"
                      >
                        <div className="flex gap-3 sm:gap-4 py-4 pr-4 lg:pr-4 pl-4 lg:pl-0">
                          {filteredSeries.map((show) => (
                            <div
                              key={show.id}
                              className="min-w-[172px] max-w-[172px] sm:min-w-[196px] sm:max-w-[196px] md:min-w-[220px] md:max-w-[220px] shrink-0"
                            >
                              <SeriesCard series={show} />
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => scrollCarousel(seriesCarouselRef.current, 'right')}
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
                        onClick={() => scrollCarousel(seriesCarouselRef.current, 'left')}
                        className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => scrollCarousel(seriesCarouselRef.current, 'right')}
                        className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSeries.map((show) => (
                      <SeriesListItem key={show.id} series={show} />
                    ))}
                  </div>
                )
              ) : (
                <p className="text-white/60">{emptyMessage}</p>
              )}
            </section>
          )}
        </div>
      )}

      {shouldShowSearchResults && (
        <div className="space-y-8">
          {contentFilter === 'all' && (
            <section className="space-y-4">
              {filteredMultiItems.length > 0 ? (
                viewMode === 'card' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredMultiItems.map((item) =>
                      item.type === 'movie' ? (
                        <MovieCard key={`movie-${item.data.id}`} movie={item.data} />
                      ) : (
                        <SeriesCard key={`series-${item.data.id}`} series={item.data} />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMultiItems.map((item) =>
                      item.type === 'movie' ? (
                        <MovieListItem
                          key={`movie-${item.data.id}`}
                          movie={item.data}
                          showTypeBadge={true}
                        />
                      ) : (
                        <SeriesListItem
                          key={`series-${item.data.id}`}
                          series={item.data}
                          showTypeBadge={true}
                        />
                      ),
                    )}
                  </div>
                )
              ) : (
                <p className="text-white/60">{emptyMessage}</p>
              )}
            </section>
          )}

          {contentFilter === 'movie' && (
            <section className="space-y-4">
              <h4 className="text-xl font-semibold text-white">{t('home.movies')}</h4>
              {filteredMovies.length > 0 ? (
                viewMode === 'card' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredMovies.map((movie) => (
                      <MovieCard key={movie.id} movie={movie} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMovies.map((movie) => (
                      <MovieListItem key={movie.id} movie={movie} />
                    ))}
                  </div>
                )
              ) : (
                <p className="text-white/60">{t('home.noMoviesMatch')}</p>
              )}
            </section>
          )}

          {contentFilter === 'series' && (
            <section className="space-y-4">
              <h4 className="text-xl font-semibold text-white">{t('home.series')}</h4>
              {filteredSeries.length > 0 ? (
                viewMode === 'card' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredSeries.map((show) => (
                      <SeriesCard key={show.id} series={show} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSeries.map((show) => (
                      <SeriesListItem key={show.id} series={show} />
                    ))}
                  </div>
                )
              ) : (
                <p className="text-white/60">{t('home.noSeriesMatch')}</p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
