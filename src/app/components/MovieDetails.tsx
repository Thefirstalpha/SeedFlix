import { ArrowLeft, Star, Calendar, Clock, User, Heart } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { TorrentResultsPanel } from './TorrentResultsPanel';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/LanguageProvider';
import { normalizeIndexerLanguage, normalizeQuality } from '../services/indexerNormalization';
import {
  getMovieById,
  searchMovieReleases,
  type TorznabMovieResult,
} from '../services/movieService';
import { buildTorrentResultsLabels } from '../services/torrentResultsLabels';
import { addTorrentToClient } from '../services/torrentService';
import { addToWishlist, removeFromWishlist, isInWishlist } from '../services/wishlistService';
import type { Movie } from '../types/movie';

const MOVIE_QUALITY_FILTERS = ['all', '2160p', '1080p', '720p', '480p', 'bluray', 'webdl', 'hdtv'];

export function MovieDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useAuth();
  const { t, language } = useI18n();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inWishlist, setInWishlist] = useState(false);
  const [releaseResults, setReleaseResults] = useState<TorznabMovieResult[]>([]);
  const [isReleaseLoading, setIsReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [addingTorrentLink, setAddingTorrentLink] = useState<string | null>(null);
  const [torrentStatus, setTorrentStatus] = useState<string | null>(null);
  const [torrentError, setTorrentError] = useState<string | null>(null);
  const [qualityFilter, setQualityFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'size' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const preferred = String(
      settings?.placeholders?.indexer?.defaultQuality || 'all',
    ).toLowerCase();
    setQualityFilter(MOVIE_QUALITY_FILTERS.includes(preferred) ? preferred : 'all');
  }, [settings?.placeholders?.indexer?.defaultQuality]);

  const filteredReleaseResults = useMemo(() => {
    let results = releaseResults.filter((item) => {
      const languageOk =
        languageFilter === 'all' || normalizeIndexerLanguage(item.language) === languageFilter;

      if (qualityFilter === 'all') {
        return languageOk;
      }

      return normalizeQuality(item.quality) === qualityFilter && languageOk;
    });

    // Apply sorting
    if (sortBy === 'size') {
      results.sort((a, b) => {
        const sizeA = a.sizeBytes || 0;
        const sizeB = b.sizeBytes || 0;
        return sortOrder === 'desc' ? sizeB - sizeA : sizeA - sizeB;
      });
    } else if (sortBy === 'date') {
      results.sort((a, b) => {
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
    }

    return results;
  }, [releaseResults, qualityFilter, languageFilter, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredReleaseResults.length / ITEMS_PER_PAGE);
  const paginatedResults = filteredReleaseResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [qualityFilter, languageFilter, sortBy, sortOrder]);

  const availableReleaseLanguages = Array.from(
    new Set(releaseResults.map((item) => normalizeIndexerLanguage(item.language)).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'fr'));

  const torrentPanelLabels = useMemo(
    () => buildTorrentResultsLabels(t, { sectionKey: 'movieDetails' }),
    [t],
  );

  useEffect(() => {
    loadMovieDetails();
  }, [id, language]);

  const loadMovieDetails = async () => {
    setIsLoading(true);
    try {
      const movieData = await getMovieById(Number(id), language);
      setMovie(movieData);
      if (movieData) {
        setInWishlist(await isInWishlist(movieData.id));

        setIsReleaseLoading(true);
        setReleaseError(null);
        try {
          const indexerResponse = await searchMovieReleases(
            movieData.originalTitle || movieData.title,
            12,
            movieData.id,
          );
          setReleaseResults(indexerResponse.items);
        } catch (indexerError) {
          setReleaseError(
            indexerError instanceof Error
              ? indexerError.message
              : t('movieDetails.errors.indexerSearchFailed'),
          );
          setReleaseResults([]);
        } finally {
          setIsReleaseLoading(false);
        }
      } else {
        setReleaseResults([]);
      }
    } catch (error) {
      console.error('Error loading movie details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWishlist = async () => {
    if (!movie) return;

    if (inWishlist) {
      await removeFromWishlist(movie.id);
      setInWishlist(false);
    } else {
      await addToWishlist(movie);
      setInWishlist(true);
    }

    window.dispatchEvent(new CustomEvent('seedflix:wishlist-refresh-request'));
    window.dispatchEvent(new CustomEvent('seedflix:notifications-refresh-request'));
  };

  const handleAddTorrent = async (torrentUrl: string) => {
    setTorrentStatus(null);
    setTorrentError(null);
    setAddingTorrentLink(torrentUrl);

    try {
      const response = await addTorrentToClient(torrentUrl);
      setTorrentStatus(
        response.duplicate
          ? t('movieDetails.messages.duplicateTorrent')
          : t('movieDetails.messages.torrentAdded'),
      );
    } catch (error) {
      setTorrentError(
        error instanceof Error ? error.message : t('movieDetails.errors.addTorrentFailed'),
      );
    } finally {
      setAddingTorrentLink(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-10 w-32 bg-white/5 rounded animate-pulse" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="aspect-[2/3] bg-white/5 rounded-lg animate-pulse" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="h-10 w-3/4 bg-white/5 rounded animate-pulse" />
            <div className="h-6 w-1/2 bg-white/5 rounded animate-pulse" />
            <div className="h-20 w-full bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">{t('movieDetails.notFoundTitle')}</h2>
        <Link to="/">
          <Button className="bg-purple-600 hover:bg-purple-700 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('movieDetails.backHome')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 overflow-x-hidden">
      {/* Back Button and Wishlist */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          className="border-purple-500/30 bg-purple-600/10 text-white hover:bg-purple-600/20 hover:border-purple-500/50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('movieDetails.back')}
        </Button>

        <Button
          onClick={toggleWishlist}
          className={`${
            inWishlist
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
          }`}
        >
          <Heart className={`w-5 h-5 mr-2 ${inWishlist ? 'fill-current' : ''}`} />
          {inWishlist ? t('movieDetails.removeFromWishlist') : t('movieDetails.addToWishlist')}
        </Button>
      </div>

      {/* Backdrop Image */}
      {movie.backdrop && (
        <div className="relative mb-20 lg:mb-0">
          <div className="relative w-full h-44 sm:h-56 md:h-80 lg:h-96 rounded-lg overflow-hidden">
            <img src={movie.backdrop} alt={movie.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
            <div className="hidden lg:block absolute bottom-0 left-0 p-8">
              <h1 className="text-4xl font-bold text-white mb-2 line-clamp-2">{movie.title}</h1>
              {movie.originalTitle && movie.originalTitle !== movie.title && (
                <p className="text-white/70 text-lg line-clamp-1">{movie.originalTitle}</p>
              )}
            </div>
          </div>

          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-40 sm:w-44 md:w-48 lg:hidden">
            <Card className="overflow-hidden bg-white/5 border-white/20 shadow-2xl shadow-black/50">
              <img
                src={movie.poster}
                alt={movie.title}
                className="w-full aspect-[2/3] object-cover"
              />
            </Card>
          </div>
        </div>
      )}

      {/* Movie Header */}
      <div className="grid lg:grid-cols-3 gap-8 justify-items-center lg:justify-items-stretch">
        {/* Poster */}
        <div
          className={`lg:col-span-1 max-w-[280px] sm:max-w-sm lg:max-w-none mx-auto lg:mx-0 w-full ${movie.backdrop ? 'hidden lg:block' : ''}`}
        >
          <Card className="overflow-hidden bg-white/5 border-white/10">
            <img
              src={movie.poster}
              alt={movie.title}
              className="w-full aspect-[2/3] object-cover"
            />
          </Card>
        </div>

        {/* Details */}
        <div className={`lg:col-span-2 space-y-6 ${movie.backdrop ? 'lg:pt-4' : ''}`}>
          <div>
            {movie.backdrop ? (
              <div className="lg:hidden">
                <h1 className="text-3xl font-bold text-white mb-2">{movie.title}</h1>
                {movie.originalTitle && movie.originalTitle !== movie.title && (
                  <p className="text-base text-white/50 mb-2">{movie.originalTitle}</p>
                )}
              </div>
            ) : (
              <>
                <h1 className="text-4xl font-bold text-white mb-2">{movie.title}</h1>
                {movie.originalTitle && movie.originalTitle !== movie.title && (
                  <p className="text-lg text-white/50 mb-2">{movie.originalTitle}</p>
                )}
              </>
            )}
            <div className="flex flex-wrap items-center gap-4 text-white/70">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>{movie.year}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>{movie.duration}</span>
              </div>
              <Badge className="bg-purple-600 text-white">{movie.genre}</Badge>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-lg border border-yellow-500/30">
              <Star className="w-6 h-6 fill-yellow-500 text-yellow-500" />
              <span className="text-2xl font-bold text-white">{movie.rating}</span>
              <span className="text-white/60">/10</span>
            </div>
            {movie.voteCount && (
              <span className="text-white/60">
                {t('movieDetails.votes', { count: movie.voteCount.toLocaleString() })}
              </span>
            )}
          </div>

          {/* Plot */}
          <div>
            <h2 className="text-2xl font-semibold text-white mb-3">{t('movieDetails.synopsis')}</h2>
            <p className="text-white/80 text-lg leading-relaxed break-words">{movie.plot}</p>
          </div>

          {/* Director */}
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-5 h-5 text-purple-400" />
                <h3 className="text-xl font-semibold text-white">{t('movieDetails.director')}</h3>
              </div>
              <p className="text-white/80 text-lg break-words">{movie.director}</p>
            </CardContent>
          </Card>

          {/* Cast */}
          {movie.actors.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">{t('movieDetails.cast')}</h3>
                <div className="flex flex-wrap gap-2">
                  {movie.actors.map((actor, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="max-w-full border-white/20 text-white bg-white/5 px-3 py-1 break-words"
                    >
                      {actor}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <TorrentResultsPanel
            title={t('movieDetails.indexer.title')}
            qualityFilter={qualityFilter}
            onQualityFilterChange={setQualityFilter}
            languageFilter={languageFilter}
            onLanguageFilterChange={setLanguageFilter}
            availableReleaseLanguages={availableReleaseLanguages}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderToggle={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            isReleaseLoading={isReleaseLoading}
            releaseError={releaseError}
            torrentStatus={torrentStatus}
            torrentError={torrentError}
            filteredResults={filteredReleaseResults}
            paginatedResults={paginatedResults}
            addingTorrentLink={addingTorrentLink}
            onAddTorrent={handleAddTorrent}
            currentPage={currentPage}
            onCurrentPageChange={setCurrentPage}
            totalPages={totalPages}
            locale={language === 'fr' ? 'fr-FR' : 'en-US'}
            labels={torrentPanelLabels}
          />

          <div>
            <Button
              onClick={toggleWishlist}
              className={`w-full sm:w-auto ${
                inWishlist
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }`}
            >
              <Heart className={`w-5 h-5 mr-2 ${inWishlist ? 'fill-current' : ''}`} />
              {inWishlist ? t('movieDetails.removeFromWishlist') : t('movieDetails.addToWishlist')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
