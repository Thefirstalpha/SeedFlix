import { useEffect, useState } from 'react';
import { Calendar, Film, Loader2, MapPin, Star, Tv, User, X } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { getPersonDetails, TmdbPersonDetails } from '../services/tmdbService';
import { getTmdbImageUrl } from '../config/tmdb';
import { useI18n } from '../i18n/LanguageProvider';

interface PersonFilmographyModalProps {
  personId: number | null;
  personName?: string;
  onClose: () => void;
}

export function PersonFilmographyModal({
  personId,
  personName,
  onClose,
}: Readonly<PersonFilmographyModalProps>) {
  const { language } = useI18n();
  const [details, setDetails] = useState<TmdbPersonDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!personId) {
      setDetails(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    getPersonDetails(personId, language)
      .then((data) => {
        if (isMounted) setDetails(data);
      })
      .catch((err) => console.error('Error fetching person details:', err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [personId, language]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && personId) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [personId, onClose]);

  if (!personId) return null;

  // Deduplicate and sort credits
  const movieCredits = [
    ...(details?.combined_credits?.cast.filter((c) => c.media_type === 'movie') || []),
    ...(details?.combined_credits?.crew.filter((c) => c.media_type === 'movie' && (c.job === 'Director' || c.job === 'Writer')) || []),
  ].filter((c, index, self) => index === self.findIndex((t) => t.id === c.id))
   .sort((a, b) => {
     const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
     const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
     return dateB - dateA;
   });

  const seriesCredits = [
    ...(details?.combined_credits?.cast.filter((c) => c.media_type === 'tv') || []),
    ...(details?.combined_credits?.crew.filter((c) => c.media_type === 'tv' && (c.job === 'Director' || c.job === 'Creator' || c.job === 'Executive Producer')) || []),
  ].filter((c, index, self) => index === self.findIndex((t) => t.id === c.id))
   .sort((a, b) => {
     const dateA = a.first_air_date ? new Date(a.first_air_date).getTime() : 0;
     const dateB = b.first_air_date ? new Date(b.first_air_date).getTime() : 0;
     return dateB - dateA;
   });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in-50 duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg sm:text-xl font-bold text-white">
              {details?.name || personName || 'Filmographie'}
            </h3>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/60 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <span>Chargement des informations...</span>
            </div>
          ) : details ? (
            <>
              {/* Person Bio Summary */}
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="w-24 sm:w-32 aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 shadow-md">
                  {details.profile_path ? (
                    <img
                      src={getTmdbImageUrl(details.profile_path, 'w300')}
                      alt={details.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30">
                      <User className="w-10 h-10" />
                    </div>
                  )}
                </div>

                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-purple-600/30 text-purple-200 border-purple-500/30">
                      {details.known_for_department}
                    </Badge>
                    {details.birthday && (
                      <span className="text-xs text-white/60 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {details.birthday}
                      </span>
                    )}
                    {details.place_of_birth && (
                      <span className="text-xs text-white/60 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {details.place_of_birth}
                      </span>
                    )}
                  </div>

                  {details.biography ? (
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-h-36 overflow-y-auto pr-2">
                      {details.biography}
                    </p>
                  ) : (
                    <p className="text-xs text-white/40 italic">Aucune biographie disponible.</p>
                  )}
                </div>
              </div>

              {/* Filmography Tabs */}
              <Tabs defaultValue="movies" className="space-y-4">
                <TabsList className="bg-white/5 border border-white/10 p-1">
                  <TabsTrigger value="movies" className="gap-2 text-xs sm:text-sm">
                    <Film className="w-4 h-4" />
                    {language === 'fr' ? 'Films' : 'Movies'} ({movieCredits.length})
                  </TabsTrigger>
                  <TabsTrigger value="series" className="gap-2 text-xs sm:text-sm">
                    <Tv className="w-4 h-4" />
                    {language === 'fr' ? 'Séries' : 'TV Series'} ({seriesCredits.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="movies" className="space-y-3">
                  {movieCredits.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                      {movieCredits.map((item) => {
                        const year = item.release_date
                          ? new Date(item.release_date).getFullYear()
                          : 0;
                        return (
                          <Link
                            key={`movie-${item.id}-${item.character || item.job}`}
                            to={`/movie/${item.id}`}
                            onClick={onClose}
                            className="group block p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-105"
                          >
                            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/5 mb-2 relative">
                              {item.poster_path ? (
                                <img
                                  src={getTmdbImageUrl(item.poster_path, 'w185')}
                                  alt={item.title || ''}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/30">
                                  <Film className="w-6 h-6" />
                                </div>
                              )}
                              {item.vote_average > 0 && (
                                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur text-[10px] font-semibold text-yellow-400 flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 fill-yellow-400" />
                                  {Math.round(item.vote_average * 10) / 10}
                                </div>
                              )}
                            </div>
                            <h5 className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                              {item.title}
                            </h5>
                            <div className="flex items-center justify-between text-[11px] text-white/50 mt-0.5">
                              <span>{year > 0 ? year : 'N/A'}</span>
                              <span className="truncate max-w-[90px]" title={item.character || item.job}>
                                {item.character || item.job || ''}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-white/50 text-sm py-4">Aucun film répertorié.</p>
                  )}
                </TabsContent>

                <TabsContent value="series" className="space-y-3">
                  {seriesCredits.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                      {seriesCredits.map((item) => {
                        const year = item.first_air_date
                          ? new Date(item.first_air_date).getFullYear()
                          : 0;
                        return (
                          <Link
                            key={`series-${item.id}-${item.character || item.job}`}
                            to={`/series/${item.id}`}
                            onClick={onClose}
                            className="group block p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all hover:scale-105"
                          >
                            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/5 mb-2 relative">
                              {item.poster_path ? (
                                <img
                                  src={getTmdbImageUrl(item.poster_path, 'w185')}
                                  alt={item.name || ''}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/30">
                                  <Tv className="w-6 h-6" />
                                </div>
                              )}
                              {item.vote_average > 0 && (
                                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur text-[10px] font-semibold text-cyan-400 flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 fill-cyan-400" />
                                  {Math.round(item.vote_average * 10) / 10}
                                </div>
                              )}
                            </div>
                            <h5 className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                              {item.name}
                            </h5>
                            <div className="flex items-center justify-between text-[11px] text-white/50 mt-0.5">
                              <span>{year > 0 ? year : 'N/A'}</span>
                              <span className="truncate max-w-[90px]" title={item.character || item.job}>
                                {item.character || item.job || ''}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-white/50 text-sm py-4">Aucune série répertoriée.</p>
                  )}
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

