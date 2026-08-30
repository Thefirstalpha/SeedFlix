import React, { useEffect, useState } from 'react';
import { Calendar, Heart, Star, Tv } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';
import { checkMediaInWishlist, toggleWishlistMedia } from '../services/wishlistService';

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

  const [inWishlist, setInWishlist] = useState<boolean>(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    checkMediaInWishlist(item.id, type).then((exists) => {
      if (isMounted) setInWishlist(exists);
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [item.id, type]);

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isWishlistLoading) return;
    setIsWishlistLoading(true);

    try {
      const nextState = await toggleWishlistMedia(item.id, type, inWishlist);
      setInWishlist(nextState);
      if (nextState) {
        toast.success(`"${item.title}" ajouté à la wishlist`);
      } else {
        toast.info(`"${item.title}" retiré de la wishlist`);
      }
    } catch {
      toast.error('Erreur lors de la modification de la wishlist');
    } finally {
      setIsWishlistLoading(false);
    }
  };

  return (
    <Link to={link}>
      <Card className="overflow-hidden bg-white/5 border-white/10 hover:bg-white/10 transition-all hover:scale-105 group cursor-pointer gap-0 relative">
        <div className={`aspect-[2/3] overflow-hidden bg-gradient-to-br ${gradientClass} relative`}>
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />

          {/* Quick Wishlist Hover Action */}
          <button
            type="button"
            onClick={handleWishlistToggle}
            aria-label={inWishlist ? 'Retirer de la wishlist' : 'Ajouter à la wishlist'}
            title={inWishlist ? 'Retirer de la wishlist' : 'Ajouter à la wishlist'}
            disabled={isWishlistLoading}
            className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition-all duration-200 z-10 ${
              inWishlist
                ? 'bg-black/60 text-pink-500 opacity-100 shadow-lg scale-105'
                : 'bg-black/40 text-white/70 hover:text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
            }`}
          >
            <Heart
              className={`w-4 h-4 transition-transform active:scale-125 ${
                inWishlist ? 'fill-pink-500 text-pink-500' : ''
              }`}
            />
          </button>
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
