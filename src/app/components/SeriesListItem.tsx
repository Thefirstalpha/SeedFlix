import { MediaListItem } from './MediaListItem';
import type { Series } from '../types/series';

interface SeriesListItemProps {
  series: Series;
  showTypeBadge?: boolean;
}

export function SeriesListItem({ series, showTypeBadge }: Readonly<SeriesListItemProps>) {
  return <MediaListItem item={series} type="series" showTypeBadge={showTypeBadge} />;
}
