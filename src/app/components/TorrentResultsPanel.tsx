import { Calendar, Download, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { addTorrentToClient } from '../services/torrentService';
import { IndexerMovieResult, IndexerSeriesResult } from '../../../common/indexer';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/LanguageProvider';

export interface TorrentReleaseItem {
  title: string;
  link: string;
  downloadUrl?: string;
  guid?: string;
  pubDate?: string;
  size?: number | null;
  sizeBytes?: number | null;
  sizeHuman?: string | null;
  seeders?: number | null;
  leechers?: number | null;
  quality?: string | null;
  language?: string | null;
  categories?: string[];
}

export type TorrentResultsLabels = {
  quality: string;
  language: string;
  all: string;
  sort: string;
  date: string;
  size: string;
  season?: string;
  searching: string;
  empty: string;
  adding: string;
  addToClient: string;
  qualityBadge: (value: string) => string;
  languageBadge: (value: string) => string;
  sizeBadge: (value: string) => string;
  seeders: (count: number) => string;
  peers: (count: number) => string;
  categories: (value: string) => string;
  previous: string;
  current: (current: number, total: number) => string;
  page: (page: number) => string;
  next: string;
  sortByDateAria: string;
  sortBySizeAria: string;
};

export interface FilterOption {
  quality?: string;
  language?: string;
  season?: string;
  sortBy: 'size' | 'date';
  sortOrder: 'asc' | 'desc';
}

interface TorrentResultsPanelProps {
  title: string;
  description?: string;
  type: 'movie' | 'series';
  filter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  availableReleaseSeasons?: string[];
  availableReleaseLanguages: string[];
  isReleaseLoading: boolean;
  releaseError: string | null;
  filteredResults: IndexerMovieResult[] | IndexerSeriesResult[];
  locale: string;
  labels: TorrentResultsLabels;
}

const QUALITY_OPTIONS = ['2160p', '1080p', '720p', '480p', 'bluray', 'webdl', 'hdtv'];

export function TorrentResultsPanel({
  title,
  description,
  type,
  filter,
  onFilterChange,
  availableReleaseSeasons,
  availableReleaseLanguages,
  isReleaseLoading,
  releaseError,
  filteredResults,
  locale,
  labels,
}: TorrentResultsPanelProps) {

  const { t, language } = useI18n();
  const [addingTorrentLink, setAddingTorrentLink] = useState<string | null>(null);
  const [torrentStatus, setTorrentStatus] = useState<string | null>(null);
  const [torrentError, setTorrentError] = useState<string | null>(null);


  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;


  const handleAddTorrent = async (target: IndexerSeriesResult | IndexerMovieResult) => {
    setTorrentStatus(null);
    setTorrentError(null);

    try {
      const response = await addTorrentToClient(target.guid, type);
      setTorrentStatus(
        response.duplicate
          ? t('seriesDetails.messages.duplicateTorrent')
          : t('seriesDetails.messages.torrentAdded'),
      );
    } catch (error) {
      setTorrentError(
        error instanceof Error ? error.message : t('seriesDetails.errors.addTorrentFailed'),
      );
    } finally {
      setAddingTorrentLink(null);
    }
  };


  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const paginatedResults = filteredResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);


  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          {description ? <p className="text-sm text-white/60 mt-1">{description}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {availableReleaseSeasons ? (
            <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
              <label className="text-sm text-white/70 whitespace-nowrap font-medium">
                {labels.season}
              </label>
              <select
                value={filter.season || 'all'}
                onChange={(event) => onFilterChange({ ...filter, season: event.target.value })}
                className="max-w-full bg-slate-900 border border-white/20 text-white rounded-md px-3 py-2 text-sm"
              >
                <option value="all">{labels.all}</option>
                {availableReleaseSeasons.map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <label className="text-sm text-white/70 font-medium whitespace-nowrap">
              {labels.quality}
            </label>
            <select
              value={filter.quality || 'all'}
              onChange={(event) => onFilterChange({ ...filter, quality: event.target.value })}
              className="max-w-full bg-slate-900 border border-white/20 text-white rounded-md px-3 py-2 text-sm"
            >
              <option value="all">{labels.all}</option>
              {QUALITY_OPTIONS.map((quality) => (
                <option key={quality} value={quality}>
                  {quality === 'bluray'
                    ? 'BluRay'
                    : quality === 'webdl'
                      ? 'WEB-DL'
                      : quality.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <label className="text-sm text-white/70 font-medium whitespace-nowrap">
              {labels.language}
            </label>
            <select
              value={filter.language || 'all'}
              onChange={(event) => onFilterChange({ ...filter, language: event.target.value })}
              className="max-w-full bg-slate-900 border border-white/20 text-white rounded-md px-3 py-2 text-sm"
            >
              <option value="all">{labels.all}</option>
              {availableReleaseLanguages.map((itemLanguage) => (
                <option key={itemLanguage} value={itemLanguage}>
                  {itemLanguage}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <span className="text-sm text-white/70 font-medium">{labels.sort}</span>
            <ToggleGroup
              type="single"
              value={filter.sortBy}
              onValueChange={(value) => {
                if (value) {
                  onFilterChange({ ...filter, sortBy: value as 'size' | 'date' });
                }
              }}
              className="border border-white/20 rounded-md bg-slate-900/30"
            >
              <ToggleGroupItem
                value="date"
                aria-label={labels.sortByDateAria}
                className="text-sm data-[state=on]:bg-cyan-600 data-[state=on]:text-white hover:bg-white/10 data-[state=off]:text-white/60 data-[state=off]:hover:text-white/80"
              >
                {labels.date}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="size"
                aria-label={labels.sortBySizeAria}
                className="text-sm data-[state=on]:bg-cyan-600 data-[state=on]:text-white hover:bg-white/10 data-[state=off]:text-white/60 data-[state=off]:hover:text-white/80"
              >
                {labels.size}
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              size="sm"
              onClick={() => onFilterChange({ ...filter, sortOrder: filter.sortOrder === 'desc' ? 'asc' : 'desc' })}
              className="h-9 px-3 border border-white/20 text-white/80 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all"
            >
              {filter.sortOrder === 'desc' ? '↓' : '↑'}
            </Button>
          </div>
        </div>

        {isReleaseLoading ? <p className="text-sm text-white/60">{labels.searching}</p> : null}
        {releaseError ? <p className="text-sm text-red-300">{releaseError}</p> : null}
        {torrentStatus && !releaseError ? (
          <p className="text-sm text-emerald-300">{torrentStatus}</p>
        ) : null}
        {torrentError ? <p className="text-sm text-red-300">{torrentError}</p> : null}

        {!isReleaseLoading && !releaseError && filteredResults.length === 0 ? (
          <p className="text-sm text-white/60">{labels.empty}</p>
        ) : null}

        {filteredResults.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-3">
              {paginatedResults.map((item, index) => {
                const torrentLink = item.downloadUrl || item.link;
                return (
                  <div
                    key={item.guid || item.link || `${item.title}_${index}`}
                    className="rounded-lg border border-white/10 bg-slate-900/40 p-3 space-y-2"
                  >
                    <p className="text-white font-medium line-clamp-2 break-all">{item.title}</p>

                    <div className="flex flex-wrap gap-2 items-center">
                      <Button
                        size="sm"
                        onClick={async () => await handleAddTorrent(item)}
                        disabled={addingTorrentLink === torrentLink}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white w-full sm:w-auto"
                      >
                        {addingTorrentLink === torrentLink ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {labels.adding}
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            {labels.addToClient}
                          </>
                        )}
                      </Button>

                      {item.quality ? (
                        <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                          {labels.qualityBadge(item.quality)}
                        </Badge>
                      ) : null}

                      {item.language ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                          {labels.languageBadge(item.language)}
                        </Badge>
                      ) : null}

                      {item.sizeHuman ? (
                        <Badge variant="outline" className="border-white/30 text-white/80">
                          {labels.sizeBadge(item.sizeHuman)}
                        </Badge>
                      ) : null}

                      {item.pubDate ? (
                        <Badge variant="outline" className="border-blue-500/40 text-blue-300">
                          <Calendar className="w-3 h-3 mr-1 inline" />
                          {new Date(item.pubDate).toLocaleDateString(locale)}
                        </Badge>
                      ) : null}

                      {Number.isFinite(item.seeders || Number.NaN) && (item.seeders || 0) >= 0 ? (
                        <Badge variant="outline" className="border-lime-500/40 text-lime-300">
                          {labels.seeders(item.seeders || 0)}
                        </Badge>
                      ) : null}

                      {Number.isFinite(item.leechers || Number.NaN) && (item.leechers || 0) >= 0 ? (
                        <Badge variant="outline" className="border-orange-500/40 text-orange-300">
                          {labels.peers(item.leechers || 0)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
              >
                {labels.previous}
              </Button>

              <span className="text-sm text-white/80">
                {labels.current(currentPage, totalPages)}
              </span>

              <select
                value={currentPage}
                onChange={(event) => setCurrentPage(Number(event.target.value))}
                className="bg-slate-900 border border-white/20 text-white rounded-md px-2 py-1 text-sm"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <option key={page} value={page}>
                    {labels.page(page)}
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                {labels.next}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
