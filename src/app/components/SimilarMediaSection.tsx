import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { MediaCard } from './MediaCard';
import { MediaCardSkeleton } from './MediaCardSkeleton';
import { getMediaRecommendations } from '../services/tmdbService';
import { useI18n } from '../i18n/LanguageProvider';
import type { Movie } from '../types/movie';
import type { Series } from '../types/series';

interface SimilarMediaSectionProps {
  id: number;
  type: 'movie' | 'series';
  title?: string;
}

export function SimilarMediaSection({ id, type, title }: Readonly<SimilarMediaSectionProps>) {
  const { language } = useI18n();
  const [items, setItems] = useState<Array<Movie | Series>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getMediaRecommendations(id, type, language)
      .then((data) => {
        if (isMounted) {
          setItems(data.slice(0, 16));
        }
      })
      .catch((err) => console.error('Error fetching similar media:', err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, type, language]);

  if (!isLoading && items.length === 0) {
    return null;
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const amount = carouselRef.current.clientWidth * 0.75;
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  const defaultTitle =
    type === 'movie'
      ? (language === 'fr' ? 'Films similaires et recommandés' : 'Similar & Recommended Movies')
      : (language === 'fr' ? 'Séries similaires et recommandées' : 'Similar & Recommended Series');

  return (
    <section className="space-y-4 pt-4 border-t border-white/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <h3 className="text-xl font-semibold text-white">{title || defaultTitle}</h3>
        </div>

        {items.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => scroll('left')}
              className="h-8 w-8 rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
              aria-label="Précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => scroll('right')}
              className="h-8 w-8 rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10"
              aria-label="Suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden py-2">
          {[...new Array(6)].map((_, i) => (
            <div
              key={i}
              className="min-w-[160px] max-w-[160px] sm:min-w-[180px] sm:max-w-[180px] shrink-0"
            >
              <MediaCardSkeleton />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={carouselRef}
          className="-mx-4 lg:mx-0 flex overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth touch-auto py-2 px-4 lg:px-0"
        >
          <div className="flex gap-3 sm:gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="min-w-[160px] max-w-[160px] sm:min-w-[180px] sm:max-w-[180px] shrink-0"
              >
                <MediaCard item={item} type={type} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

