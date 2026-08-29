import { Film, Play } from 'lucide-react';
import { useState } from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useI18n } from '../i18n/LanguageProvider';
import type { TmdbVideo } from '../services/tmdbService';

export interface TrailersSectionProps {
  trailers: TmdbVideo[];
  mediaTitle: string;
  type?: 'movie' | 'series';
}

function getTrailerLanguageLabel(
  trailer: TmdbVideo,
  langFrLabel: string,
  langEnLabel: string,
): { label: string; isFr: boolean; isEn: boolean } {
  const isFr = trailer.iso_639_1?.toLowerCase() === 'fr';
  const isEn = trailer.iso_639_1?.toLowerCase() === 'en';
  let label = (trailer.iso_639_1 || '').toUpperCase();
  if (isFr) label = langFrLabel;
  else if (isEn) label = langEnLabel;
  return { label, isFr, isEn };
}

function getTrailerBadgeClass(isFr: boolean, isEn: boolean): string {
  if (isFr) return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  if (isEn) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-white/10 text-white/70 border-white/20';
}

export function TrailersSection({
  trailers,
  mediaTitle,
  type = 'movie',
}: Readonly<TrailersSectionProps>) {
  const { t } = useI18n();
  const [selectedTrailer, setSelectedTrailer] = useState<TmdbVideo | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  if (!trailers || trailers.length === 0) {
    return null;
  }

  const isMovie = type === 'movie';
  const colorClasses = isMovie
    ? {
        icon: 'text-purple-400',
        dialogIcon: 'text-purple-400 fill-purple-400',
        cardHover: 'hover:bg-purple-600/20 hover:border-purple-500/40',
        playBg: 'bg-purple-600/20 group-hover:bg-purple-600 text-purple-300 group-hover:text-white',
        titleHover: 'group-hover:text-purple-200',
      }
    : {
        icon: 'text-cyan-400',
        dialogIcon: 'text-cyan-400 fill-cyan-400',
        cardHover: 'hover:bg-cyan-600/20 hover:border-cyan-500/40',
        playBg: 'bg-cyan-600/20 group-hover:bg-cyan-600 text-cyan-300 group-hover:text-white',
        titleHover: 'group-hover:text-cyan-200',
      };

  const sectionTitle = isMovie ? t('movieDetails.trailers') : t('seriesDetails.trailers');
  const langFrLabel = isMovie ? t('movieDetails.trailerLangFr') : t('seriesDetails.trailerLangFr');
  const langEnLabel = isMovie ? t('movieDetails.trailerLangEn') : t('seriesDetails.trailerLangEn');

  const handleOpenTrailer = (trailer: TmdbVideo) => {
    setSelectedTrailer(trailer);
    setIsOpen(true);
  };

  return (
    <>
      <Card className="bg-white/5 border-white/10 w-full overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4 min-w-0">
            <Film className={`w-5 h-5 shrink-0 ${colorClasses.icon}`} />
            <h3 className="text-xl font-semibold text-white truncate">{sectionTitle}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0">
            {trailers.map((trailer) => {
              const { label: langLabel, isFr, isEn } = getTrailerLanguageLabel(
                trailer,
                langFrLabel,
                langEnLabel,
              );

              return (
                <button
                  key={trailer.id || trailer.key}
                  type="button"
                  onClick={() => handleOpenTrailer(trailer)}
                  className={`group flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 border border-white/10 text-left transition-all cursor-pointer w-full min-w-0 ${colorClasses.cardHover}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors ${colorClasses.playBg}`}
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-white text-sm font-medium truncate ${colorClasses.titleHover}`}>
                        {trailer.name}
                      </p>
                      <p className="text-white/50 text-xs truncate">
                        {trailer.type} {trailer.size ? `• ${trailer.size}p` : ''}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs font-semibold whitespace-nowrap ml-2 ${getTrailerBadgeClass(
                      isFr,
                      isEn,
                    )}`}
                  >
                    {langLabel}
                  </Badge>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-4xl p-0 gap-0 overflow-hidden bg-slate-950 border-white/10 text-white shadow-2xl">
          <DialogHeader className="p-3.5 sm:p-4 pb-2 border-b border-white/10 pr-12">
            <DialogTitle className="text-base sm:text-lg font-semibold flex items-center gap-2 text-white min-w-0">
              <Play className={`w-4 h-4 shrink-0 ${colorClasses.dialogIcon}`} />
              <span className="truncate">{selectedTrailer?.name || mediaTitle}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full aspect-video bg-black">
            {isOpen && selectedTrailer && (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${selectedTrailer.key}?autoplay=1`}
                title={selectedTrailer.name || mediaTitle}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

