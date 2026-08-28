import { Calendar, Star, Tv } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import type { Series } from '../types/series';
import { useI18n } from '../i18n/LanguageProvider';

interface SeriesListItemProps {
  series: Series;
  showTypeBadge?: boolean;
}

export function SeriesListItem({ series, showTypeBadge }: Readonly<SeriesListItemProps>) {
  const { t } = useI18n();

  return (
    <Link to={`/series/${series.id}`} className="block group">
      <Card className="overflow-hidden bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer">
        <CardContent className="p-3 sm:p-4 flex gap-4 items-start [&:last-child]:pb-3 [&:last-child]:sm:pb-4">
          <div className="w-16 sm:w-20 md:w-24 aspect-[2/3] overflow-hidden rounded-lg bg-gradient-to-br from-cyan-900/20 to-slate-900/20 shrink-0">
            <img
              src={series.poster}
              alt={series.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
              <h3 className="font-semibold text-white text-base sm:text-lg group-hover:text-cyan-300 transition-colors line-clamp-1">
                {series.title}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                {showTypeBadge && (
                  <Badge variant="outline" className="border-cyan-500/50 text-cyan-300 bg-cyan-900/20 text-xs">
                    {t('home.seriesBadge')}
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className="bg-cyan-600/20 text-cyan-200 border-cyan-500/30 text-xs"
                >
                  <Tv className="w-3 h-3 mr-1 inline" />
                  {series.genre}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs sm:text-sm text-white/60">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{series.year > 0 ? series.year : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-yellow-500 text-yellow-500" />
                <span className="font-semibold text-white">{series.rating}</span>
              </div>
            </div>

            {series.plot && (
              <p className="text-xs sm:text-sm text-white/70 line-clamp-2 sm:line-clamp-3">
                {series.plot}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

