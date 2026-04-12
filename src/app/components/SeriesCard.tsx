import { Tv, Star, Calendar } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import type { Series } from '../types/series';

interface SeriesCardProps {
  series: Series;
}

export function SeriesCard({ series }: SeriesCardProps) {
  return (
    <Link to={`/series/${series.id}`}>
      <Card className="overflow-hidden bg-white/5 border-white/10 hover:bg-white/10 transition-all hover:scale-105 group">
        <div className="aspect-[2/3] overflow-hidden bg-gradient-to-br from-cyan-900/20 to-slate-900/20">
          <img
            src={series.poster}
            alt={series.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        </div>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-white line-clamp-1">{series.title}</h3>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Calendar className="w-4 h-4" />
            <span>{series.year}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
              <span className="font-semibold text-white">{series.rating}</span>
            </div>
            <Badge variant="secondary" className="bg-cyan-600/20 text-cyan-200 border-cyan-500/30">
              <Tv className="w-3 h-3 mr-1" />
              {series.genre}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
