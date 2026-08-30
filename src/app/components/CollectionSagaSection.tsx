import { useEffect, useState } from 'react';
import { Calendar, Clapperboard, Heart, Layers, Star } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';
import { getMovieCollection, TmdbCollectionDetails } from '../services/tmdbService';
import { checkMediaInWishlist, toggleWishlistMedia } from '../services/wishlistService';
import { getTmdbImageUrl } from '../config/tmdb';
import { useI18n } from '../i18n/LanguageProvider';

interface CollectionSagaSectionProps {
  collectionId: number;
  currentMovieId: number;
}

export function CollectionSagaSection({
  collectionId,
  currentMovieId,
}: Readonly<CollectionSagaSectionProps>) {
  const { language } = useI18n();
  const [collection, setCollection] = useState<TmdbCollectionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wishlistMap, setWishlistMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getMovieCollection(collectionId, language)
      .then(async (data) => {
        if (!isMounted || !data) return;
        setCollection(data);

        // Check wishlist status for all parts in the saga
        const statusMap: Record<number, boolean> = {};
        await Promise.all(
          data.parts.map(async (part) => {
            const inWishlist = await checkMediaInWishlist(part.id, 'movie');
            statusMap[part.id] = inWishlist;
          }),
        );
        if (isMounted) setWishlistMap(statusMap);
      })
      .catch((err) => console.error('Error loading saga collection:', err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [collectionId, language]);

  if (isLoading || !collection || collection.parts.length <= 1) {
    return null;
  }

  // Sort parts chronologically by release_date
  const sortedParts = [...collection.parts].sort((a, b) => {
    const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
    const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
    return dateA - dateB;
  });

  const handleToggleWishlist = async (partId: number, title: string) => {
    const currentState = Boolean(wishlistMap[partId]);
    try {
      const nextState = await toggleWishlistMedia(partId, 'movie', currentState);
      setWishlistMap((prev) => ({ ...prev, [partId]: nextState }));
      if (nextState) {
        toast.success(`"${title}" ajouté à la wishlist`);
      } else {
        toast.info(`"${title}" retiré de la wishlist`);
      }
    } catch {
      toast.error('Erreur lors de la mise à jour de la wishlist');
    }
  };

  return (
    <Card className="overflow-hidden border-purple-500/30 bg-gradient-to-br from-purple-950/40 via-slate-900/60 to-slate-950/80 backdrop-blur-md">
      <CardContent className="p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {collection.poster_path && (
            <div className="w-24 sm:w-28 aspect-[2/3] rounded-lg overflow-hidden shrink-0 shadow-lg border border-white/10 hidden sm:block">
              <img
                src={getTmdbImageUrl(collection.poster_path, 'w300')}
                alt={collection.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400 shrink-0" />
              <Badge className="bg-purple-600/30 text-purple-200 border-purple-400/40 text-xs">
                {language === 'fr' ? 'Saga / Collection' : 'Franchise'}
              </Badge>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {collection.name}
            </h3>
            {collection.overview && (
              <p className="text-xs sm:text-sm text-white/70 line-clamp-3 leading-relaxed">
                {collection.overview}
              </p>
            )}
          </div>
        </div>

        {/* Chronological Saga List */}
        <div className="space-y-2.5 pt-2 border-t border-white/10">
          <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            {language === 'fr' ? 'Opus de la franchise dans l’ordre' : 'Franchise movies in order'}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedParts.map((part, index) => {
              const isCurrent = part.id === currentMovieId;
              const year = part.release_date ? new Date(part.release_date).getFullYear() : 0;
              const isInWishlist = Boolean(wishlistMap[part.id]);

              return (
                <div
                  key={part.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-all ${
                    isCurrent
                      ? 'bg-purple-900/40 border-purple-500/60 shadow-md ring-1 ring-purple-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <Link
                    to={`/movie/${part.id}`}
                    className="flex items-center gap-3 min-w-0 flex-1 group"
                  >
                    <div className="w-10 sm:w-12 aspect-[2/3] rounded overflow-hidden bg-white/5 shrink-0">
                      {part.poster_path ? (
                        <img
                          src={getTmdbImageUrl(part.poster_path, 'w185')}
                          alt={part.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30">
                          <Clapperboard className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-purple-400">
                          #{index + 1}
                        </span>
                        <h4 className="font-semibold text-white text-sm group-hover:text-purple-300 transition-colors line-clamp-1">
                          {part.title}
                        </h4>
                        {isCurrent && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-purple-400 text-purple-300 bg-purple-500/20"
                          >
                            {language === 'fr' ? 'Actuel' : 'Current'}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-white/60">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {year > 0 ? year : 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                          {Math.round(part.vote_average * 10) / 10}
                        </span>
                      </div>
                    </div>
                  </Link>

                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleWishlist(part.id, part.title)}
                      className={`h-8 px-2 rounded-full shrink-0 ${
                        isInWishlist
                          ? 'text-pink-400 hover:text-pink-300 bg-pink-500/10 hover:bg-pink-500/20'
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                      title={isInWishlist ? 'Retirer de la wishlist' : 'Ajouter à la wishlist'}
                    >
                      <Heart
                        className={`w-4 h-4 ${isInWishlist ? 'fill-pink-400 text-pink-400' : ''}`}
                      />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

