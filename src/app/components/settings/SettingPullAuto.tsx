import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { useI18n } from "../../i18n/LanguageProvider";
import { getPullAuto, updatePullAuto } from "../../services/settingService";
import { Switch } from "../ui/switch";



export function SettingPullAuto() {
    const { t } = useI18n();
    const [pullAuto, setPullAuto] = useState<boolean>(false);
    const [pullAutoMessage, setPullAutoMessage] = useState<string | null>(null);
    const [pullAutoError, setPullAutoError] = useState<string | null>(null);
    const [isPullAutoSaving, setIsPullAutoSaving] = useState(false);


    const handlePullAutoChange = async (value: boolean) => {
        setPullAutoMessage(null);
        setPullAutoError(null);
        setIsPullAutoSaving(true);

        try {
            await updatePullAuto(value);
            setPullAutoMessage(t('settings.pullAuto.saved'));
            setPullAuto(value);
        } catch (error) {
            console.error('Erreur lors de la mise à jour de Pull Auto :', error);
            setPullAutoError(t('settings.pullAuto.failed'));
        } finally {
            setIsPullAutoSaving(false);
        }
    };

    useEffect(() => {
        getPullAuto().then((value) => {
            setPullAuto(value);
        }).catch((error) => {
            console.error('Erreur lors de la récupération de Pull Auto :', error);
            setPullAutoError(t('settings.pullAuto.failed'));
        });
    }, [t]);

    return (
        <Card className="border-blue-500/30 bg-blue-950/15 text-white">
            <CardHeader>
                <CardTitle className="text-blue-200">{t('settings.pullAuto.title')}</CardTitle>
                <CardDescription className="text-blue-100/70">{t('settings.pullAuto.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-5 max-w-lg"></div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-4 py-3 gap-4">
                    <div>
                        <p className="font-medium text-white">{t('settings.pullAuto.toggleLabel')}</p>
                        <p className="text-sm text-white/55">{t('settings.pullAuto.toggleHelp')}</p>
                    </div>
                    <Switch
                        checked={pullAuto}
                        onCheckedChange={(checked) => void handlePullAutoChange(Boolean(checked))}
                        disabled={isPullAutoSaving}
                    />
                </div>
                {pullAutoMessage && <p className="text-sm text-emerald-300">{pullAutoMessage}</p>}
                {pullAutoError && <p className="text-sm text-red-300">{pullAutoError}</p>}
            </CardContent>
        </Card>
    );
}