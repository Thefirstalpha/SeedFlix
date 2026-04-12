import React from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

interface DatabaseRawEditorPanelProps {
  t: (key: string, options?: any) => string;
  selectedNamespace: string | null;
  updatedAt?: string | null;
  isLoadingValue: boolean;
  isSavingValue: boolean;
  rawValue: string;
  onRawValueChange: (value: string) => void;
  onReload: () => void;
  onPrettyFormat: () => void;
  onSave: () => void;
  message?: string | null;
  error?: string | null;
}

export const DatabaseRawEditorPanel: React.FC<DatabaseRawEditorPanelProps> = ({
  t,
  selectedNamespace,
  updatedAt,
  isLoadingValue,
  isSavingValue,
  rawValue,
  onRawValueChange,
  onReload,
  onPrettyFormat,
  onSave,
  message,
  error,
}) => (
  <div className="w-full space-y-4 rounded-lg border border-white/10 bg-slate-900/40 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="font-medium text-white">
          {selectedNamespace || t("settings.database.noSelection")}
        </h3>
        <p className="text-sm text-white/60">
          {t("settings.database.updatedAt", { value: updatedAt || "-" })}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void onReload()}
          disabled={!selectedNamespace || isLoadingValue || isSavingValue}
          className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
        >
          {t("settings.database.reload")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onPrettyFormat}
          disabled={!selectedNamespace || isLoadingValue || isSavingValue}
          className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
        >
          {t("settings.database.prettyFormat")}
        </Button>
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={!selectedNamespace || isLoadingValue || isSavingValue}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          {isSavingValue ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="database-raw-value">{t("settings.database.rawEditor")}</Label>
      <Textarea
        id="database-raw-value"
        value={rawValue}
        onChange={(event) => onRawValueChange(event.target.value)}
        disabled={!selectedNamespace || isLoadingValue}
        className="min-h-[420px] bg-slate-950 border-white/10 font-mono text-sm text-white"
        spellCheck={false}
      />
    </div>

    {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
    {error ? <p className="text-sm text-red-300">{error}</p> : null}
  </div>
);