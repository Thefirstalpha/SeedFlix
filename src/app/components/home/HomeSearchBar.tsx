import React, { useRef, useEffect } from 'react';
import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useI18n } from '../../i18n/LanguageProvider';

interface HomeSearchBarProps {
  query: string;
  onQueryChange: (val: string) => void;
  onClearQuery: () => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  contentFilter: 'all' | 'movie' | 'series';
  onContentFilterChange: (filter: 'all' | 'movie' | 'series') => void;
  viewMode: 'card' | 'list';
  onViewModeChange: (mode: 'card' | 'list') => void;
}

export function HomeSearchBar({
  query,
  onQueryChange,
  onClearQuery,
  filtersOpen,
  onToggleFilters,
  activeFilterCount,
  contentFilter,
  onContentFilterChange,
  viewMode,
  onViewModeChange,
}: Readonly<HomeSearchBarProps>) {
  const { t } = useI18n();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Global Keyboard shortcuts: Ctrl+K, Cmd+K, or / to focus search; Escape to blur/close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;

      // "/" key when not in an input
      if (e.key === '/' && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // "Ctrl + K" or "Cmd + K"
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // "Escape" key
      if (e.key === 'Escape') {
        if (filtersOpen) {
          onToggleFilters();
        } else if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtersOpen, onToggleFilters]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={t('home.searchPlaceholder')}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="pl-11 pr-20 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:bg-white/10 transition-colors text-base"
          />

          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {query && (
              <button
                type="button"
                onClick={onClearQuery}
                className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                title={t('home.clearSearch') || 'Effacer'}
                aria-label={t('home.clearSearch') || 'Effacer'}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-medium text-white/40 bg-white/10 border border-white/15 rounded">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>

        <Button
          type="button"
          onClick={onToggleFilters}
          variant="outline"
          className={`h-12 px-4 border-white/10 bg-white/5 text-white hover:bg-white/10 gap-2 shrink-0 ${
            filtersOpen || activeFilterCount > 0 ? 'border-purple-500/50 bg-purple-500/10' : ''
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">{t('home.filters')}</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-purple-600 text-[11px] font-medium flex items-center justify-center text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1 flex-1">
          <Button
            size="sm"
            onClick={() => onContentFilterChange('all')}
            className={`flex-1 ${
              contentFilter === 'all'
                ? 'bg-white text-slate-900 hover:bg-white/90 font-medium'
                : 'bg-transparent text-white hover:bg-white/10'
            }`}
          >
            {t('home.all')}
          </Button>
          <Button
            size="sm"
            onClick={() => onContentFilterChange('movie')}
            className={`flex-1 ${
              contentFilter === 'movie'
                ? 'bg-purple-600 text-white hover:bg-purple-700 font-medium'
                : 'bg-transparent text-white hover:bg-white/10'
            }`}
          >
            {t('home.movies')}
          </Button>
          <Button
            size="sm"
            onClick={() => onContentFilterChange('series')}
            className={`flex-1 ${
              contentFilter === 'series'
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
            onClick={() => onViewModeChange('card')}
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
            onClick={() => onViewModeChange('list')}
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
  );
}

