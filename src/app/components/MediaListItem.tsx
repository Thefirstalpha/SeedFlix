import { Calendar, Star, Tv } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { useI18n } from '../i18n/LanguageProvider';

export interface MediaListItemData {
  id: number;
  title: string;
  year: number;
  rating: number;
  genre: string;
  poster: string;
  plot?: string;
}

interface MediaListItemProps {
  item: MediaListItemData;
  type: 'movie' | 'series';
  showTypeBadge?: boolean;
}

export function MediaListItem({ item, type, showTypeBadge }: Readonly<MediaListItemProps>) {
  const { t } = useI18n();
  const isSeries = type === 'series';
  const link = isSeries ? `/series/${item.id}` : `/movie/${item.id}`;
  const gradientClass = isSeries
    ? 'from-cyan-900/20 to-slate-900/20'
    : 'from-purple-900/20 to-slate-900/20';
  const hoverTextClass = isSeries ? 'group-hover:text-cyan-300' : 'group-hover:text-purple-300';
  const typeBadgeClass = isSeries
    ? 'border-cyan-500/50 text-cyan-300 bg-cyan-900/20 text-xs'
    : 'border-purple-500/50 text-purple-300 bg-purple-900/20 text-xs';
  const genreBadgeClass = isSeries
    ? 'bg-cyan-600/20 text-cyan-200 border-cyan-500/30 text-xs'
    : 'bg-purple-600/20 text-purple-300 border-purple-500/30 text-xs';

  return (
    <Link to={link} className="block group">
      <Card className="overflow-hidden bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer">
        <CardContent className="p-3 sm:p-4 flex gap-4 items-start [&:last-child]:pb-3 [&:last-child]:sm:pb-4">
          <div
            className={`w-16 sm:w-20 md:w-24 aspect-[2/3] overflow-hidden rounded-lg bg-gradient-to-br ${gradientClass} shrink-0`}
          >
            <img
              src={item.poster}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
              <h3
                className={`font-semibold text-white text-base sm:text-lg ${hoverTextClass} transition-colors line-clamp-1`}
              >
                {item.title}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                {showTypeBadge && (
                  <Badge variant="outline" className={typeBadgeClass}>
                    {isSeries ? t('home.seriesBadge') : t('home.movieBadge')}
                  </Badge>
                )}
                <Badge variant="secondary" className={genreBadgeClass}>
                  {isSeries && <Tv className="w-3 h-3 mr-1 inline" />}
                  {item.genre}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs sm:text-sm text-white/60">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{item.year > 0 ? item.year : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-yellow-500 text-yellow-500" />
                <span className="font-semibold text-white">{item.rating}</span>
              </div>
            </div>

            {item.plot && (
              <p className="text-xs sm:text-sm text-white/70 line-clamp-2 sm:line-clamp-3">
                {item.plot}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

