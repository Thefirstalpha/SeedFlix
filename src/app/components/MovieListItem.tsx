import { MediaListItem } from './MediaListItem';
import type { Movie } from '../types/movie';

interface MovieListItemProps {
  movie: Movie;
  showTypeBadge?: boolean;
}

export function MovieListItem({ movie, showTypeBadge }: Readonly<MovieListItemProps>) {
  return <MediaListItem item={movie} type="movie" showTypeBadge={showTypeBadge} />;
}
