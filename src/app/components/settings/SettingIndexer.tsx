import { SubmitEvent, useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { useI18n } from "../../i18n/LanguageProvider";
import { IndexerSettings } from "../../../../common/settings";
import { configureIndexer } from "../../services/settingService";


const QUALITY_OPTIONS = ['2160p', '1080p', '720p', '480p'];
const LANGUAGE_OPTIONS = ['VO', 'VFF', 'VF2', 'VFQ', 'VOSTFR', 'MULTI'];

export function SettingIndexer({ setup, onComplete }: Readonly<{ setup: boolean; onComplete?: (() => void) }>) {
    const { t } = useI18n();
    const [indexerUrl, setIndexerUrl] = useState('');
    const [indexerToken, setIndexerToken] = useState('');
    const [indexerQualities, setIndexerQualities] = useState<string[]>(['all']);
    const [indexerLanguages, setIndexerLanguages] = useState<string[]>(['all']);
    const [indexerAutoDownload, setIndexerAutoDownload] = useState(false);
    const [indexerMessage, setIndexerMessage] = useState<string | null>(null);
    const [indexerError, setIndexerError] = useState<string | null>(null);
    const [isIndexerSaving, setIsIndexerSaving] = useState(false);


    const handleIndexerSave = async (event: SubmitEvent) => {
        event.preventDefault();
        setIndexerError(null);
        setIsIndexerSaving(true);
        setIndexerMessage(null);


        const indexerSettings: IndexerSettings = {
            url: indexerUrl,
            token: indexerToken,
            qualities: indexerQualities,
            languages: indexerLanguages,
            autoDownload: indexerAutoDownload,
        };
        try {
            await configureIndexer(indexerSettings);
            setIndexerMessage(t('settings.messages.configurationSaved'));
            onComplete?.();
        } catch (submitError) {
            setIndexerError(
                submitError instanceof Error
                    ? t('settings.messages.configurationFailed', { reason: submitError.message })
                    : t('settings.messages.savedButTestFailed')
            );
        } finally {
            setIsIndexerSaving(false);
        }
    };



    useEffect(() => {
        fetch(`/api/indexer/configure`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
        }).then(async (response) => {
            if (response.ok) {
                const data = await response.json();
                setIndexerUrl(data.url || '');
                setIndexerToken(data.token || '');
                setIndexerQualities(data.qualities || ['all']);
                setIndexerLanguages(data.languages || ['all']);
                setIndexerAutoDownload(Boolean(data.autoDownload));
            }
        })
    }, [t]);

    return (
        <Card className="border-blue-500/30 bg-blue-950/15 text-white mt-6">
            <CardHeader>
                <CardTitle className="text-blue-200">{t('settings.api.indexer.title')}</CardTitle>
                <CardDescription className="text-blue-100/70">
                    {t('settings.api.indexer.description')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleIndexerSave} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="indexer-url">{t('settings.api.indexer.url')}</Label>
                            <Input
                                id="indexer-url"
                                placeholder="https://indexer.example.com"
                                value={indexerUrl}
                                onChange={(e) => setIndexerUrl(e.target.value)}
                                className="bg-slate-900 border-white/10 text-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="indexer-token">{t('settings.api.indexer.token')}</Label>
                            <Input
                                id="indexer-token"
                                type="password"
                                placeholder="••••••••••••••••"
                                value={indexerToken}
                                onChange={(e) => setIndexerToken(e.target.value)}
                                className="bg-slate-900 border-white/10 text-white"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('settings.api.indexer.defaultQuality')}</Label>
                        <div className="flex flex-wrap gap-3">
                            {QUALITY_OPTIONS.map((option) => (
                                <label key={option} className="inline-flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        value={option}
                                        checked={indexerQualities.includes(option)}
                                        onChange={e => {
                                            const checked = e.target.checked;
                                            setIndexerQualities((prev) =>
                                                checked
                                                    ? [...prev, option]
                                                    : prev.filter((v) => v !== option)
                                            );
                                        }}
                                        className="accent-cyan-600"
                                    />
                                    <span>{option}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('settings.api.indexer.defaultLanguage')}</Label>
                        <div className="flex flex-wrap gap-3">
                            {LANGUAGE_OPTIONS.map((option) => (
                                <label key={option} className="inline-flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        value={option}
                                        checked={indexerLanguages.includes(option)}
                                        onChange={e => {
                                            const checked = e.target.checked;
                                            setIndexerLanguages((prev) =>
                                                checked
                                                    ? [...prev, option]
                                                    : prev.filter((v) => v !== option)
                                            );
                                        }}
                                        className="accent-cyan-600"
                                    />
                                    <span>{option}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-900/60 border border-white/10 mt-2">
                        <div className="space-y-0.5 pr-4">
                            <Label htmlFor="indexer-autodownload" className="text-white font-medium cursor-pointer text-sm">
                                Téléchargement automatique (Auto-Grab)
                            </Label>
                            <p className="text-xs text-white/60">
                                Dès qu'une release de votre wishlist est détectée avec la qualité/langue souhaitée, elle est automatiquement envoyée à Transmission.
                            </p>
                        </div>
                        <Switch
                            id="indexer-autodownload"
                            checked={indexerAutoDownload}
                            onCheckedChange={setIndexerAutoDownload}
                        />
                    </div>

                    {indexerMessage && <p className="text-sm text-emerald-300">{indexerMessage}</p>}
                    {indexerError && <p className="text-sm text-red-300">{indexerError}</p>}

                    {setup ? (
                        <div className="flex items-center justify-end gap-3">
                            <Button
                                type="submit"
                                disabled={isIndexerSaving}
                                className="bg-cyan-600 text-white hover:bg-cyan-700"
                            >
                                {isIndexerSaving ? t('settings.testing') : t('settings.testAndSave')}
                            </Button>
                        </div>
                    ) : (
                        <Button
                            type="submit"
                            disabled={isIndexerSaving}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {isIndexerSaving
                                ? t('settings.api.common.savingAndTesting')
                                : t('settings.api.common.saveAndTest')}
                        </Button>
                    )}
                </form>
            </CardContent>
        </Card>
    );
}