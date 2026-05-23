import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/LanguageProvider";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { TransmissionSettings } from "../../../../common/settings";
import { configureTransmission } from "../../services/settingService";



export function SettingTransmission() {
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
                const data : TransmissionSettings = await response.json();
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
                <form onSubmit={handleTorrentSave} className="space-y-4 max-w-lg">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="torrent-url">{t('settings.api.torrent.url')}</Label>
                            <Input
                                id="torrent-url"
                                placeholder="http://localhost"
                                value={torrentUrl}
                                onChange={(e) => setTorrentUrl(e.target.value)}
                                className="bg-slate-900 border-white/10 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="torrent-port">{t('settings.api.torrent.port')}</Label>
                            <Input
                                id="torrent-port"
                                type="number"
                                placeholder="6800"
                                value={torrentPort !== null ? torrentPort : ''}
                                onChange={(e) => setTorrentPort(Number(e.target.value))}
                                className="bg-slate-900 border-white/10 text-white"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            id="torrent-auth"
                            type="checkbox"
                            checked={torrentAuthRequired}
                            onChange={(e) => setTorrentAuthRequired(e.target.checked)}
                            className="w-4 h-4 cursor-pointer"
                        />
                        <Label htmlFor="torrent-auth" className="cursor-pointer">
                            {t('settings.api.torrent.authRequired')}
                        </Label>
                    </div>

                    {torrentAuthRequired && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="torrent-username">{t('settings.api.torrent.username')}</Label>
                                <Input
                                    id="torrent-username"
                                    placeholder="admin"
                                    value={torrentUsername}
                                    onChange={(e) => setTorrentUsername(e.target.value)}
                                    className="bg-slate-900 border-white/10 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="torrent-password">{t('settings.api.torrent.password')}</Label>
                                <Input
                                    id="torrent-password"
                                    type="password"
                                    placeholder="••••••"
                                    value={torrentPassword}
                                    onChange={(e) => setTorrentPassword(e.target.value)}
                                    className="bg-slate-900 border-white/10 text-white"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="torrent-movies-folder">
                            {t('settings.api.torrent.moviesFolder')}
                        </Label>
                        <Input
                            id="torrent-movies-folder"
                            placeholder="/downloads/movies"
                            value={torrentMoviesFolder}
                            onChange={(e) => setTorrentMoviesFolder(e.target.value)}
                            className="bg-slate-900 border-white/10 text-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="torrent-series-folder">
                            {t('settings.api.torrent.seriesFolder')}
                        </Label>
                        <Input
                            id="torrent-series-folder"
                            placeholder="/downloads/series"
                            value={torrentSeriesFolder}
                            onChange={(e) => setTorrentSeriesFolder(e.target.value)}
                            className="bg-slate-900 border-white/10 text-white"
                        />
                    </div>

                    {torrentMessage && <p className="text-sm text-emerald-300">{torrentMessage}</p>}
                    {torrentError && <p className="text-sm text-red-300">{torrentError}</p>}

                    <Button
                        type="submit"
                        disabled={isTorrentSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isTorrentSaving
                            ? t('settings.api.common.savingAndTesting')
                            : t('settings.api.common.saveAndTest')}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}