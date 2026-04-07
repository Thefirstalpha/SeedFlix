import { useParams, Link, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Download, Loader2, Star, Calendar, Clock, User, Heart } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { getMovieById, searchMovieReleases, type TorznabMovieResult } from "../services/movieService";
import { addTorrentToClient } from "../services/torrentService";
import { addToWishlist, removeFromWishlist, isInWishlist } from "../services/wishlistService";
import type { Movie } from "../types/movie";

export function MovieDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inWishlist, setInWishlist] = useState(false);
  const [releaseResults, setReleaseResults] = useState<TorznabMovieResult[]>([]);
  const [isReleaseLoading, setIsReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [addingTorrentLink, setAddingTorrentLink] = useState<string | null>(null);
  const [torrentStatus, setTorrentStatus] = useState<string | null>(null);
  const [torrentError, setTorrentError] = useState<string | null>(null);

  useEffect(() => {
    loadMovieDetails();
  }, [id]);

  const loadMovieDetails = async () => {
    setIsLoading(true);
    try {
      const movieData = await getMovieById(Number(id));
      setMovie(movieData);
      if (movieData) {
        setInWishlist(await isInWishlist(movieData.id));

        setIsReleaseLoading(true);
        setReleaseError(null);
        try {
          const trackerResponse = await searchMovieReleases(
            movieData.originalTitle || movieData.title,
            12
          );
          setReleaseResults(trackerResponse.items);
        } catch (trackerError) {
          setReleaseError(
            trackerError instanceof Error
              ? trackerError.message
              : "Recherche tracker impossible"
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
  };

  const handleAddTorrent = async (torrentUrl: string) => {
    setTorrentStatus(null);
    setTorrentError(null);
    setAddingTorrentLink(torrentUrl);

    try {
      const response = await addTorrentToClient(torrentUrl);
      setTorrentStatus(
        response.duplicate
          ? "Ce torrent existe déjà dans votre client."
          : "Torrent ajouté au client avec succès."
      );
    } catch (error) {
      setTorrentError(
        error instanceof Error ? error.message : "Impossible d'ajouter ce torrent"
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
        <h2 className="text-2xl font-bold text-white mb-4">Film non trouvé</h2>
        <Link to="/">
          <Button className="bg-purple-600 hover:bg-purple-700 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'accueil
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back Button and Wishlist */}
      <div className="flex items-center justify-between">
        <Button 
          onClick={() => navigate(-1)}
          variant="outline" 
          className="border-purple-500/30 bg-purple-600/10 text-white hover:bg-purple-600/20 hover:border-purple-500/50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
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
          {inWishlist ? 'Retirer de ma liste' : 'Ajouter à ma liste'}
        </Button>
      </div>

      {/* Backdrop Image */}
      {movie.backdrop && (
        <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden">
          <img
            src={movie.backdrop}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
        </div>
      )}

      {/* Movie Header */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Poster */}
        <div className="lg:col-span-1">
          <Card className="overflow-hidden bg-white/5 border-white/10">
            <img
              src={movie.poster}
              alt={movie.title}
              className="w-full aspect-[2/3] object-cover"
            />
          </Card>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{movie.title}</h1>
            {movie.originalTitle && movie.originalTitle !== movie.title && (
              <p className="text-lg text-white/50 mb-2">{movie.originalTitle}</p>
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
              <Badge className="bg-purple-600 text-white">
                {movie.genre}
              </Badge>
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
              <span className="text-white/60">({movie.voteCount.toLocaleString()} votes)</span>
            )}
          </div>

          {/* Plot */}
          <div>
            <h2 className="text-2xl font-semibold text-white mb-3">Synopsis</h2>
            <p className="text-white/80 text-lg leading-relaxed">{movie.plot}</p>
          </div>

          {/* Director */}
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-5 h-5 text-purple-400" />
                <h3 className="text-xl font-semibold text-white">Réalisateur</h3>
              </div>
              <p className="text-white/80 text-lg">{movie.director}</p>
            </CardContent>
          </Card>

          {/* Cast */}
          {movie.actors.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Distribution</h3>
                <div className="flex flex-wrap gap-2">
                  {movie.actors.map((actor, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="border-white/20 text-white bg-white/5 px-3 py-1"
                    >
                      {actor}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Résultats Tracker</h3>
                <p className="text-sm text-white/60 mt-1">
                  Versions détectées sur Torznab: qualité, langues et métadonnées.
                </p>
              </div>

              {isReleaseLoading && (
                <p className="text-sm text-white/60">Recherche en cours...</p>
              )}

              {releaseError && (
                <p className="text-sm text-red-300">{releaseError}</p>
              )}

              {torrentStatus && !releaseError && (
                <p className="text-sm text-emerald-300">{torrentStatus}</p>
              )}

              {torrentError && (
                <p className="text-sm text-red-300">{torrentError}</p>
              )}

              {!isReleaseLoading && !releaseError && releaseResults.length === 0 && (
                <p className="text-sm text-white/60">Aucune version trouvée pour ce film.</p>
              )}

              {releaseResults.length > 0 && (
                <div className="space-y-3">
                  {releaseResults.map((item, index) => (
                    <div
                      key={item.guid || item.link || `${item.title}_${index}`}
                      className="rounded-lg border border-white/10 bg-slate-900/40 p-3 space-y-2"
                    >
                      <p className="text-white font-medium line-clamp-2">
                        {item.title}
                      </p>

                      <div className="flex flex-wrap gap-2 items-center">
                        <Button
                          size="sm"
                          onClick={() => handleAddTorrent(item.downloadUrl || item.link)}
                          disabled={addingTorrentLink === (item.downloadUrl || item.link)}
                          className="bg-cyan-600 hover:bg-cyan-700 text-white"
                        >
                          {addingTorrentLink === (item.downloadUrl || item.link) ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Ajout...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Ajouter au client
                            </>
                          )}
                        </Button>

                        {item.quality && (
                          <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                            Qualité: {item.quality}
                          </Badge>
                        )}
                        {item.language && (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                            Langue: {item.language}
                          </Badge>
                        )}
                        {item.sizeHuman && (
                          <Badge variant="outline" className="border-white/30 text-white/80">
                            Taille: {item.sizeHuman}
                          </Badge>
                        )}
                        {Number.isFinite(item.seeders || NaN) && (item.seeders || 0) >= 0 && (
                          <Badge variant="outline" className="border-lime-500/40 text-lime-300">
                            Seeders: {item.seeders}
                          </Badge>
                        )}
                        {Number.isFinite(item.leechers || NaN) && (item.leechers || 0) >= 0 && (
                          <Badge variant="outline" className="border-orange-500/40 text-orange-300">
                            Peers: {item.leechers}
                          </Badge>
                        )}
                      </div>

                      {Array.isArray(item.categories) && item.categories.length > 0 && (
                        <p className="text-xs text-white/50 line-clamp-1">
                          Catégories: {item.categories.join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
              {inWishlist ? 'Retirer de ma liste' : 'Ajouter à ma liste'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}