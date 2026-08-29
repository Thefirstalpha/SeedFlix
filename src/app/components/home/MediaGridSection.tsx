import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { MediaCard, MediaCardData } from '../MediaCard';
import { MediaListItem } from '../MediaListItem';
import { MediaCardSkeleton } from '../MediaCardSkeleton';
import { MediaListItemSkeleton } from '../MediaListItemSkeleton';

export interface GridMediaItem {
  type: 'movie' | 'series';
  data: MediaCardData;
}

interface MediaGridSectionProps {
  title?: string;
  items: GridMediaItem[];
  viewMode: 'card' | 'list';
  isLoading?: boolean;
  emptyMessage?: string;
  showTypeBadge?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

export function MediaGridSection({
  title,
  items,
  viewMode,
  isLoading = false,
  emptyMessage = 'Aucun résultat trouvé',
  showTypeBadge = false,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}: Readonly<MediaGridSectionProps>) {
  return (
    <section className="space-y-4">
      {title && <h3 className="text-2xl font-semibold text-white">{title}</h3>}

      {isLoading ? (
        viewMode === 'card' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {[...new Array(12)].map((_, i) => (
              <MediaCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {[...new Array(6)].map((_, i) => (
              <MediaListItemSkeleton key={i} />
            ))}
          </div>
        )
      ) : items.length > 0 ? (
        <>
          {viewMode === 'card' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {items.map((item) => (
                <MediaCard
                  key={`${item.type}-${item.data.id}`}
                  item={item.data}
                  type={item.type}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <MediaListItem
                  key={`${item.type}-${item.data.id}`}
                  item={item.data}
                  type={item.type}
                  showTypeBadge={showTypeBadge}
                />
              ))}
            </div>
          )}

          {hasMore && onLoadMore && (
            <div className="flex justify-center pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="px-6 border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  'Charger plus de résultats'
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-white/60 py-6 text-center">{emptyMessage}</p>
      )}
    </section>
  );
}

