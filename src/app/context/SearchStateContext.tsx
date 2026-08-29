import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Movie } from '../types/movie';
import type { Series } from '../types/series';
import type { MultiSearchResultItem } from '../services/tmdbService';

interface SearchState {
  query: string;
  debouncedQuery: string;
  activeSearchQuery: string;
  popularCacheKey: string;
  contentFilter: 'all' | 'movie' | 'series';
  viewMode: 'card' | 'list';
  genreFilter: string;
  languageFilter: string;
  yearFrom: string;
  yearTo: string;
  minRating: string;
  filtersOpen: boolean;

  // Mixed multi search results
  searchMultiItems: MultiSearchResultItem[];

  // Movie state
  movieGenres: Array<{ id: number; name: string }>;
  recommendedMovies: Movie[];
  searchMovies: Movie[];
  moviePage: number;
  movieTotalPages: number;

  // Series state
  seriesGenres: Array<{ id: number; name: string }>;
  recommendedSeries: Series[];
  searchSeries: Series[];
  seriesPage: number;
  seriesTotalPages: number;

  // Loading states
  isLoadingInitial: boolean;
  isLoadingMoreMovies: boolean;
  isLoadingMoreSeries: boolean;
  isSearching: boolean;
  isLoadingGenres: boolean;

  // Scroll positions
  movieCarouselScrollLeft: number;
  seriesCarouselScrollLeft: number;
}

interface SearchStateContextValue {
  state: SearchState;
  updateSearchState: (
    updates: Partial<SearchState> | ((_prev: SearchState) => Partial<SearchState>),
  ) => void;
  resetSearchState: () => void;
}

const DEFAULT_SEARCH_STATE: SearchState = {
  query: '',
  debouncedQuery: '',
  activeSearchQuery: '',
  popularCacheKey: '',
  contentFilter: 'all',
  viewMode: 'card',
  genreFilter: 'all',
  languageFilter: 'all',
  yearFrom: '',
  yearTo: '',
  minRating: '0',
  filtersOpen: false,

  searchMultiItems: [],

  movieGenres: [],
  recommendedMovies: [],
  searchMovies: [],
  moviePage: 1,
  movieTotalPages: 1,

  seriesGenres: [],
  recommendedSeries: [],
  searchSeries: [],
  seriesPage: 1,
  seriesTotalPages: 1,

  isLoadingInitial: true,
  isLoadingMoreMovies: false,
  isLoadingMoreSeries: false,
  isSearching: false,
  isLoadingGenres: true,

  movieCarouselScrollLeft: 0,
  seriesCarouselScrollLeft: 0,
};

interface PersistedSearchPreferences {
  contentFilter: 'all' | 'movie' | 'series';
  viewMode: 'card' | 'list';
  genreFilter: string;
  languageFilter: string;
  yearFrom: string;
  yearTo: string;
  minRating: string;
}

const SEARCH_PREFERENCES_KEY = 'seedflix_search_preferences';

const SearchStateContext = createContext<SearchStateContextValue | undefined>(undefined);

export function SearchStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SearchState>(DEFAULT_SEARCH_STATE);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SEARCH_PREFERENCES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PersistedSearchPreferences>;
        setState((prev) => ({
          ...prev,
          ...(parsed.contentFilter ? { contentFilter: parsed.contentFilter } : {}),
          ...(parsed.viewMode ? { viewMode: parsed.viewMode } : {}),
          ...(parsed.genreFilter !== undefined ? { genreFilter: parsed.genreFilter } : {}),
          ...(parsed.languageFilter !== undefined ? { languageFilter: parsed.languageFilter } : {}),
          ...(parsed.yearFrom !== undefined ? { yearFrom: parsed.yearFrom } : {}),
          ...(parsed.yearTo !== undefined ? { yearTo: parsed.yearTo } : {}),
          ...(parsed.minRating !== undefined ? { minRating: parsed.minRating } : {}),
        }));
      }
    } catch (error) {
      console.error('Error loading search preferences from localStorage:', error);
    }
  }, []);

  // Save only lightweight preferences to localStorage whenever relevant fields change
  useEffect(() => {
    try {
      const preferences: PersistedSearchPreferences = {
        contentFilter: state.contentFilter,
        viewMode: state.viewMode,
        genreFilter: state.genreFilter,
        languageFilter: state.languageFilter,
        yearFrom: state.yearFrom,
        yearTo: state.yearTo,
        minRating: state.minRating,
      };
      localStorage.setItem(SEARCH_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving search preferences to localStorage:', error);
    }
  }, [
    state.contentFilter,
    state.viewMode,
    state.genreFilter,
    state.languageFilter,
    state.yearFrom,
    state.yearTo,
    state.minRating,
  ]);

  const updateSearchState = useCallback(
    (updates: Partial<SearchState> | ((prev: SearchState) => Partial<SearchState>)) => {
      setState((prev) => {
        const nextUpdates = typeof updates === 'function' ? updates(prev) : updates;
        return { ...prev, ...nextUpdates };
      });
    },
    [],
  );

  const resetSearchState = () => {
    setState(DEFAULT_SEARCH_STATE);
    localStorage.removeItem(SEARCH_PREFERENCES_KEY);
  };

  return (
    <SearchStateContext.Provider
      value={{
        state,
        updateSearchState,
        resetSearchState,
      }}
    >
      {children}
    </SearchStateContext.Provider>
  );
}

export function useSearchState() {
  const context = useContext(SearchStateContext);
  if (context === undefined) {
    throw new Error('useSearchState must be used within a SearchStateProvider');
  }
  return context;
}
