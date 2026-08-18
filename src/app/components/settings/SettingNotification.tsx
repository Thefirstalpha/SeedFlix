import { useEffect, useState } from 'react';

import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';


import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useAuth } from '../../context/AuthContext';
import { useI18n, type SupportedLanguage } from '../../i18n/LanguageProvider';
import {
    changePassword,
    getDatabaseNamespace,
    resetSettings,
    updateDatabaseNamespace,
    listDatabaseNamespaces,
    type DatabaseNamespaceEntry,
} from '../../services/authService';
import { sendTestNotification } from '../../services/notificationService';

export function SettingNotification() {
    const { t } = useI18n();
    const [resetError, setResetError] = useState<string | null>(null);
    const [isResetting, setIsResetting] = useState(false);
    const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
    const [discordTested, setDiscordTested] = useState(false);
    const [discordFormOpen, setDiscordFormOpen] = useState(false);
    const [discordMessage, setDiscordMessage] = useState<string | null>(null);
    const [discordError, setDiscordError] = useState<string | null>(null);
    const [isDiscordSaving, setIsDiscordSaving] = useState(false);
    const [languageCode, setLanguageCode] = useState<SupportedLanguage>('fr');
    const [spoilerMode, setSpoilerMode] = useState(false);
    const [preferencesMessage, setPreferencesMessage] = useState<string | null>(null);
    const [preferencesError, setPreferencesError] = useState<string | null>(null);
    const [isPreferencesSaving, setIsPreferencesSaving] = useState(false);
    const [testNotifMessage, setTestNotifMessage] = useState<string | null>(null);
    const [testNotifError, setTestNotifError] = useState<string | null>(null);
    const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);

    const applySettingsToForms = (incomingSettings: UserSettings) => {


        const notifSettings = incomingSettings.placeholders?.notifications || {};
        setDiscordWebhookUrl((notifSettings as any).discord?.webhookUrl || '');
        setDiscordTested(
            (notifSettings as any).enabledChannels?.includes('discord') &&
            Boolean((notifSettings as any).discord?.webhookUrl),
        );
        setLanguageCode(
            parseSupportedLanguage((incomingSettings.placeholders?.preferences as any)?.language),
        );
        setSpoilerMode(Boolean((incomingSettings.placeholders?.preferences as any)?.spoilerMode));
    };



    const buildNotificationSettingsPayload = (params: {
        discordWebhookUrl?: string;
        includeDiscord?: boolean;
        includeBrowser?: boolean;
    }) => {
        const current = (settings?.placeholders?.notifications as Record<string, unknown>) || {};
        const currentChannels = Array.isArray(current.enabledChannels)
            ? (current.enabledChannels as string[])
            : [];

        const nextDiscordWebhookUrl =
            params.discordWebhookUrl ?? String((current as any).discord?.webhookUrl || '');

        const nextChannels = new Set(currentChannels);

        if (
            params.includeDiscord === true ||
            (params.includeDiscord !== false && Boolean(nextDiscordWebhookUrl.trim()))
        ) {
            nextChannels.add('discord');
        } else {
            nextChannels.delete('discord');
        }

        return {
            ...(current || {}),
            enabledChannels: Array.from(nextChannels),
            discord: {
                webhookUrl: nextDiscordWebhookUrl,
            },
        };
    };


    const handleDiscordSave = async (event: React.FormEvent) => {
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

            // Test webhook
            const testResponse = await fetch(discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [
                        {
                            title: t('settings.notifications.discord.testTitle'),
                            description: t('settings.notifications.discord.testDescription'),
                            color: 0x10b981,
                            timestamp: new Date().toISOString(),
                            footer: { text: t('settings.notifications.discord.testFooter') },
                        },
                    ],
                }),
            });

            if (!testResponse.ok) {
                setDiscordError(
                    `Test échoué (${testResponse.status}). Vérifiez que l'URL est correcte et active.`,
                );
                setIsDiscordSaving(false);
                return;
            }

            // Save configuration
            const notificationsPayload = buildNotificationSettingsPayload({
                discordWebhookUrl,
                includeDiscord: true,
            });
            const updatedSettings = buildSettingsWithNotifications(notificationsPayload);

            const savedSettings = await updateSettings(updatedSettings);
            applyUpdatedSettings(savedSettings);
            await refresh();
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