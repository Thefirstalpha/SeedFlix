import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useI18n, Translator } from '../../i18n/LanguageProvider';

interface GenreOption {
  id: number;
  name: string;
}

interface HomeFiltersModalProps {
  isOpen: boolean;
  genreFilter: string;
  onGenreChange: (genre: string) => void;
  availableGenres: GenreOption[];
  languageFilter: string;
  onLanguageChange: (lang: string) => void;
  availableLanguages: string[];
  getLanguageLabel: (lang: string, t: Translator) => string;
  yearFrom: string;
  onYearFromChange: (val: string) => void;
  yearTo: string;
  onYearToChange: (val: string) => void;
  minRating: string;
  onMinRatingChange: (val: string) => void;
  activeFilterCount: number;
  onResetFilters: () => void;
}

export function HomeFiltersModal({
  isOpen,
  genreFilter,
  onGenreChange,
  availableGenres,
  languageFilter,
  onLanguageChange,
  availableLanguages,
  getLanguageLabel,
  yearFrom,
  onYearFromChange,
  yearTo,
  onYearToChange,
  minRating,
  onMinRatingChange,
  activeFilterCount,
  onResetFilters,
}: Readonly<HomeFiltersModalProps>) {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4 animate-in fade-in-50 duration-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Genre Filter */}
        <div className="space-y-1.5">
          <label htmlFor="home-filter-genre" className="text-xs font-medium text-white/60">
            {t('home.genreLabel')}
          </label>
          <select
            id="home-filter-genre"
            value={genreFilter}
            onChange={(e) => onGenreChange(e.target.value)}
            className="h-10 w-full rounded-md border border-white/20 bg-slate-900 px-3 text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="all">{t('home.allGenres')}</option>
            {availableGenres.map((genre) => (
              <option key={genre.id} value={genre.name}>
                {genre.name}
              </option>
            ))}
          </select>
        </div>

        {/* Language Filter */}
        <div className="space-y-1.5">
          <label htmlFor="home-filter-language" className="text-xs font-medium text-white/60">
            {t('home.languageLabel')}
          </label>
          <select
            id="home-filter-language"
            value={languageFilter}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="h-10 w-full rounded-md border border-white/20 bg-slate-900 px-3 text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="all">{t('home.allLanguages')}</option>
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {getLanguageLabel(lang, t)}
              </option>
            ))}
          </select>
        </div>

        {/* Year Range Filter */}
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
              onChange={(e) => onYearFromChange(e.target.value)}
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
              onChange={(e) => onYearToChange(e.target.value)}
              className="h-10 bg-slate-900 border-white/20 text-white"
            />
          </div>
        </div>

        {/* Rating Filter */}
        <div className="space-y-1.5">
          <label htmlFor="home-filter-rating" className="text-xs font-medium text-white/60">
            {t('home.ratingLabel')}
          </label>
          <select
            id="home-filter-rating"
            value={minRating}
            onChange={(e) => onMinRatingChange(e.target.value)}
            className="h-10 w-full rounded-md border border-white/20 bg-slate-900 px-3 text-white focus:border-purple-500 focus:outline-none"
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
        <div className="flex justify-end pt-2 border-t border-white/10">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onResetFilters}
            className="text-white/60 hover:text-white hover:bg-white/10 gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            {t('home.resetFilters')}
          </Button>
        </div>
      )}
    </div>
  );
}

