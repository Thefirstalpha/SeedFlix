import {
  Calendar,
  Download,
  FolderArchive,
  Loader2,
  Tv,
  X,
} from 'lucide-react';
import { IndexerMovieResult, IndexerSeriesResult } from '../../../common/indexer';
import { getItemEpisode, getItemSeason } from '../services/indexerGrouping';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useI18n } from '../i18n/LanguageProvider';

export interface IndexerReleaseItemLabels {
  addToClient?: string;
  adding?: string;
  reject?: string;
  rejecting?: string;
  packBadge?: string;
  episodeBadge?: (episode: number) => string;
}

export interface IndexerReleaseItemProps {
  item: IndexerMovieResult | IndexerSeriesResult;
  type: 'movie' | 'series';
  locale?: string;
  isAdding?: boolean;
  isRejecting?: boolean;
  onAddTorrent: (item: IndexerMovieResult | IndexerSeriesResult) => void;
  onReject?: (item: IndexerMovieResult | IndexerSeriesResult) => void;
  labels?: IndexerReleaseItemLabels;
}

export function IndexerReleaseItem({
  item,
  type,
  locale = 'fr-FR',
  isAdding = false,
  isRejecting = false,
  onAddTorrent,
  onReject,
  labels,
}: Readonly<IndexerReleaseItemProps>) {
  const { t } = useI18n();
  const seriesItem = type === 'series' ? (item as IndexerSeriesResult) : null;
  const season = seriesItem ? getItemSeason(seriesItem) : null;
  const episode = seriesItem ? getItemEpisode(seriesItem) : null;
  const isPack = seriesItem && season !== null && episode === null;

  return (
    <div
      className="h-[60px] min-h-[60px] max-h-[60px] px-2.5 sm:px-3 py-1.5 rounded-lg border border-white/10 bg-slate-900/50 hover:bg-slate-900/80 transition-colors flex items-center justify-between gap-2 sm:gap-3 w-full min-w-0 max-w-full overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      role="presentation"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
      }}
    >
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 overflow-hidden">
        <p
          className="text-xs sm:text-sm text-white font-medium truncate leading-tight"
          title={item.title}
        >
          {item.title}
        </p>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 whitespace-nowrap min-w-0 max-w-full">
          {isPack && (
            <Badge className="bg-purple-600/20 text-purple-300 border-purple-500/40 text-[11px] px-1.5 py-0.5 whitespace-nowrap shrink-0 flex items-center">
              <FolderArchive className="w-3 h-3 mr-1 inline shrink-0" />
              <span className="hidden sm:inline">{labels?.packBadge || 'Pack saison'}</span>
              <span className="sm:hidden">Pack</span>
            </Badge>
          )}

          {episode !== null && (
            <Badge className="bg-cyan-600/20 text-cyan-200 border-cyan-500/40 text-[11px] px-1.5 py-0.5 whitespace-nowrap shrink-0 flex items-center">
              <Tv className="w-3 h-3 mr-1 inline shrink-0" />
              <span>
                {season !== null
                  ? `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
                  : labels?.episodeBadge
                    ? labels.episodeBadge(episode)
                    : `E${String(episode).padStart(2, '0')}`}
              </span>
            </Badge>
          )}

          {item.quality ? (
            <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 text-[11px] px-1.5 py-0.5 whitespace-nowrap shrink-0">
              {item.quality}
            </Badge>
          ) : null}

          {item.language ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[11px] px-1.5 py-0.5 whitespace-nowrap shrink-0">
              {item.language}
            </Badge>
          ) : null}

          {item.sizeHuman ? (
            <Badge variant="outline" className="border-white/30 text-white/80 text-[11px] px-1.5 py-0.5 whitespace-nowrap shrink-0" title={`Taille: ${item.sizeHuman}`}>
              <span className="hidden md:inline">{t('movieDetails.indexer.size')}</span>
              <span>{item.sizeHuman}</span>
            </Badge>
          ) : null}

          {item.pubDate ? (
            <Badge variant="outline" className="border-blue-500/40 text-blue-300 text-[11px] px-1.5 py-0.5 whitespace-nowrap shrink-0">
              <Calendar className="w-3 h-3 mr-1 inline shrink-0" />
              <span>{new Date(item.pubDate).toLocaleDateString(locale)}</span>
            </Badge>
          ) : null}

          {Number.isFinite(item.seeders || Number.NaN) && (item.seeders || 0) >= 0 ? (
            <Badge variant="outline" className="border-lime-500/40 text-lime-300 text-[11px] px-1.5 py-0.5 whitespace-nowrap shrink-0" title={`Seeders: ${item.seeders}`}>
              <span className="hidden md:inline">Seeders: </span>
              <span className="md:hidden font-bold">↑ </span>
              <span>{item.seeders}</span>
            </Badge>
          ) : null}

          {Number.isFinite(item.leechers || Number.NaN) && (item.leechers || 0) >= 0 ? (
            <Badge variant="outline" className="border-orange-500/40 text-orange-300 text-[11px] px-1.5 py-0.5 whitespace-nowrap shrink-0" title={`Peers: ${item.leechers}`}>
              <span className="hidden md:inline">Peers: </span>
              <span className="md:hidden font-bold">↓ </span>
              <span>{item.leechers}</span>
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onAddTorrent(item);
          }}
          disabled={isAdding}
          className="h-8 px-2 sm:px-3 bg-cyan-600 hover:bg-cyan-700 text-white shrink-0 flex items-center justify-center text-xs"
          title={labels?.addToClient || 'Télécharger'}
          aria-label={labels?.addToClient || 'Télécharger'}
        >
          {isAdding ? (
            <>
              <Loader2 className="w-3.5 h-3.5 sm:mr-1.5 animate-spin shrink-0" />
              <span className="hidden sm:inline">{labels?.adding || 'Ajout...'}</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 sm:mr-1.5 shrink-0" />
              <span className="hidden sm:inline">{labels?.addToClient || 'Télécharger'}</span>
            </>
          )}
        </Button>

        {onReject && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onReject(item);
            }}
            disabled={isRejecting}
            className="h-8 px-2 sm:px-3 border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100 shrink-0 flex items-center justify-center text-xs"
            title={labels?.reject || 'Rejeter'}
            aria-label={labels?.reject || 'Rejeter'}
          >
            {isRejecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 sm:mr-1.5 animate-spin shrink-0" />
                <span className="hidden sm:inline">{labels?.rejecting || 'Rejet...'}</span>
              </>
            ) : (
              <>
                <X className="w-3.5 h-3.5 sm:mr-1 shrink-0" />
                <span className="hidden sm:inline">{labels?.reject || 'Rejeter'}</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

