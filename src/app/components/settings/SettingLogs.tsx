import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  Copy,
  Pause,
  Play,
  RefreshCw,
  Search,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useI18n } from '../../i18n/LanguageProvider';
import { getLogs } from '../../services/adminService';
import { AnsiLine, extractLogLevel, stripAnsi, type LogLevel } from '../../utils/ansi';

type FilterLevel = LogLevel | 'ALL';

const LOG_LEVELS: FilterLevel[] = ['ALL', 'HTTP', 'INFO', 'WARN', 'ERROR', 'LOG'];

export function SettingLogs() {
  const { t } = useI18n();

  const [logs, setLogs] = useState<string[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<FilterLevel>('ALL');

  const viewportRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(autoScroll);
  autoScrollRef.current = autoScroll;

  const prevLogsRef = useRef<string[]>([]);

  // Silent log fetching to ensure 100% fluent refresh without UI flicker
  const fetchLogs = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsFetching(true);
    }
    try {
      const { logs: newLogs } = await getLogs();
      const currentPrev = prevLogsRef.current;

      // Only update state if logs actually changed to avoid unnecessary re-renders
      const hasChanged =
        currentPrev.length !== newLogs.length ||
        (newLogs.length > 0 && currentPrev[currentPrev.length - 1] !== newLogs[newLogs.length - 1]);

      if (hasChanged) {
        prevLogsRef.current = newLogs;
        setLogs(newLogs);
      }
    } catch (err) {
      console.error('Failed to fetch server logs:', err);
    } finally {
      setIsInitialLoading(false);
      if (isManual) {
        setIsFetching(false);
      }
    }
  }, []);

  // Polling effect every 2 seconds
  useEffect(() => {
    void fetchLogs();

    if (isPaused) return;

    const interval = setInterval(() => {
      void fetchLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchLogs, isPaused]);

  // Handle user scroll detection
  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
    setShowScrollBottom(!isAtBottom);

    if (!isAtBottom && autoScrollRef.current) {
      // User scrolled up, don't force them back down
      setAutoScroll(false);
    }
  }, []);

  // Filter logs by search query and log level
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedLevel !== 'ALL') {
        const level = extractLogLevel(log);
        if (level !== selectedLevel) return false;
      }

      if (searchQuery.trim() !== '') {
        const plainText = stripAnsi(log);
        if (!plainText.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedLevel, searchQuery]);

  // Auto-scroll when logs update if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const scrollToBottom = () => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setAutoScroll(true);
      setShowScrollBottom(false);
    }
  };

  const handleCopyLogs = async () => {
    const textToCopy = filteredLogs.map((l) => stripAnsi(l)).join('\n');
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  const handleClearView = () => {
    setLogs([]);
    prevLogsRef.current = [];
  };

  const getLevelBadgeClass = (level: FilterLevel) => {
    const isSelected = selectedLevel === level;
    switch (level) {
      case 'HTTP':
        return isSelected
          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 ring-1 ring-cyan-500/40'
          : 'text-cyan-400/80 hover:bg-cyan-500/10 border-cyan-500/30';
      case 'INFO':
        return isSelected
          ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 ring-1 ring-purple-500/40'
          : 'text-purple-400/80 hover:bg-purple-500/10 border-purple-500/30';
      case 'WARN':
        return isSelected
          ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/60 ring-1 ring-yellow-500/40'
          : 'text-yellow-400/80 hover:bg-yellow-500/10 border-yellow-500/30';
      case 'ERROR':
        return isSelected
          ? 'bg-red-500/20 text-red-300 border-red-500/60 ring-1 ring-red-500/40'
          : 'text-red-400/80 hover:bg-red-500/10 border-red-500/30';
      case 'LOG':
        return isSelected
          ? 'bg-slate-500/20 text-slate-300 border-slate-500/60 ring-1 ring-slate-500/40'
          : 'text-slate-400 hover:bg-slate-500/10 border-slate-500/30';
      default:
        return isSelected
          ? 'bg-emerald-600 text-white border-emerald-500'
          : 'text-white/70 hover:bg-white/10 border-white/15';
    }
  };

  return (
    <Card className="border-red-500/30 bg-red-950/15 text-white">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-red-400" />
              <CardTitle className="text-red-200">{t('settings.logs.title')}</CardTitle>
              {isPaused ? (
                <Badge
                  variant="outline"
                  className="bg-amber-500/15 text-amber-300 border-amber-500/30 flex items-center gap-1.5 py-0.5 px-2 text-xs"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {t('settings.logs.paused')}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 flex items-center gap-1.5 py-0.5 px-2 text-xs"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {t('settings.logs.live')}
                </Badge>
              )}
            </div>
            <CardDescription className="text-white/60 mt-1">
              {filteredLogs.length === logs.length
                ? t('settings.logs.linesCount', { count: logs.length })
                : `${filteredLogs.length} / ${logs.length} ${t('settings.logs.linesCount', { count: logs.length }).replace(/^[0-9]+\s*/, '')}`}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAutoScroll((prev) => !prev)}
              className={`border-white/15 text-xs h-8 ${
                autoScroll
                  ? 'bg-red-500/20 text-red-200 border-red-500/40 hover:bg-red-500/30'
                  : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              title={t('settings.logs.autoScroll')}
            >
              <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
              {t('settings.logs.autoScroll')}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPaused((prev) => !prev)}
              className="border-white/15 bg-transparent text-white/80 hover:bg-white/10 hover:text-white text-xs h-8"
              title={isPaused ? t('settings.logs.resume') : t('settings.logs.pause')}
            >
              {isPaused ? (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                  {t('settings.logs.resume')}
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                  {t('settings.logs.pause')}
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLogs}
              disabled={filteredLogs.length === 0}
              className="border-white/15 bg-transparent text-white/80 hover:bg-white/10 hover:text-white text-xs h-8"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                  {t('settings.logs.copied')}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  {t('settings.logs.copy')}
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearView}
              disabled={logs.length === 0}
              className="border-white/15 bg-transparent text-white/80 hover:bg-white/10 hover:text-white text-xs h-8"
              title={t('settings.logs.clear')}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5 text-red-400" />
              {t('settings.logs.clear')}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchLogs(true)}
              disabled={isFetching}
              className="border-white/15 bg-transparent text-white/80 hover:bg-white/10 hover:text-white text-xs h-8"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Search and Level Filter Row */}
        <div className="mt-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            <Input
              type="text"
              placeholder={t('settings.logs.filterPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-8 text-xs bg-slate-900/80 border-white/10 text-white placeholder:text-white/40 focus:border-red-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Level selector pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {LOG_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setSelectedLevel(level)}
                className={`text-xs px-2.5 py-1 rounded-md border font-mono font-medium transition-all ${getLevelBadgeClass(
                  level,
                )}`}
              >
                {level === 'ALL' ? t('settings.logs.allLevels') : level}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="relative rounded-xl border border-white/10 bg-slate-950/90 shadow-2xl overflow-hidden">
          {/* Terminal Window Header Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-slate-900/60 select-none">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/70 inline-block" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70 inline-block" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70 inline-block" />
              <span className="text-[11px] font-mono text-white/40 ml-2">server-output.log</span>
            </div>
            <div className="text-[11px] font-mono text-white/40">
              {filteredLogs.length} {t('settings.logs.linesCount', { count: filteredLogs.length }).replace(/^[0-9]+\s*/, '')}
            </div>
          </div>

          {/* Terminal Content Viewport */}
          <div
            ref={viewportRef}
            onScroll={handleScroll}
            className="h-[480px] max-h-[650px] overflow-y-auto p-2 scroll-smooth selection:bg-red-500/30 selection:text-white"
          >
            {isInitialLoading && logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/50 font-mono text-sm gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-red-400" />
                {t('common.loading')}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/40 font-mono text-sm py-12 gap-2">
                <Terminal className="h-8 w-8 text-white/20" />
                <p>{logs.length === 0 ? t('settings.logs.noLogs') : t('settings.logs.noMatchingLogs')}</p>
              </div>
            ) : (
              <div className="py-1">
                {filteredLogs.map((log, index) => (
                  <AnsiLine
                    key={`${index}-${log.length}`}
                    line={log}
                    lineNumber={index + 1}
                    highlightText={searchQuery}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Floating Jump to Bottom Button */}
          {showScrollBottom && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 bg-red-600/90 hover:bg-red-500 text-white text-xs font-mono px-3 py-1.5 rounded-full shadow-lg border border-red-400/30 flex items-center gap-1.5 backdrop-blur transition-all animate-bounce"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              {t('settings.logs.jumpToBottom')}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}