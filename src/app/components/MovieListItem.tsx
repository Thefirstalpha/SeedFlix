import { Calendar, Star } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import type { Movie } from '../types/movie';
import { useI18n } from '../i18n/LanguageProvider';

interface MovieListItemProps {
  movie: Movie;
  showTypeBadge?: boolean;
}

export function MovieListItem({ movie, showTypeBadge }: Readonly<MovieListItemProps>) {
  const { t } = useI18n();

  return (
    <Link to={`/movie/${movie.id}`} className="block group">
      <Card className="overflow-hidden bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer">
        <CardContent className="p-3 sm:p-4 flex gap-4 items-start">
          <div className="w-16 sm:w-20 md:w-24 aspect-[2/3] overflow-hidden rounded-lg bg-gradient-to-br from-purple-900/20 to-slate-900/20 shrink-0">
            <img
              src={movie.poster}
              alt={movie.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
              <h3 className="font-semibold text-white text-base sm:text-lg group-hover:text-purple-300 transition-colors line-clamp-1">
                {movie.title}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                {showTypeBadge && (
                  <Badge variant="outline" className="border-purple-500/50 text-purple-300 bg-purple-900/20 text-xs">
                    {t('home.movieBadge')}
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className="bg-purple-600/20 text-purple-300 border-purple-500/30 text-xs"
                >
                  {movie.genre}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs sm:text-sm text-white/60">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{movie.year > 0 ? movie.year : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-yellow-500 text-yellow-500" />
                <span className="font-semibold text-white">{movie.rating}</span>
              </div>
            </div>

            {movie.plot && (
              <p className="text-xs sm:text-sm text-white/70 line-clamp-2 sm:line-clamp-3">
                {movie.plot}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

