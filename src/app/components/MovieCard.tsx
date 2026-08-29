import { MediaCard } from './MediaCard';
import type { Movie } from '../types/movie';

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: Readonly<MovieCardProps>) {
  return <MediaCard item={movie} type="movie" />;
}
