import { SubmitEvent, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';


import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/LanguageProvider';
import { getLogs } from '../../services/adminService';

export function SettingLogs() {

    const { user, refresh } = useAuth();
    const { t } = useI18n();

    const [isLoading, setIsLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const { logs } = await getLogs();
            setLogs(logs);
        } catch (submitError) {
            console.error(submitError);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadLogs();
        // Refresh downloads and stats every 2 seconds
        const interval = setInterval(() => {
            void loadLogs();
        }, 2000);

        return () => clearInterval(interval);
    }, []);


    return (
        <Card className="border-emerald-500/30 bg-emerald-950/15 text-white grid gap-4">
            <CardHeader>
                <CardTitle className="text-emerald-200">Logs</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="text-white/50">{t('common.loading')}</div>
                )}
                <div className="space-y-2">
                    <Textarea
                        id="database-raw-value"
                        value={logs.join('\n')}
                        className="min-h-[420px] bg-slate-950 border-white/10 font-mono text-sm text-white max-h-[600px] overflow-y-auto"
                        spellCheck={false}
                    />
                </div>
            </CardContent>
        </Card>
    );
}