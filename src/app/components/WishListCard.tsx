import { Calendar, Star } from 'lucide-react';
import { ReactNode } from 'react';
import { IndexerMovieResult, IndexerSeriesResult } from '../../../common/indexer';
import { useI18n } from '../i18n/LanguageProvider';
import { IndexerResultsList } from './IndexerResultsList';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';

interface WishListCardProps {
  poster: string;
  title: string;
  year: number;
  rating: number;
  genre: string;
  type: 'movie' | 'series';
  targets: (IndexerMovieResult | IndexerSeriesResult)[];
  actionKey: string | null;
  onRejectIndexerResult: (target: IndexerMovieResult | IndexerSeriesResult) => void;
  onRejectAllIndexerResults: (targets: (IndexerMovieResult | IndexerSeriesResult)[]) => void;
  onAddTorrent: (target: IndexerMovieResult | IndexerSeriesResult) => void;
  children?: ReactNode;
}

export const getEpisodeCode = (
  targetKey: string,
  fallbackSeason?: number | null,
  fallbackEpisode?: number | null,
) => {
  const match = new RegExp(/^episode:\d+:(\d+):(\d+)$/i).exec(String(targetKey || ''));
  const season = match?.[1] ? Number(match[1]) : Number(fallbackSeason || 0);
  const episode = match?.[2] ? Number(match[2]) : Number(fallbackEpisode || 0);
  if (!Number.isFinite(season) || !Number.isFinite(episode) || season <= 0 || episode <= 0) {
    return '';
  }
  return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
};

export function WishListCard({
  poster,
  title,
  year,
  rating,
  genre,
  type,
  targets,
  actionKey,
  onRejectIndexerResult,
  onRejectAllIndexerResults,
  onAddTorrent,
  children,
}: Readonly<WishListCardProps>) {
  const { language } = useI18n();
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const groupKey = targets[0]?.tmdbId ?? type;

  return (
    <Card className="border-white/10 bg-white/5 transition-all w-full min-w-0 overflow-hidden" id={`wishlist-target-${groupKey}`}>
      <CardContent className="p-4 space-y-4 min-w-0">
        <div className="flex items-start gap-4 min-w-0">
          <img src={poster} alt={title} className="w-16 rounded object-cover aspect-[2/3] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-lg hover:text-cyan-300 transition-colors truncate">
              {title}
            </p>
            <div className="flex items-center gap-3 text-white/60 text-sm mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {year}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                <span className="font-semibold text-white">{rating}</span>
              </span>
            </div>
            <div className="mt-2">
              <Badge
                className={
                  type === 'series'
                    ? 'bg-cyan-600/20 text-cyan-200 border-cyan-500/30'
                    : 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                }
              >
                {genre}
              </Badge>
            </div>
          </div>
        </div>
        {children}

        {targets.length > 0 ? (
          <div
            className="pt-2 border-t border-white/10 w-full min-w-0"
          >
            <IndexerResultsList
              items={targets}
              type={type}
              locale={locale}
              actionKey={actionKey}
              onAddTorrent={onAddTorrent}
              onRejectIndexerResult={onRejectIndexerResult}
              onRejectAllIndexerResults={onRejectAllIndexerResults}
              showRejectAll={true}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
