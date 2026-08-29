import { useEffect, useMemo, useCallback } from 'react';
import { useSearchState } from '../context/SearchStateContext';
import { Translator, useI18n } from '../i18n/LanguageProvider';
import { getMovieGenres, getPopularMoviesPage, searchMoviesPage } from '../services/movieService';
import { getPopularSeriesPage, getSeriesGenres, searchSeriesPage } from '../services/seriesService';
import { searchMultiPage } from '../services/tmdbService';
import { HomeSearchBar } from '../components/home/HomeSearchBar';
import { HomeFiltersModal } from '../components/home/HomeFiltersModal';
import { MediaCarouselSection } from '../components/home/MediaCarouselSection';
import { MediaGridSection, GridMediaItem } from '../components/home/MediaGridSection';

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

function getLanguageLabel(language: string, t: Translator): string {
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

  const trimmedQuery = query.trim();
  const hasTypedSearch = trimmedQuery.length > 0;
  const stableSearchQuery = debouncedQuery.trim();
  const hasActiveSearch = activeSearchQuery.length > 0;
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

  // Load genres on language change
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

    void loadGenres();
  }, [language, updateSearchState]);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      updateSearchState({ debouncedQuery: query });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, updateSearchState]);

  const loadMovieRecommendations = useCallback(async (page = 1, append = false) => {
    if (!showMovies) return;
    try {
      if (page > 1) updateSearchState({ isLoadingMoreMovies: true });
      const response = await getPopularMoviesPage(
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
      updateSearchState((prev) => ({
        recommendedMovies: append ? [...prev.recommendedMovies, ...response.movies] : response.movies,
        moviePage: response.page,
        movieTotalPages: response.totalPages,
        isLoadingMoreMovies: false,
      }));
    } catch (error) {
      console.error('Error loading movies:', error);
      updateSearchState({ isLoadingMoreMovies: false });
    }
  }, [showMovies, selectedMovieGenreId, yearStart, yearEnd, ratingThreshold, selectedOriginalLanguageCode, language, updateSearchState]);

  const loadSeriesRecommendations = useCallback(async (page = 1, append = false) => {
    if (!showSeries) return;
    try {
      if (page > 1) updateSearchState({ isLoadingMoreSeries: true });
      const response = await getPopularSeriesPage(
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
      updateSearchState((prev) => ({
        recommendedSeries: append ? [...prev.recommendedSeries, ...response.series] : response.series,
        seriesPage: response.page,
        seriesTotalPages: response.totalPages,
        isLoadingMoreSeries: false,
      }));
    } catch (error) {
      console.error('Error loading series:', error);
      updateSearchState({ isLoadingMoreSeries: false });
    }
  }, [showSeries, selectedSeriesGenreId, yearStart, yearEnd, ratingThreshold, selectedOriginalLanguageCode, language, updateSearchState]);

  // Initial & popular recommendations reload
  useEffect(() => {
    if (hasTypedSearch || hasActiveSearch) return;
    if (popularCacheKey === popularRequestKey && (recommendedMovies.length > 0 || recommendedSeries.length > 0)) {
      return;
    }

    let isMounted = true;
    updateSearchState({ isLoadingInitial: true });

    Promise.all([
      showMovies ? loadMovieRecommendations(1, false) : Promise.resolve(),
      showSeries ? loadSeriesRecommendations(1, false) : Promise.resolve(),
    ]).finally(() => {
      if (isMounted) {
        updateSearchState({
          isLoadingInitial: false,
          popularCacheKey: popularRequestKey,
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [hasTypedSearch, hasActiveSearch, popularCacheKey, popularRequestKey, showMovies, showSeries, loadMovieRecommendations, loadSeriesRecommendations, updateSearchState, recommendedMovies.length, recommendedSeries.length]);

  // Execute Search
  useEffect(() => {
    if (!stableSearchQuery) {
      if (activeSearchQuery) {
        updateSearchState({
          activeSearchQuery: '',
          searchMovies: [],
          searchSeries: [],
          searchMultiItems: [],
          isSearching: false,
        });
      }
      return;
    }

    let isMounted = true;
    updateSearchState({ isSearching: true, activeSearchQuery: stableSearchQuery });

    const runSearch = async () => {
      try {
        if (contentFilter === 'all') {
          const res = await searchMultiPage(stableSearchQuery, 1, language);
          if (isMounted) {
            updateSearchState({ searchMultiItems: res.items, isSearching: false });
          }
        } else if (contentFilter === 'movie') {
          const res = await searchMoviesPage(stableSearchQuery, 1, language);
          if (isMounted) {
            updateSearchState({ searchMovies: res.movies, isSearching: false });
          }
        } else {
          const res = await searchSeriesPage(stableSearchQuery, 1, language);
          if (isMounted) {
            updateSearchState({ searchSeries: res.series, isSearching: false });
          }
        }
      } catch (error) {
        console.error('Error running search:', error);
        if (isMounted) updateSearchState({ isSearching: false });
      }
    };

    void runSearch();
    return () => {
      isMounted = false;
    };
  }, [stableSearchQuery, contentFilter, language, activeSearchQuery, updateSearchState]);

  // Combine available genres
  const availableGenres = useMemo(() => {
    const combined = [...movieGenres, ...seriesGenres];
    const unique = new Map<string, number>();
    for (const g of combined) {
      if (!unique.has(g.name)) unique.set(g.name, g.id);
    }
    return Array.from(unique.entries()).map(([name, id]) => ({ id, name }));
  }, [movieGenres, seriesGenres]);

  const availableLanguages = useMemo(() => {
    const langs = new Set(DEFAULT_LANGUAGE_OPTIONS);
    for (const m of recommendedMovies) if (m.language) langs.add(m.language);
    for (const s of recommendedSeries) if (s.language) langs.add(s.language);
    return toSortedUnique(Array.from(langs));
  }, [recommendedMovies, recommendedSeries]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (genreFilter !== 'all') count += 1;
    if (languageFilter !== 'all') count += 1;
    if (yearFrom) count += 1;
    if (yearTo) count += 1;
    if (minRating && minRating !== '0') count += 1;
    return count;
  }, [genreFilter, languageFilter, yearFrom, yearTo, minRating]);

  const resetFilters = () => {
    updateSearchState({
      genreFilter: 'all',
      languageFilter: 'all',
      yearFrom: '',
      yearTo: '',
      minRating: '0',
    });
  };

  const shouldShowSearchResults = Boolean(hasActiveSearch || isSearching);

  // Search Results formatters
  const gridItems: GridMediaItem[] = useMemo(() => {
    if (contentFilter === 'all') {
      return searchMultiItems.map((item) => ({
        type: item.type,
        data: item.data,
      }));
    }
    if (contentFilter === 'movie') {
      return searchMovies.map((m) => ({ type: 'movie' as const, data: m }));
    }
    return searchSeries.map((s) => ({ type: 'series' as const, data: s }));
  }, [contentFilter, searchMultiItems, searchMovies, searchSeries]);

  // Infinite scroll trigger for carousels
  const handleCarouselScroll = (type: 'movie' | 'series', container: HTMLDivElement) => {
    const isNearEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 300;
    if (!isNearEnd) return;

    if (type === 'movie' && !isLoadingMoreMovies && moviePage < movieTotalPages) {
      void loadMovieRecommendations(moviePage + 1, true);
    } else if (type === 'series' && !isLoadingMoreSeries && seriesPage < seriesTotalPages) {
      void loadSeriesRecommendations(seriesPage + 1, true);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Search Bar & View/Filter Toggles */}
      <HomeSearchBar
        query={query}
        onQueryChange={(val) => updateSearchState({ query: val })}
        onClearQuery={() => updateSearchState({ query: '', debouncedQuery: '', activeSearchQuery: '' })}
        filtersOpen={filtersOpen}
        onToggleFilters={() => updateSearchState({ filtersOpen: !filtersOpen })}
        activeFilterCount={activeFilterCount}
        contentFilter={contentFilter}
        onContentFilterChange={(filter) => updateSearchState({ contentFilter: filter })}
        viewMode={viewMode}
        onViewModeChange={(mode) => updateSearchState({ viewMode: mode })}
      />

      {/* Filter Modal / Panel */}
      <HomeFiltersModal
        isOpen={filtersOpen}
        genreFilter={genreFilter}
        onGenreChange={(genre) => updateSearchState({ genreFilter: genre })}
        availableGenres={availableGenres}
        languageFilter={languageFilter}
        onLanguageChange={(lang) => updateSearchState({ languageFilter: lang })}
        availableLanguages={availableLanguages}
        getLanguageLabel={getLanguageLabel}
        yearFrom={yearFrom}
        onYearFromChange={(val) => updateSearchState({ yearFrom: val })}
        yearTo={yearTo}
        onYearToChange={(val) => updateSearchState({ yearTo: val })}
        minRating={minRating}
        onMinRatingChange={(val) => updateSearchState({ minRating: val })}
        activeFilterCount={activeFilterCount}
        onResetFilters={resetFilters}
      />

      {/* Search Results Grid */}
      {shouldShowSearchResults ? (
        <MediaGridSection
          items={gridItems}
          viewMode={viewMode}
          isLoading={isSearching}
          showTypeBadge={contentFilter === 'all'}
          emptyMessage={t('home.noResults')}
        />
      ) : (
        /* Popular Discovery Carousels */
        <div className="space-y-10">
          {showMovies && (
            <MediaCarouselSection
              title={t('home.popularMovies')}
              items={recommendedMovies}
              type="movie"
              viewMode={viewMode}
              isLoading={isLoadingInitial}
              emptyMessage={t('home.noMoviesMatch')}
              onScrollThreshold={(container) => handleCarouselScroll('movie', container)}
            />
          )}

          {showSeries && (
            <MediaCarouselSection
              title={t('home.popularSeries')}
              items={recommendedSeries}
              type="series"
              viewMode={viewMode}
              isLoading={isLoadingInitial}
              emptyMessage={t('home.noSeriesMatch')}
              onScrollThreshold={(container) => handleCarouselScroll('series', container)}
            />
          )}
        </div>
      )}
    </div>
  );
}
