import {
    usersStore,
} from '../db.js';
import FTPClient from 'basic-ftp';
import { withAuth } from './auth.js';

/**
 * Récupère la configuration FTP depuis les settings.
 */
export async function getFtpConfig() {
    const settings = await getSettings();
    return settings.ftp || {};
}

/**
 * Sauvegarde la configuration FTP dans les settings.
 */
export async function saveFtpConfig(ftpConfig) {
    const settings = await getSettings();
    settings.ftp = ftpConfig;
    await saveSettings(settings);
    return settings.ftp;
}

/**
 * Teste la connexion FTP(S) avec la configuration fournie.
 */
export async function testFtpConnection(ftpConfig) {
    const client = new FTPClient.Client();
    client.ftp.verbose = false;
    try {
        await client.access({
            host: ftpConfig.url,
            port: Number(ftpConfig.port) || 21,
            user: ftpConfig.username || undefined,
            password: ftpConfig.password || undefined,
            secure: !!ftpConfig.secure,
        });
        await client.close();
        return { ok: true };
    } catch (err) {
        await client.close();
        return { ok: false, error: err.message };
    }
}


// Enregistrer les routes
export function registerFtpRoutes(app) {
    // GET la config FTP actuelle
    app.get('/api/ftp/config', async (req, res) => {
        try {
            const config = await getFtpConfig();
            res.json({ ok: true, config });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    // POST pour sauvegarder la config FTP
    app.post('/api/ftp/config', async (req, res) => {
        try {
            const config = await saveFtpConfig(req.body);
            res.json({ ok: true, config });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    // POST pour tester la connexion FTP
    app.post('/api/ftp/test', withAuth(async (req, res, auth) => {
        try {
            const result = await testFtpConnection(req.body);
            res.json({ ok: true, targets });
        } catch (error) {
            res.status(500).json({ ok: false, error: error.message });
        }
    }));
}