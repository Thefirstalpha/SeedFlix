import { Calendar, Heart, Star, Zap } from 'lucide-react';
import { ReactNode } from 'react';
import { IndexerMovieResult, IndexerSeriesResult } from '../../../common/indexer';
import { useI18n } from '../i18n/LanguageProvider';
import { IndexerResultsList } from './IndexerResultsList';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Switch } from './ui/switch';

interface WishListCardProps {
  poster: string;
  title: string;
  year: number;
  rating: number;
  genre: string;
  type: 'movie' | 'series';
  autoGrab?: boolean;
  onToggleAutoGrab?: (autoGrab: boolean) => void;
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
  autoGrab,
  onToggleAutoGrab,
  targets,
  actionKey,
  onRejectIndexerResult,
  onRejectAllIndexerResults,
  onAddTorrent,
  children,
}: Readonly<WishListCardProps>) {
  const { t, language } = useI18n();
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const groupKey = targets[0]?.tmdbId ?? type;

  return (
    <Card className="border-white/10 bg-white/5 transition-all w-full min-w-0 overflow-hidden" id={`wishlist-target-${groupKey}`}>
      <CardContent className="p-4 space-y-4 min-w-0">
        <div className="flex items-start gap-4 min-w-0 justify-between">
          <div className="flex items-start gap-4 min-w-0 flex-1">
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
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Badge
                  className={
                    type === 'series'
                      ? 'bg-cyan-600/20 text-cyan-200 border-cyan-500/30'
                      : 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                  }
                >
                  {genre}
                </Badge>
                {autoGrab ? (
                  <Badge
                    variant="outline"
                    title={t('wishlistPage.actions.autoGrabTooltip')}
                    className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 flex items-center gap-1 text-xs"
                  >
                    <Zap className="w-3 h-3 fill-emerald-400 text-emerald-400" />
                    {t('wishlistPage.actions.autoGrabOn')}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    title={t('wishlistPage.actions.classicTooltip')}
                    className="bg-white/5 text-white/60 border-white/10 flex items-center gap-1 text-xs"
                  >
                    <Heart className="w-3 h-3" />
                    {t('wishlistPage.actions.autoGrabOff')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {onToggleAutoGrab && (
            <div
              className="shrink-0 flex items-center gap-2 pl-2"
              onClick={(e) => e.stopPropagation()}
            >
              <label
                title={
                  autoGrab
                    ? t('wishlistPage.actions.autoGrabTooltip')
                    : t('wishlistPage.actions.classicTooltip')
                }
                className="text-xs text-white/60 cursor-pointer flex items-center gap-2 hover:text-white transition-colors bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10"
              >
                <span className="hidden sm:inline font-medium">
                  {t('wishlistPage.actions.toggleAutoGrab')}
                </span>
                <Switch
                  checked={Boolean(autoGrab)}
                  onCheckedChange={(checked) => onToggleAutoGrab(checked)}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </label>
            </div>
          )}
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
