import { SubmitEvent, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { getFtpConfig, saveFtpConfig } from '../../services/ftpService';

import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { useI18n } from '../../i18n/LanguageProvider';


export function SettingFtp({ setup, onComplete }: { setup?: boolean; onComplete?: () => void }) {
    const { t } = useI18n();

    // État pour la configuration FTP
    const [ftpHost, setFtpHost] = useState('');
    const [ftpPort, setFtpPort] = useState('21');
    const [ftpSecure, setFtpSecure] = useState(false);
    const [ftpAuthRequired, setFtpAuthRequired] = useState(false);
    const [ftpUsername, setFtpUsername] = useState('');
    const [ftpPassword, setFtpPassword] = useState('');
    const [ftpRootFolder, setFtpRootFolder] = useState('/');
    const [ftpStorageLimit, setFtpStorageLimit] = useState('');
    const [ftpMessage, setFtpMessage] = useState<string | null>(null);
    const [ftpError, setFtpError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        getFtpConfig().then((config) => {
            if (!config) return;
            setFtpHost(config.host || '');
            setFtpPort(String(config.port || 21));
            setFtpSecure(config.secure ?? false);
            setFtpAuthRequired(config.authRequired ?? false);
            setFtpUsername(config.username || '');
            setFtpRootFolder(config.rootFolder || '/');
            setFtpStorageLimit(config.storageLimit !== null ? String(config.storageLimit) : '');
        }).catch(() => { });
    }, []);

    // Tester la connexion ET enregistrer (la validation est faite côté backend)
    const handleSave = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFtpError(null);
        setFtpMessage(null);
        setIsSaving(true);
        try {
            await saveFtpConfig({
                host: ftpHost,
                port: Number(ftpPort) || 21,
                secure: ftpSecure,
                authRequired: ftpAuthRequired,
                username: ftpUsername || undefined,
                password: ftpPassword || undefined,
                rootFolder: ftpRootFolder || '/',
                storageLimit: ftpStorageLimit ? Number(ftpStorageLimit) : null,
            });
            setFtpMessage('Connexion réussie — configuration enregistrée.');
            onComplete?.();
        } catch (e: any) {
            setFtpError(e.message || 'Erreur lors de l\'enregistrement.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="border-cyan-500/30 bg-cyan-950/15 text-white">
            <CardHeader>
                <CardTitle className="text-cyan-200"> {t('settings.tabs.storage')}</CardTitle>
                <CardDescription className="text-cyan-100/70">
                    {t('settings.storage.description')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ftp-host">Hôte FTP</Label>
                        <Input id="ftp-host" type="text" value={ftpHost} onChange={e => setFtpHost(e.target.value)} className="bg-slate-900 border-white/10 text-white" placeholder="monserveur.com" />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="ftp-port">Port</Label>
                            <Input id="ftp-port" type="number" value={ftpPort} onChange={e => setFtpPort(e.target.value)} className="bg-slate-900 border-white/10 text-white" placeholder="21" />
                        </div>
                        <div className="flex-1 space-y-2 flex items-center gap-2 mt-6">
                            <input id="ftp-secure" type="checkbox" checked={ftpSecure} onChange={e => setFtpSecure(e.target.checked)} />
                            <Label htmlFor="ftp-secure">FTPS (SSL/TLS)</Label>
                        </div>
                    </div>
                    <div className="space-y-4 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-white">Authentification requise</p>
                                <p className="text-sm text-white/55">Activez si votre serveur FTP demande un identifiant.</p>
                            </div>
                            <Switch checked={ftpAuthRequired} onCheckedChange={setFtpAuthRequired} />
                        </div>

                        {ftpAuthRequired ? (
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="ftp-username">Nom d'utilisateur</Label>
                                    <Input id="ftp-username" type="text" value={ftpUsername} onChange={e => setFtpUsername(e.target.value)} className="bg-slate-900 border-white/10 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ftp-password">Mot de passe</Label>
                                    <Input id="ftp-password" type="password" value={ftpPassword} onChange={e => setFtpPassword(e.target.value)} className="bg-slate-900 border-white/10 text-white" />
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ftp-root-folder">Dossier racine</Label>
                        <Input id="ftp-root-folder" type="text" value={ftpRootFolder} onChange={e => setFtpRootFolder(e.target.value)} className="bg-slate-900 border-white/10 text-white" placeholder="/" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ftp-storage-limit">Limite de stockage (Go)</Label>
                        <Input id="ftp-storage-limit" type="number" min="0" value={ftpStorageLimit} onChange={e => setFtpStorageLimit(e.target.value)} className="bg-slate-900 border-white/10 text-white" placeholder="100" />
                    </div>
                    {ftpMessage && <p className="text-sm text-emerald-300">{ftpMessage}</p>}
                    {ftpError && <p className="text-sm text-red-300">{ftpError}</p>}

                    {setup ? (
                        <div className="flex items-center justify-end gap-3">
                            <Button disabled={isSaving} className="bg-gray-600 hover:bg-gray-700 text-white" onClick={onComplete}>
                                {t('setup.skip')}
                            </Button>
                            <Button type="submit" disabled={isSaving} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                                {isSaving ? t('settings.testing') : t('settings.testAndSave')}
                            </Button>
                        </div>
                    ) : (
                        <Button type="submit" disabled={isSaving} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                            {isSaving ? t('settings.testing') : t('settings.testAndSave')}
                        </Button>
                    )}
                </form>
            </CardContent>
        </Card>
    )
};