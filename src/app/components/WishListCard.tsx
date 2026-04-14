import { Star, Calendar, Tv, Download } from 'lucide-react';
import { ReactNode } from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  type IndexerResultTarget,
} from '../services/indexerResultService';
import { useAuth } from '../context/AuthContext';
import { getEpisodeCode } from './WishList';
import { useI18n } from '../i18n/LanguageProvider';

interface WishListCardProps {
  poster: string;
  title: string;
  year: number;
  rating: number;
  genre: string;
  type: 'movie' | 'series';
  targets: IndexerResultTarget[];
  actionKey: string | null;
  onRejectIndexerResult: (target: IndexerResultTarget, indexerStateKey: string) => void;
  onRejectAllIndexerResults: (target: IndexerResultTarget) => void;
  onAddTorrent: (target: IndexerResultTarget, torrentUrl: string, indexerStateKey: string) => void;
  children?: ReactNode; // Pour injecter saisons, épisodes, tracker, etc.
}

export function WishListCard({
  poster,
  title,
  year,
  rating,
  genre,
  type,
  targets,
  actionKey,
  onRejectIndexerResult,
  onRejectAllIndexerResults,
  onAddTorrent,
  children,
}: WishListCardProps) {
  const { settings } = useAuth();
  const { t } = useI18n();
  const spoilerModeEnabled = Boolean(
    (settings?.placeholders?.preferences as Record<string, unknown> | undefined)?.spoilerMode,
  );
  const renderIndexerTarget = (target: IndexerResultTarget, stopPropagation = false, actionKey: string | null, onRejectIndexerResult: (target: IndexerResultTarget, indexerStateKey: string) => void, onRejectAllIndexerResults: (target: IndexerResultTarget) => void, onAddTorrent: (target: IndexerResultTarget, torrentUrl: string, indexerStateKey: string) => void) => {

    if (!target.items.length) {
      return null;
    }

    const getSpoilerSafeIndexerLabel = (target: IndexerResultTarget) => {
      if (!spoilerModeEnabled || target.targetType !== 'episode') {
        return target.label || target.title;
      }

      const episodeCode = getEpisodeCode(target.targetKey);
      return episodeCode ? `${target.title} - ${episodeCode}` : target.title;
    };

    return (
      <div
        key={target.targetKey}
        id={`wishlist-target-${encodeURIComponent(target.targetKey)}`}
        className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-3"
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-white font-medium">{getSpoilerSafeIndexerLabel(target)}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="border-white/20 text-white/70">
              {target.items.length}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                if (stopPropagation) {
                  event.stopPropagation();
                }
                onRejectAllIndexerResults(target);
              }}
              disabled={actionKey === `${target.targetKey}:reject-all`}
              className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
            >
              {actionKey === `${target.targetKey}:reject-all`
                ? t('wishlistPage.indexerResults.actions.rejectingAll')
                : t('wishlistPage.indexerResults.actions.rejectAll')}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {target.items.map((item) => {
            const torrentUrl = item.downloadUrl || item.link;
            const addKey = `${target.targetKey}:${item.indexerStateKey}:add`;
            const rejectKey = `${target.targetKey}:${item.indexerStateKey}:reject`;

            return (
              <div
                key={item.indexerStateKey}
                className="rounded border border-white/10 bg-slate-900/60 p-3 space-y-2"
              >
                <p className="text-sm text-white font-medium break-all">{item.title}</p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={(event) => {
                      if (stopPropagation) {
                        event.stopPropagation();
                      }
                      onAddTorrent(target, torrentUrl, item.indexerStateKey);
                    }}
                    disabled={actionKey === addKey}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {actionKey === addKey
                      ? t('wishlistPage.indexerResults.actions.adding')
                      : t('wishlistPage.indexerResults.actions.add')}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      if (stopPropagation) {
                        event.stopPropagation();
                      }
                      onRejectIndexerResult(target, item.indexerStateKey);
                    }}
                    disabled={actionKey === rejectKey}
                    className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
                  >
                    {t('wishlistPage.indexerResults.actions.reject')}
                  </Button>

                  {item.quality ? (
                    <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                      {item.quality}
                    </Badge>
                  ) : null}

                  {item.language ? (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                      {item.language}
                    </Badge>
                  ) : null}

                  {item.sizeHuman ? (
                    <Badge variant="outline" className="border-white/30 text-white/80">
                      {item.sizeHuman}
                    </Badge>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="border-white/10 bg-white/5 transition-all">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-4">
          <img src={poster} alt={title} className="w-16 rounded object-cover aspect-[2/3]" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-lg hover:text-cyan-300 transition-colors">
              {title}
            </p>
            <div className="flex items-center gap-3 text-white/60 text-sm mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {year}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                <span className="font-semibold text-white">{rating}</span>
              </span>
            </div>
            <div className="mt-2">
              <Badge
                className={
                  type === 'series'
                    ? 'bg-cyan-600/20 text-cyan-200 border-cyan-500/30'
                    : 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                }
              >
                {type === 'series' ? <Tv className="w-3 h-3 mr-1" /> : null}
                {genre}
              </Badge>
            </div>
          </div>
        </div>
        {children}

        {targets.length > 0 ? (
          <div
            className="space-y-3"
            onClick={(event) => event.stopPropagation()}
            tabIndex={0}
            role="presentation"
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
              }
            }}
          >
            {targets.map((target) =>
              renderIndexerTarget(
                target,
                true,
                actionKey,
                onRejectIndexerResult,
                onRejectAllIndexerResults,
                onAddTorrent
              )
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
