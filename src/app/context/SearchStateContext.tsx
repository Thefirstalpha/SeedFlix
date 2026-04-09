import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Movie } from "../types/movie";
import type { Series } from "../types/series";

interface SearchState {
  query: string;
  debouncedQuery: string;
  activeSearchQuery: string;
  contentFilter: "all" | "movie" | "series";
  genreFilter: string;
  languageFilter: string;
  yearFrom: string;
  yearTo: string;
  minRating: string;
  filtersOpen: boolean;

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
  updateSearchState: (updates: Partial<SearchState> | ((prev: SearchState) => Partial<SearchState>)) => void;
  resetSearchState: () => void;
}

const DEFAULT_SEARCH_STATE: SearchState = {
  query: "",
  debouncedQuery: "",
  activeSearchQuery: "",
  contentFilter: "all",
  genreFilter: "all",
  languageFilter: "all",
  yearFrom: "",
  yearTo: "",
  minRating: "0",
  filtersOpen: false,

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

const SearchStateContext = createContext<SearchStateContextValue | undefined>(
  undefined
);

export function SearchStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SearchState>(DEFAULT_SEARCH_STATE);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("searchState");
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SearchState>;
        setState((prev) => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error("Error loading search state from localStorage:", error);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("searchState", JSON.stringify(state));
    } catch (error) {
      console.error("Error saving search state to localStorage:", error);
    }
  }, [state]);

  const updateSearchState = useCallback((updates: Partial<SearchState> | ((prev: SearchState) => Partial<SearchState>)) => {
    setState((prev) => {
      const nextUpdates = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...nextUpdates };
    });
  }, []);

  const resetSearchState = () => {
    setState(DEFAULT_SEARCH_STATE);
    localStorage.removeItem("searchState");
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
    throw new Error(
      "useSearchState must be used within a SearchStateProvider"
    );
  }
  return context;
}
