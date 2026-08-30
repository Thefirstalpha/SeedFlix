import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { MediaCard, MediaCardData } from '../MediaCard';
import { MediaListItem } from '../MediaListItem';
import { MediaCardSkeleton } from '../MediaCardSkeleton';
import { MediaListItemSkeleton } from '../MediaListItemSkeleton';

const CAROUSEL_WHEEL_SPEED = 3.8;

interface MediaCarouselSectionProps {
  title: string;
  items: MediaCardData[];
  type: 'movie' | 'series';
  viewMode: 'card' | 'list';
  isLoading?: boolean;
  emptyMessage?: string;
  onScrollThreshold?: (container: HTMLDivElement) => void;
}

export function MediaCarouselSection({
  title,
  items,
  type,
  viewMode,
  isLoading = false,
  emptyMessage = 'Aucun élément trouvé',
  onScrollThreshold,
}: Readonly<MediaCarouselSectionProps>) {
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const scrollAmount = carouselRef.current.clientWidth * 0.75;
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!carouselRef.current) return;
    const isMainlyHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!isMainlyHorizontal && Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      carouselRef.current.scrollLeft += e.deltaY * CAROUSEL_WHEEL_SPEED;
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold text-white">{title}</h3>

        {viewMode === 'card' && items.length > 0 && (
          <div className="hidden lg:flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => scrollCarousel('left')}
              className="h-8 w-8 rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
              aria-label="Défiler vers la gauche"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => scrollCarousel('right')}
              className="h-8 w-8 rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
              aria-label="Défiler vers la droite"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        viewMode === 'card' ? (
          <div className="flex gap-4 overflow-hidden py-2">
            {[...new Array(6)].map((_, i) => (
              <div
                key={i}
                className="min-w-[172px] max-w-[172px] sm:min-w-[196px] sm:max-w-[196px] md:min-w-[220px] md:max-w-[220px] shrink-0"
              >
                <MediaCardSkeleton />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {[...new Array(4)].map((_, i) => (
              <MediaListItemSkeleton key={i} />
            ))}
          </div>
        )
      ) : items.length > 0 ? (
        viewMode === 'card' ? (
          <div className="space-y-3">
            <div
              ref={carouselRef}
              onWheelCapture={handleWheel}
              onScroll={(e) => {
                if (onScrollThreshold) {
                  onScrollThreshold(e.currentTarget);
                }
              }}
              className="-mx-4 lg:mx-0 flex overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth touch-auto overscroll-x-contain py-2 px-4 lg:px-0"
            >
              <div className="flex gap-3 sm:gap-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="min-w-[172px] max-w-[172px] sm:min-w-[196px] sm:max-w-[196px] md:min-w-[220px] md:max-w-[220px] shrink-0"
                  >
                    <MediaCard item={item} type={type} />
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Scroll Controls */}
            <div className="flex items-center justify-center gap-3 lg:hidden pt-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => scrollCarousel('left')}
                className="h-8 w-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                aria-label="Défiler vers la gauche"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => scrollCarousel('right')}
                className="h-8 w-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                aria-label="Défiler vers la droite"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <MediaListItem key={item.id} item={item} type={type} />
            ))}
          </div>
        )
      ) : (
        <p className="text-white/60 py-4">{emptyMessage}</p>
      )}
    </section>
  );
}

