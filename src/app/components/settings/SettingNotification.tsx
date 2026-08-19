import { SubmitEvent, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';


import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useI18n } from '../../i18n/LanguageProvider';
import { sendTestNotification } from '../../services/notificationService';
import { configureDiscord } from '../../services/settingService';

export function SettingNotification() {
    const { t } = useI18n();
    const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
    const [discordTested, setDiscordTested] = useState(false);
    const [discordFormOpen, setDiscordFormOpen] = useState(false);
    const [discordMessage, setDiscordMessage] = useState<string | null>(null);
    const [discordError, setDiscordError] = useState<string | null>(null);
    const [isDiscordSaving, setIsDiscordSaving] = useState(false);
    const [testNotifMessage, setTestNotifMessage] = useState<string | null>(null);
    const [testNotifError, setTestNotifError] = useState<string | null>(null);
    const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);



    const handleDiscordSave = async (event: SubmitEvent) => {
        event.preventDefault();
        setDiscordError(null);
        setDiscordMessage(null);
        setIsDiscordSaving(true);

        try {
            // Validation
            if (!discordWebhookUrl.trim()) {
                setDiscordError(t('settings.messages.discordWebhookRequired'));
                setIsDiscordSaving(false);
                return;
            }

            await configureDiscord({ webhookUrl: discordWebhookUrl });
            setDiscordTested(true);
            setDiscordMessage(t('settings.messages.discordConfigured'));
            // Fermer le formulaire
            setDiscordFormOpen(false);
        } catch (submitError) {
            setDiscordError(
                submitError instanceof Error ? submitError.message : t('settings.messages.configFailed'),
            );
        } finally {
            setIsDiscordSaving(false);
        }
    };

    const handleSendTestNotification = async () => {
    setTestNotifError(null);
    setTestNotifMessage(null);
    setIsSendingTestNotif(true);

    try {
      const response = await sendTestNotification();
      setTestNotifMessage(response.message || t('settings.messages.testNotificationSent'));
      window.dispatchEvent(new CustomEvent('seedflix:notifications-refresh-request'));
    } catch (submitError) {
      setTestNotifError(
        submitError instanceof Error
          ? submitError.message
          : t('settings.messages.testNotificationFailed'),
      );
    } finally {
      setIsSendingTestNotif(false);
    }
  };

    return (
        <Card className="border-purple-500/30 bg-purple-950/15 text-white">
            <CardHeader>
                <CardTitle className="text-purple-200">{t('settings.notifications.title')}</CardTitle>
                <CardDescription className="text-purple-100/70">
                    {t('settings.notifications.description')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleDiscordSave} className="space-y-6 max-w-lg">
                    <div
                        className={`space-y-4 p-4 bg-slate-800/50 rounded-md border border-purple-500/20 ${discordFormOpen ? '' : 'cursor-pointer'
                            }`}
                        onClick={() => {
                            if (!discordFormOpen) {
                                setDiscordFormOpen(true);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (!discordFormOpen && (e.key === 'Enter' || e.key === ' ')) {
                                setDiscordFormOpen(true);
                            }
                        }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h4 className="font-medium text-white">
                                    {t('settings.notifications.discord.title')}
                                </h4>
                                <p className="text-sm text-purple-200/70">
                                    {t('settings.notifications.discord.description')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDiscordFormOpen(true)}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${discordTested
                                    ? 'bg-emerald-600 text-white hover:bg-blue-600'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                {discordTested
                                    ? t('settings.notifications.discord.enabled')
                                    : t('settings.notifications.discord.configure')}
                            </button>
                        </div>

                        {discordFormOpen && (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label htmlFor="discord-webhook">
                                        {t('settings.notifications.discord.webhookLabel')}
                                    </Label>
                                    <Input
                                        id="discord-webhook"
                                        type="password"
                                        placeholder="https://discord.com/api/webhooks/..."
                                        value={discordWebhookUrl}
                                        onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                                        className="bg-slate-900 border-white/10 text-white"
                                    />
                                    <p className="text-xs text-slate-400">
                                        {t('settings.notifications.discord.webhookHelp')}
                                    </p>
                                </div>

                                {discordMessage && (
                                    <p className="text-sm text-purple-300 p-2 bg-purple-900/30 rounded">
                                        ✓ {discordMessage}
                                    </p>
                                )}
                                {discordError && (
                                    <p className="text-sm text-red-300 p-2 bg-red-900/30 rounded">
                                        ✗ {discordError}
                                    </p>
                                )}

                                <div className="flex gap-2">
                                    <Button
                                        type="submit"
                                        disabled={isDiscordSaving || !discordWebhookUrl.trim()}
                                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                                    >
                                        {isDiscordSaving
                                            ? t('settings.notifications.discord.testing')
                                            : t('settings.notifications.discord.testAndSave')}
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            setDiscordFormOpen(false);
                                            setDiscordError(null);
                                        }}
                                        disabled={isDiscordSaving}
                                        variant="ghost"
                                        className="border border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"
                                    >
                                        {t('common.cancel')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 p-4 bg-slate-800/50 rounded-md border border-purple-500/20">
                        <div>
                            <h4 className="font-medium text-white">
                                {t('settings.notifications.test.title')}
                            </h4>
                            <p className="text-sm text-purple-200/70">
                                {t('settings.notifications.test.description')}
                            </p>
                        </div>

                        <Button
                            type="button"
                            onClick={handleSendTestNotification}
                            disabled={isSendingTestNotif}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {isSendingTestNotif
                                ? t('settings.notifications.test.sending')
                                : t('settings.notifications.test.trigger')}
                        </Button>

                        {testNotifMessage && (
                            <p className="text-sm text-emerald-300 p-2 bg-emerald-900/20 rounded">
                                ✓ {testNotifMessage}
                            </p>
                        )}

                        {testNotifError && (
                            <p className="text-sm text-red-300 p-2 bg-red-900/30 rounded">
                                ✗ {testNotifError}
                            </p>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}