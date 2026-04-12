import { Star, Calendar } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import type { Movie } from '../types/movie';

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
  return (
    <Link to={`/movie/${movie.id}`}>
      <Card className="overflow-hidden bg-white/5 border-white/10 hover:bg-white/10 transition-all hover:scale-105 group cursor-pointer">
        <div className="aspect-[2/3] overflow-hidden bg-gradient-to-br from-purple-900/20 to-slate-900/20">
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        </div>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-white line-clamp-1">{movie.title}</h3>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Calendar className="w-4 h-4" />
            <span>{movie.year}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
              <span className="font-semibold text-white">{movie.rating}</span>
            </div>
            <Badge
              variant="secondary"
              className="bg-purple-600/20 text-purple-300 border-purple-500/30"
            >
              {movie.genre}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
