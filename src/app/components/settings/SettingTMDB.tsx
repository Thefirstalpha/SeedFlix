import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useI18n } from "../../i18n/LanguageProvider";
import { configureTmdb } from "../../services/settingService";
import { Button } from "../ui/button";



export function SettingTMDB() {
    const { t } = useI18n();
    const [tmdbApiKey, setTmdbApiKey] = useState<string>('');
    const [tmdbMessage, setTmdbMessage] = useState<string | null>(null);
    const [tmdbError, setTmdbError] = useState<string | null>(null);
    const [isTmdbSaving, setIsTmdbSaving] = useState(false);


    const handleTmdbSave = async (event: React.FormEvent) => {
        event.preventDefault();
        setTmdbMessage(null);
        setTmdbError(null);
        setIsTmdbSaving(true);

        if (!tmdbApiKey.trim()) {
            setTmdbError(t('settings.messages.tmdbKeyRequired'));
            setIsTmdbSaving(false);
            return;
        }
        try {
            await configureTmdb(tmdbApiKey.trim());
            setTmdbMessage(t('settings.messages.tmdbSaved'));
        } catch (error) {
            setTmdbError(t('settings.messages.configFailed'));
        } finally {
            setIsTmdbSaving(false);
        }
    };

    useEffect(() => {
        fetch(`/api/tmdb/configure`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
        }).then(async (response) => {
            if (response.ok) {
                const data = await response.json();
                if (data.ok) {
                    setTmdbApiKey('******************************');
                } else {
                    setTmdbApiKey('');
                }
            }
        })
    }, [t]);

    return (
        <Card className="border-blue-500/30 bg-blue-950/15 text-white">
            <CardHeader>
                <CardTitle className="text-blue-200">{t('settings.api.tmdb.title')}</CardTitle>
                <CardDescription className="text-blue-100/70">
                    {t('settings.api.tmdb.description')}{' '}
                    <a
                        href="https://www.themoviedb.org/settings/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-300 hover:text-blue-200"
                    >
                        themoviedb.org
                    </a>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleTmdbSave} className="space-y-6 max-w-lg">
                    <div className="space-y-2">
                        <Label htmlFor="tmdb-api-key">{t('settings.api.tmdb.apiToken')}</Label>
                        <Input
                            id="tmdb-api-key"
                            type="password"
                            placeholder={t('settings.api.tmdb.placeholder')}
                            value={tmdbApiKey}
                            onChange={(event) => setTmdbApiKey(event.target.value)}
                            className="bg-slate-900 border-white/10 text-white"
                        />
                    </div>

                    {tmdbMessage && <p className="text-sm text-emerald-300">{tmdbMessage}</p>}
                    {tmdbError && <p className="text-sm text-red-300">{tmdbError}</p>}

                    <Button
                        type="submit"
                        disabled={isTmdbSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isTmdbSaving ? t('common.saving') : t('settings.api.tmdb.save')}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}