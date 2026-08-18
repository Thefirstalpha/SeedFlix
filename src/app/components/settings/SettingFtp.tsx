import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { testFtpConnection } from '../../services/ftpService';


import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useI18n, type SupportedLanguage } from '../../i18n/LanguageProvider';


export function SettingFtp() {
    const { t } = useI18n();


    // État pour la configuration FTP
    const [ftpUrl, setFtpUrl] = useState('');
    const [ftpPort, setFtpPort] = useState('21');
    const [ftpSecure, setFtpSecure] = useState(false);
    const [ftpAuthRequired, setFtpAuthRequired] = useState(false);
    const [ftpUsername, setFtpUsername] = useState('');
    const [ftpPassword, setFtpPassword] = useState('');
    const [ftpRootFolder, setFtpRootFolder] = useState('');
    const [ftpStorageLimit, setFtpStorageLimit] = useState('');
    const [ftpMessage, setFtpMessage] = useState<string | null>(null);
    const [ftpError, setFtpError] = useState<string | null>(null);
    const [isFtpSaving, setIsFtpSaving] = useState(false);
    const [isFtpTesting, setIsFtpTesting] = useState(false);


    // Construction du payload FTP pour sauvegarde
    const buildFtpSettingsPayload = () => ({
        url: ftpUrl,
        port: ftpPort,
        secure: ftpSecure,
        authRequired: ftpAuthRequired,
        username: ftpUsername,
        password: ftpPassword,
        rootFolder: ftpRootFolder,
        storageLimit: ftpStorageLimit,
    });

    // Gestion de la sauvegarde FTP
    const handleSaveFtpSettings = (event?: React.FormEvent) => {
        handleAsyncSave({
            event,
            setError: setFtpError,
            setMessage: setFtpMessage,
            setSaving: setIsFtpSaving,
            doSave: async () => {
                const config = buildFtpSettingsPayload();
                await saveFtpConfig(config);
                return config;
            },
            successMessage: 'Configuration FTP enregistrée.',
            errorMessage: 'Erreur lors de la sauvegarde FTP.',
        });
    };

    // Test de connexion FTP
    const handleTestFtpConnection = async (event?: React.FormEvent) => {
        if (event) event.preventDefault();
        setFtpError(null);
        setFtpMessage(null);
        setIsFtpTesting(true);
        try {
            const config = buildFtpSettingsPayload();
            const result = await testFtpConnection(config);
            if (result.ok) {
                setFtpMessage('Connexion FTP réussie.');
            } else {
                setFtpError(result.error || 'Échec de la connexion FTP.');
            }
        } catch (e: any) {
            setFtpError(e.message || 'Erreur lors du test FTP.');
        } finally {
            setIsFtpTesting(false);
        }
    };

    return (
        <Card className="border-cyan-500/30 bg-cyan-950/15 text-white max-w-lg">
            <CardHeader>
                <CardTitle className="text-cyan-200"> {t('settings.tabs.storage')}</CardTitle>
                <CardDescription className="text-cyan-100/70">
                    {t('settings.storage.description')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSaveFtpSettings} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ftp-url">URL FTP</Label>
                        <Input id="ftp-url" type="text" value={ftpUrl} onChange={e => setFtpUrl(e.target.value)} className="bg-slate-900 border-white/10 text-white" placeholder="ftp://monserveur.com" />
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
                    <div className="space-y-2 flex items-center gap-2">
                        <input id="ftp-auth-required" type="checkbox" checked={ftpAuthRequired} onChange={e => setFtpAuthRequired(e.target.checked)} />
                        <Label htmlFor="ftp-auth-required">Authentification requise</Label>
                    </div>
                    {ftpAuthRequired && (
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="ftp-username">Nom d'utilisateur</Label>
                                <Input id="ftp-username" type="text" value={ftpUsername} onChange={e => setFtpUsername(e.target.value)} className="bg-slate-900 border-white/10 text-white" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="ftp-password">Mot de passe</Label>
                                <Input id="ftp-password" type="password" value={ftpPassword} onChange={e => setFtpPassword(e.target.value)} className="bg-slate-900 border-white/10 text-white" />
                            </div>
                        </div>
                    )}
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
                    <Button type="submit" disabled={isFtpSaving} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                        {isFtpSaving ? 'Enregistrement...' : 'Enregistrer'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
};