import { Calendar, Star, Tv } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';

export interface MediaCardData {
  id: number;
  title: string;
  year: number;
  rating: number;
  genre: string;
  poster: string;
}

interface MediaCardProps {
  item: MediaCardData;
  type: 'movie' | 'series';
}

export function MediaCard({ item, type }: Readonly<MediaCardProps>) {
  const isSeries = type === 'series';
  const link = isSeries ? `/series/${item.id}` : `/movie/${item.id}`;
  const gradientClass = isSeries
    ? 'from-cyan-900/20 to-slate-900/20'
    : 'from-purple-900/20 to-slate-900/20';
  const badgeClass = isSeries
    ? 'bg-cyan-600/20 text-cyan-200 border-cyan-500/30'
    : 'bg-purple-600/20 text-purple-300 border-purple-500/30';

  return (
    <Link to={link}>
      <Card className="overflow-hidden bg-white/5 border-white/10 hover:bg-white/10 transition-all hover:scale-105 group cursor-pointer gap-0">
        <div className={`aspect-[2/3] overflow-hidden bg-gradient-to-br ${gradientClass}`}>
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        </div>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-white line-clamp-1">{item.title}</h3>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Calendar className="w-4 h-4" />
            <span>{item.year > 0 ? item.year : 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
              <span className="font-semibold text-white">{item.rating}</span>
            </div>
            <Badge variant="secondary" className={badgeClass}>
              {isSeries && <Tv className="w-3 h-3 mr-1 inline" />}
              {item.genre}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

