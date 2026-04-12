import React from 'react';
import { Button } from './ui/button';

interface DatabaseNamespaceListProps {
  t: (key: string, options?: any) => string;
  isLoading: boolean;
  namespaces: Array<{ namespace: string; updatedAt?: string }>;
  selectedNamespace: string | null;
  onReload: () => void;
  onSelect: (namespace: string) => void;
}

export const DatabaseNamespaceList: React.FC<DatabaseNamespaceListProps> = ({
  t,
  isLoading,
  namespaces,
  selectedNamespace,
  onReload,
  onSelect,
}) => (
  <div className="w-full space-y-3 rounded-lg border border-white/10 bg-slate-900/40 p-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-medium text-white">{t('settings.database.namespaces')}</h3>
      <Button
        type="button"
        variant="outline"
        onClick={() => onReload()}
        className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
      >
        {t('settings.database.refreshList')}
      </Button>
    </div>

    {isLoading ? (
      <p className="text-sm text-white/60">{t('common.loading')}</p>
    ) : namespaces.length === 0 ? (
      <p className="text-sm text-white/60">{t('settings.database.empty')}</p>
    ) : (
      <div className="space-y-2">
        {namespaces.map((entry) => (
          <button
            key={entry.namespace}
            type="button"
            onClick={() => onSelect(entry.namespace)}
            className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
              selectedNamespace === entry.namespace
                ? 'border-teal-400/40 bg-teal-500/15 text-teal-100'
                : 'border-white/10 bg-slate-950/50 text-white/80 hover:bg-white/5'
            }`}
          >
            <p className="font-mono text-sm">{entry.namespace}</p>
            <p className="mt-1 text-xs text-white/50">
              {t('settings.database.updatedAt', { value: entry.updatedAt || '-' })}
            </p>
          </button>
        ))}
      </div>
    )}
  </div>
);
