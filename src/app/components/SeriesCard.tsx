import { MediaCard } from './MediaCard';
import type { Series } from '../types/series';

interface SeriesCardProps {
  series: Series;
}

export function SeriesCard({ series }: Readonly<SeriesCardProps>) {
  return <MediaCard item={series} type="series" />;
}
