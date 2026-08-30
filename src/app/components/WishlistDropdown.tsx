import React from 'react';
import { Heart, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { useI18n } from '../i18n/LanguageProvider';

export type WishlistMode = 'none' | 'classic' | 'autograb';

export interface WishlistButtonsProps {
  mode: WishlistMode;
  onToggleClassic: () => void;
  onToggleAutoGrab: () => void;
  disabled?: boolean;
  size?: 'default' | 'sm' | 'icon';
  showLabels?: boolean;
  className?: string;
}

export function WishlistButtons({
  mode,
  onToggleClassic,
  onToggleAutoGrab,
  disabled = false,
  size = 'default',
  showLabels = true,
  className = '',
}: Readonly<WishlistButtonsProps>) {
  const { t } = useI18n();
  console.log('Wishlist mode:', mode);

  // Heart is active if the item is in wishlist (either in classic or autograb mode)
  const isFavorite = mode === 'classic' || mode === 'autograb';
  const isAutoGrab = mode === 'autograb';

  if (size === 'icon') {
    return (
      <div className={`inline-flex items-center gap-1 shrink-0 ${className}`}>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={disabled}
          onClick={onToggleClassic}
          title={
            isFavorite
              ? t('wishlistButtons.removeClassic')
              : t('wishlistButtons.addClassic')
          }
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full p-0 transition-all cursor-pointer ${
            isFavorite
              ? 'bg-purple-500/25 border-purple-500/60 text-purple-300 shadow-sm shadow-purple-950/40 hover:bg-purple-500/35 scale-105'
              : 'bg-white/5 border-white/10 text-white/40 hover:text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/30'
          }`}
        >
          <Heart
            className={`w-3.5 h-3.5 ${isFavorite ? 'fill-purple-400 text-purple-400' : ''}`}
          />
        </Button>

        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={disabled}
          onClick={onToggleAutoGrab}
          title={
            isAutoGrab
              ? t('wishlistButtons.removeAutoGrab')
              : t('wishlistButtons.addAutoGrab')
          }
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full p-0 transition-all cursor-pointer ${
            isAutoGrab
              ? 'bg-emerald-500/25 border-emerald-500/60 text-emerald-300 shadow-sm shadow-emerald-950/40 hover:bg-emerald-500/35 scale-105'
              : 'bg-white/5 border-white/10 text-white/40 hover:text-yellow-300 hover:bg-emerald-500/10 hover:border-emerald-500/30'
          }`}
        >
          <Zap
            className={`w-3.5 h-3.5 ${isAutoGrab ? 'fill-emerald-400 text-emerald-400' : ''}`}
          />
        </Button>
      </div>
    );
  }

  if (size === 'sm') {
    return (
      <div className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onToggleClassic}
          title={
            isFavorite
              ? t('wishlistButtons.removeClassic')
              : t('wishlistButtons.addClassic')
          }
          className={`h-8 px-2.5 rounded-lg text-xs gap-1.5 transition-all cursor-pointer ${
            isFavorite
              ? 'bg-purple-500/25 border-purple-500/60 text-purple-200 shadow-sm shadow-purple-950/40 hover:bg-purple-500/35'
              : 'bg-white/5 border-white/10 text-white/60 hover:text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/30'
          }`}
        >
          <Heart
            className={`w-3.5 h-3.5 ${isFavorite ? 'fill-purple-400 text-purple-400' : 'text-purple-300/70'}`}
          />
          {showLabels && <span>{t('wishlistButtons.classic')}</span>}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onToggleAutoGrab}
          title={
            isAutoGrab
              ? t('wishlistButtons.removeAutoGrab')
              : t('wishlistButtons.addAutoGrab')
          }
          className={`h-8 px-2.5 rounded-lg text-xs gap-1.5 transition-all cursor-pointer ${
            isAutoGrab
              ? 'bg-emerald-500/25 border-emerald-500/60 text-emerald-200 shadow-sm shadow-emerald-950/40 hover:bg-emerald-500/35'
              : 'bg-white/5 border-white/10 text-white/60 hover:text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/30'
          }`}
        >
          <Zap
            className={`w-3.5 h-3.5 ${isAutoGrab ? 'fill-emerald-400 text-emerald-400' : 'text-yellow-300/70'}`}
          />
          {showLabels && <span>{t('wishlistButtons.autoGrab')}</span>}
        </Button>
      </div>
    );
  }

  // Default size (header & main views)
  return (
    <div className={`inline-flex items-center gap-2 flex-wrap ${className}`}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={onToggleClassic}
        title={
          isFavorite
            ? t('wishlistButtons.removeClassic')
            : t('wishlistButtons.addClassic')
        }
        className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-medium gap-2 transition-all cursor-pointer ${
          isFavorite
            ? 'bg-purple-500/25 border-purple-500/60 text-purple-200 shadow-md shadow-purple-950/40 hover:bg-purple-500/35'
            : 'bg-white/5 border-white/10 text-white/70 hover:text-purple-200 hover:bg-purple-500/10 hover:border-purple-500/30'
        }`}
      >
        <Heart
          className={`w-4 h-4 ${isFavorite ? 'fill-purple-400 text-purple-400' : 'text-purple-300'}`}
        />
        {showLabels && <span>{t('wishlistButtons.classic')}</span>}
      </Button>

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={onToggleAutoGrab}
        title={
          isAutoGrab
            ? t('wishlistButtons.removeAutoGrab')
            : t('wishlistButtons.addAutoGrab')
        }
        className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-medium gap-2 transition-all cursor-pointer ${
          isAutoGrab
            ? 'bg-emerald-500/25 border-emerald-500/60 text-emerald-200 shadow-md shadow-emerald-950/40 hover:bg-emerald-500/35'
            : 'bg-white/5 border-white/10 text-white/70 hover:text-emerald-200 hover:bg-emerald-500/10 hover:border-emerald-500/30'
        }`}
      >
        <Zap
          className={`w-4 h-4 ${isAutoGrab ? 'fill-emerald-400 text-emerald-400' : 'text-yellow-300'}`}
        />
        {showLabels && <span>{t('wishlistButtons.autoGrab')}</span>}
      </Button>
    </div>
  );
}

// Alias for backward compatibility
export const WishlistDropdown = WishlistButtons;
