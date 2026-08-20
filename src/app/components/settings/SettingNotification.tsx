import { SubmitEvent, useEffect, useState } from 'react';
import { Bell, MessageCircle, Monitor, Trash2 } from 'lucide-react';
import type { WebPushSubscription } from '../../../../common/user';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
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
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/LanguageProvider';
import { sendTestNotification } from '../../services/notificationService';
import {
    addWebPushBrowser,
    configureDiscord,
    getWebPushSettings,
    removeWebPushBrowser,
} from '../../services/settingService';

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/');
    const rawData = window.atob(base64);
    return Uint8Array.from(rawData, (character) => character.codePointAt(0) ?? 0);
}

function defaultBrowserName(): string {
    const match = /(Firefox|Edg|Chrome|Safari)\/[\d.]+/.exec(navigator.userAgent);
    return `${match?.[1] || 'Navigateur'} - ${navigator.platform || 'appareil'}`;
}

export function SettingNotification() {
    const { t } = useI18n();
    const { user, refresh } = useAuth();
    const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
    const [discordTested, setDiscordTested] = useState(
        Boolean(user?.notifications.discord?.webhookUrl),
    );
    const [discordFormOpen, setDiscordFormOpen] = useState(false);
    const [discordMessage, setDiscordMessage] = useState<string | null>(null);
    const [discordError, setDiscordError] = useState<string | null>(null);
    const [isDiscordSaving, setIsDiscordSaving] = useState(false);
    const [subscriptions, setSubscriptions] = useState<WebPushSubscription[]>([]);
    const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
    const [browserName, setBrowserName] = useState(defaultBrowserName);
    const [browserMessage, setBrowserMessage] = useState<string | null>(null);
    const [browserError, setBrowserError] = useState<string | null>(null);
    const [isBrowserSaving, setIsBrowserSaving] = useState(false);
    const [testNotifMessage, setTestNotifMessage] = useState<string | null>(null);
    const [testNotifError, setTestNotifError] = useState<string | null>(null);
    const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);

    useEffect(() => {
        setDiscordTested(Boolean(user?.notifications.discord?.webhookUrl));
    }, [user?.notifications.discord?.webhookUrl]);

    useEffect(() => {
        const loadBrowsers = async () => {
            try {
                const settings = await getWebPushSettings();
                setSubscriptions(settings.subscriptions);
                if ('serviceWorker' in navigator) {
                    const registration = await navigator.serviceWorker.ready;
                    const currentSubscription = await registration.pushManager.getSubscription();
                    setCurrentEndpoint(currentSubscription?.endpoint || null);
                }
            } catch (loadError) {
                setBrowserError(
                    loadError instanceof Error ? loadError.message : t('settings.messages.loadFailed'),
                );
            }
        };
        void loadBrowsers();
    }, [t]);

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

    const handleAddBrowser = async () => {
        setBrowserError(null);
        setBrowserMessage(null);
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setBrowserError(t('settings.messages.browserUnsupported'));
            return;
        }

        setIsBrowserSaving(true);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error(t('settings.messages.browserPermissionDenied'));
            }
            const settings = await getWebPushSettings();
            const registration = await navigator.serviceWorker.ready;
            const existing = await registration.pushManager.getSubscription();
            const pushSubscription = existing || await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(settings.publicKey),
            });
            const response = await addWebPushBrowser(
                browserName.trim() || defaultBrowserName(),
                pushSubscription,
            );
            setSubscriptions((current) => [
                ...current.filter((item) => item.endpoint !== response.subscription.endpoint),
                response.subscription,
            ]);
            setCurrentEndpoint(response.subscription.endpoint);
            setBrowserMessage(t('settings.messages.browserSaved'));
        } catch (saveError) {
            setBrowserError(
                saveError instanceof Error
                    ? saveError.message
                    : t('settings.messages.browserConfigFailed'),
            );
        } finally {
            setIsBrowserSaving(false);
        }
    };

    const handleRemoveBrowser = async (subscription: WebPushSubscription) => {
        setBrowserError(null);
        setBrowserMessage(null);
        try {
            await removeWebPushBrowser(subscription.id);
            if (subscription.endpoint === currentEndpoint && 'serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                await (await registration.pushManager.getSubscription())?.unsubscribe();
                setCurrentEndpoint(null);
            }
            setSubscriptions((current) => current.filter((item) => item.id !== subscription.id));
            setBrowserMessage(t('settings.messages.browserRemoved'));
        } catch (removeError) {
            setBrowserError(
                removeError instanceof Error
                    ? removeError.message
                    : t('settings.messages.browserRemoveFailed'),
            );
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
                        className="space-y-4 p-4 bg-slate-800/50 rounded-md border border-purple-500/20"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <MessageCircle className="size-5 shrink-0 text-purple-300" />
                                <div>
                                    <h4 className="font-medium text-white">
                                        {t('settings.notifications.discord.title')}
                                    </h4>
                                    <p className="text-sm text-purple-200/70">
                                        {t('settings.notifications.discord.description')}
                                    </p>
                                </div>
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
                            <div className="space-y-3 mt-3">
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

                    <div className="space-y-4 p-4 bg-slate-800/50 rounded-md border border-purple-500/20">
                        <div className="flex items-center gap-3">
                            <Bell className="size-5 shrink-0 text-purple-300" />
                            <div>
                                <h4 className="font-medium text-white">
                                    {t('settings.notifications.browser.title')}
                                </h4>
                                <p className="text-sm text-purple-200/70">
                                    {t('settings.notifications.browser.description')}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                value={browserName}
                                maxLength={80}
                                onChange={(event) => setBrowserName(event.target.value)}
                                placeholder={t('settings.notifications.browser.devicePlaceholder')}
                                className="bg-slate-900 border-white/10 text-white"
                            />
                            <Button
                                type="button"
                                onClick={handleAddBrowser}
                                disabled={isBrowserSaving || !browserName.trim()}
                                className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                {t('settings.notifications.browser.add')}
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {subscriptions.length === 0 && (
                                <p className="text-sm text-slate-400">
                                    {t('settings.notifications.browser.none')}
                                </p>
                            )}
                            {subscriptions.map((subscription) => (
                                <div
                                    key={subscription.id}
                                    className="flex items-center gap-3 rounded border border-white/10 bg-slate-900/60 p-3"
                                >
                                    <Monitor className="size-4 shrink-0 text-slate-300" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-white">
                                            {subscription.name}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {subscription.endpoint === currentEndpoint
                                                ? t('settings.notifications.browser.current')
                                                : t('settings.notifications.browser.registered')}
                                        </p>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="text-red-300 hover:bg-red-950/60 hover:text-red-200"
                                                title={t('common.remove')}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="border-white/10 bg-slate-900 text-white">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                    {t('settings.notifications.browser.removeTitle')}
                                                </AlertDialogTitle>
                                                <AlertDialogDescription className="text-slate-300">
                                                    {t('settings.notifications.browser.removeDescription')}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">
                                                    {t('common.cancel')}
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => void handleRemoveBrowser(subscription)}
                                                    className="bg-red-600 text-white hover:bg-red-700"
                                                >
                                                    {t('common.remove')}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>

                        {browserMessage && (
                            <p className="text-sm text-emerald-300">{browserMessage}</p>
                        )}
                        {browserError && <p className="text-sm text-red-300">{browserError}</p>}
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