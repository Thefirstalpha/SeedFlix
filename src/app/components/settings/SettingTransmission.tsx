import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/LanguageProvider";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { TransmissionSettings } from "../../../../common/settings";
import { configureTransmission } from "../../services/settingService";
import { Switch } from "../ui/switch";



export function SettingTransmission({ setup, onComplete }: { setup: boolean; onComplete: (() => void) | undefined }) {
    const { t } = useI18n();
    const [torrentUrl, setTorrentUrl] = useState('');
    const [torrentPort, setTorrentPort] = useState<number | null>(null);
    const [torrentAuthRequired, setTorrentAuthRequired] = useState(false);
    const [torrentUsername, setTorrentUsername] = useState('');
    const [torrentPassword, setTorrentPassword] = useState('');
    const [torrentMoviesFolder, setTorrentMoviesFolder] = useState('');
    const [torrentSeriesFolder, setTorrentSeriesFolder] = useState('');
    const [torrentMessage, setTorrentMessage] = useState<string | null>(null);
    const [torrentError, setTorrentError] = useState<string | null>(null);
    const [isTorrentSaving, setIsTorrentSaving] = useState(false);


    const handleTorrentSave = async (event: React.FormEvent) => {
        event.preventDefault();
        setTorrentError(null);
        setIsTorrentSaving(true);
        setTorrentMessage(null);

        const transmissionSettings: TransmissionSettings = {
            host: torrentUrl,
            port: torrentPort || 0,
            authRequired: torrentAuthRequired,
            username: torrentAuthRequired ? torrentUsername : '',
            password: torrentAuthRequired ? torrentPassword : '',
            moviesFolder: torrentMoviesFolder,
            seriesFolder: torrentSeriesFolder,
        };
        try {
            await configureTransmission(transmissionSettings);
            setTorrentMessage(t('settings.messages.configurationSaved'));
            onComplete?.();
        } catch (submitError) {
            setTorrentError(
                submitError instanceof Error
                    ? t('settings.messages.configurationFailed', { reason: submitError.message })
                    : t('settings.messages.savedButTestFailed')
            );
        } finally {
            setIsTorrentSaving(false);
        }
    };


    useEffect(() => {
        fetch(`/api/transmission/configure`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
        }).then(async (response) => {
            if (response.ok) {
                const data: TransmissionSettings = await response.json();
                if (data != null) {
                    setTorrentUrl(data.host || '');
                    setTorrentPort(data.port);
                    setTorrentAuthRequired(data.authRequired || false);
                    setTorrentUsername(data.username || '');
                    setTorrentPassword(data.authRequired && data.username ? '***********' : '');
                    setTorrentMoviesFolder(data.moviesFolder || '');
                    setTorrentSeriesFolder(data.seriesFolder || '');
                } else {
                    setTorrentUrl('');
                    setTorrentPort(null);
                    setTorrentAuthRequired(false);
                    setTorrentUsername('');
                    setTorrentPassword('');
                    setTorrentMoviesFolder('');
                    setTorrentSeriesFolder('');
                }
            }
        })
    }, [t]);

    return (
        <Card className="border-blue-500/30 bg-blue-950/15 text-white mt-6">
            <CardHeader>
                <CardTitle className="text-blue-200">{t('settings.api.torrent.title')}</CardTitle>
                <CardDescription className="text-blue-100/70">
                    {t('settings.api.torrent.description')}
                </CardDescription>
            </CardHeader>
            <CardContent>

                <form onSubmit={handleTorrentSave} className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="setup-torrent-url">{t('setup.torrent.url')}</Label>
                            <Input
                                id="setup-torrent-url"
                                value={torrentUrl}
                                onChange={(event) => setTorrentUrl(event.target.value)}
                                placeholder={t('setup.torrent.urlPlaceholder')}
                                className="border-white/10 bg-slate-900 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="setup-torrent-port">{t('setup.torrent.port')}</Label>
                            <Input
                                id="setup-torrent-port"
                                value={torrentPort !== null ? torrentPort : ''}
                                onChange={(e) => setTorrentPort(Number(e.target.value))}
                                placeholder={t('setup.torrent.portPlaceholder')}
                                className="border-white/10 bg-slate-900 text-white"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                        <div>
                            <p className="font-medium text-white">{t('setup.torrent.authRequired')}</p>
                            <p className="text-sm text-white/55">{t('setup.torrent.authDescription')}</p>
                        </div>
                        <Switch checked={torrentAuthRequired} onCheckedChange={setTorrentAuthRequired} />
                    </div>

                    {torrentAuthRequired ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="setup-torrent-username">{t('setup.torrent.username')}</Label>
                                <Input
                                    id="setup-torrent-username"
                                    value={torrentUsername}
                                    onChange={(event) => setTorrentUsername(event.target.value)}
                                    className="border-white/10 bg-slate-900 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="setup-torrent-password">{t('setup.torrent.password')}</Label>
                                <Input
                                    id="setup-torrent-password"
                                    type="password"
                                    value={torrentPassword}
                                    onChange={(event) => setTorrentPassword(event.target.value)}
                                    className="border-white/10 bg-slate-900 text-white"
                                />
                            </div>
                        </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="setup-movies-folder">{t('setup.torrent.moviesFolder')}</Label>
                            <Input
                                id="setup-movies-folder"
                                value={torrentMoviesFolder}
                                onChange={(event) => setTorrentMoviesFolder(event.target.value)}
                                placeholder={t('setup.torrent.moviesFolderPlaceholder')}
                                className="border-white/10 bg-slate-900 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="setup-series-folder">{t('setup.torrent.seriesFolder')}</Label>
                            <Input
                                id="setup-series-folder"
                                value={torrentSeriesFolder}
                                onChange={(event) => setTorrentSeriesFolder(event.target.value)}
                                placeholder={t('setup.torrent.seriesFolderPlaceholder')}
                                className="border-white/10 bg-slate-900 text-white"
                            />
                        </div>
                    </div>

                    {torrentError ? <p className="text-sm text-red-300">{torrentError}</p> : null}
                    {setup ? (
                        <div className="flex items-center justify-end gap-3">
                            <Button
                                type="submit"
                                disabled={isTorrentSaving}
                                className="bg-cyan-600 text-white hover:bg-cyan-700"
                            >
                                {isTorrentSaving
                                    ? t('setup.torrent.testing')
                                    : t('setup.torrent.testAndContinue')}
                            </Button>
                        </div>
                    ) :
                        (

                            <Button
                                type="submit"
                                disabled={isTorrentSaving}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {isTorrentSaving
                                    ? t('settings.api.common.savingAndTesting')
                                    : t('settings.api.common.saveAndTest')}
                            </Button>
                        )}
                </form>
            </CardContent>
        </Card>
    );
}
