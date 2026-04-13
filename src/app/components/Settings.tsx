import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { DatabaseNamespaceList } from './DatabaseNamespaceList';
import { DatabaseRawEditorPanel } from './DatabaseRawEditorPanel';
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
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAuth } from '../context/AuthContext';
import { useI18n, type SupportedLanguage } from '../i18n/LanguageProvider';
import {
  changePassword,
  getGlobalSettings,
  getDatabaseNamespace,
  getSettings,
  resetSettings,
  testIndexerConnection,
  testTorrentConnection,
  updateGlobalSettings,
  updateDatabaseNamespace,
  updateSettings,
  listDatabaseNamespaces,
  type DatabaseNamespaceEntry,
  type UserSettings,
  listUsers,
  createUser,
  deleteUser,
  resetUserPassword,
  type User,
} from '../services/authService';
import {
  getDefaultBrowserDeviceName,
  getOrCreateBrowserDeviceId,
  parseBrowserDevices,
  type BrowserNotificationDevice,
} from '../services/browserNotificationChannel';
import * as notificationService from '../services/notificationService';
import { UserList } from './UserList';

// Fonction utilitaire générique pour la gestion des sauvegardes asynchrones
async function handleAsyncSave<T = any>({
  event,
  setError,
  setMessage,
  setSaving,
  doSave,
  successMessage,
  errorMessage,
  onSuccess,
}: {
  event?: React.FormEvent;
  setError: (msg: string | null) => void;
  setMessage: (msg: string | null) => void;
  setSaving: (saving: boolean) => void;
  doSave: () => Promise<T>;
  successMessage: string;
  errorMessage: string;
  onSuccess?: (result: T) => void;
}) {
  if (event) event.preventDefault();
  setError(null);
  setMessage(null);
  setSaving(true);
  try {
    const result = await doSave();
    if (onSuccess) onSuccess(result);
    setMessage(successMessage);
  } catch (submitError: any) {
    setError(submitError instanceof Error ? submitError.message : errorMessage);
  } finally {
    setSaving(false);
  }
}

const QUALITY_OPTIONS = [
  { value: 'all', labelKey: 'settings.quality.all' },
  { value: '2160p', labelKey: 'settings.quality.2160p' },
  { value: '1080p', labelKey: 'settings.quality.1080p' },
  { value: '720p', labelKey: 'settings.quality.720p' },
  { value: '480p', labelKey: 'settings.quality.480p' },
  { value: 'bluray', labelKey: 'settings.quality.bluray' },
  { value: 'webdl', labelKey: 'settings.quality.webdl' },
  { value: 'hdtv', labelKey: 'settings.quality.hdtv' },
];

const SETTINGS_TABS = ['general', 'notifications', 'api', 'users', 'database', 'factory'] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function parseSupportedLanguage(input: unknown): SupportedLanguage {
  return input === 'en' ? 'en' : 'fr';
}

function isValidSettingsTab(value: string): value is SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab);
}

function isAdminOnlyTab(value: SettingsTab) {
  return value === 'users' || value === 'database' || value === 'factory';
}

function normalizeSettingsTab(value: string | null): SettingsTab | null {
  if (value === 'security') {
    return 'general';
  }

  return value && isValidSettingsTab(value) ? value : null;
}

export function Settings() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, isLoading, user, setSettings, refresh, shouldChangePassword } =
    useAuth();
  const { t, availableLanguages, setLanguage } = useI18n();
  const [settings, setLocalSettings] = useState<UserSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torrentUrl, setTorrentUrl] = useState('');
  const [torrentPort, setTorrentPort] = useState('');
  const [torrentAuthRequired, setTorrentAuthRequired] = useState(false);
  const [torrentUsername, setTorrentUsername] = useState('');
  const [torrentPassword, setTorrentPassword] = useState('');
  const [torrentMoviesFolder, setTorrentMoviesFolder] = useState('');
  const [torrentSeriesFolder, setTorrentSeriesFolder] = useState('');
  const [torrentMessage, setTorrentMessage] = useState<string | null>(null);
  const [torrentError, setTorrentError] = useState<string | null>(null);
  const [isTorrentSaving, setIsTorrentSaving] = useState(false);
  const [indexerUrl, setIndexerUrl] = useState('');
  const [indexerToken, setIndexerToken] = useState('');
  const [indexerDefaultQuality, setIndexerDefaultQuality] = useState('all');
  const [indexerMessage, setIndexerMessage] = useState<string | null>(null);
  const [indexerError, setIndexerError] = useState<string | null>(null);
  const [isIndexerSaving, setIsIndexerSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [tmdbApiKey, setTmdbApiKey] = useState('');
  const [tmdbMessage, setTmdbMessage] = useState<string | null>(null);
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [isTmdbSaving, setIsTmdbSaving] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [discordTested, setDiscordTested] = useState(false);
  const [discordFormOpen, setDiscordFormOpen] = useState(false);
  const [discordMessage, setDiscordMessage] = useState<string | null>(null);
  const [discordError, setDiscordError] = useState<string | null>(null);
  const [isDiscordSaving, setIsDiscordSaving] = useState(false);
  const [browserDevices, setBrowserDevices] = useState<BrowserNotificationDevice[]>([]);
  const [browserDeviceName, setBrowserDeviceName] = useState(getDefaultBrowserDeviceName);
  const [browserMessage, setBrowserMessage] = useState<string | null>(null);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [isBrowserSaving, setIsBrowserSaving] = useState(false);
  const [browserDeviceId] = useState(getOrCreateBrowserDeviceId);
  const [languageCode, setLanguageCode] = useState<SupportedLanguage>('fr');
  const [spoilerMode, setSpoilerMode] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState<string | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [isPreferencesSaving, setIsPreferencesSaving] = useState(false);
  const [testNotifMessage, setTestNotifMessage] = useState<string | null>(null);
  const [testNotifError, setTestNotifError] = useState<string | null>(null);
  const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);

  // User Management State
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [usersMessage, setUsersMessage] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [generatedPasswordContext, setGeneratedPasswordContext] = useState<'create' | 'reset'>(
    'create',
  );
  const [isCreatedUserModalOpen, setIsCreatedUserModalOpen] = useState(false);
  const [isGeneratedPasswordCopied, setIsGeneratedPasswordCopied] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState<number | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordTargetId, setResetPasswordTargetId] = useState<number | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [databaseNamespaces, setDatabaseNamespaces] = useState<DatabaseNamespaceEntry[]>([]);
  const [selectedDatabaseNamespace, setSelectedDatabaseNamespace] = useState('');
  const [databaseRawValue, setDatabaseRawValue] = useState('');
  const [databaseUpdatedAt, setDatabaseUpdatedAt] = useState('');
  const [databaseMessage, setDatabaseMessage] = useState<string | null>(null);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [isLoadingDatabaseNamespaces, setIsLoadingDatabaseNamespaces] = useState(false);
  const [isLoadingDatabaseValue, setIsLoadingDatabaseValue] = useState(false);
  const [isSavingDatabaseValue, setIsSavingDatabaseValue] = useState(false);
  const isAdmin = user?.username === 'admin';

  const tabParam = searchParams.get('tab');
  const activeTab: SettingsTab = normalizeSettingsTab(tabParam) || 'general';

  useEffect(() => {
    const normalizedTab = normalizeSettingsTab(tabParam);
    const effectiveTab =
      normalizedTab && !isAdmin && isAdminOnlyTab(normalizedTab) ? 'general' : normalizedTab;
    if (effectiveTab && tabParam === effectiveTab) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', effectiveTab || 'general');
    setSearchParams(nextParams, { replace: true });
  }, [isAdmin, tabParam, searchParams, setSearchParams]);

  const applySettingsToForms = (incomingSettings: UserSettings) => {
    const torrentSettings = incomingSettings.placeholders?.torrent || {};
    setTorrentUrl(torrentSettings.url || '');
    setTorrentPort(torrentSettings.port || '');
    setTorrentAuthRequired(torrentSettings.authRequired || false);
    setTorrentUsername(torrentSettings.username || '');
    setTorrentPassword(torrentSettings.password || '');
    setTorrentMoviesFolder(torrentSettings.moviesFolder || '');
    setTorrentSeriesFolder(torrentSettings.seriesFolder || '');

    setIndexerUrl(incomingSettings.placeholders?.indexer?.url || '');
    setIndexerToken(incomingSettings.placeholders?.indexer?.token || '');
    setIndexerDefaultQuality(incomingSettings.placeholders?.indexer?.defaultQuality || 'all');

    const notifSettings = incomingSettings.placeholders?.notifications || {};
    setDiscordWebhookUrl((notifSettings as any).discord?.webhookUrl || '');
    setDiscordTested(
      (notifSettings as any).enabledChannels?.includes('discord') &&
      Boolean((notifSettings as any).discord?.webhookUrl),
    );
    setBrowserDevices(parseBrowserDevices((notifSettings as any).browser?.devices));
    setLanguageCode(
      parseSupportedLanguage((incomingSettings.placeholders?.preferences as any)?.language),
    );
    setSpoilerMode(Boolean((incomingSettings.placeholders?.preferences as any)?.spoilerMode));
  };

  const buildNotificationSettingsPayload = (params: {
    discordWebhookUrl?: string;
    browserDevices?: BrowserNotificationDevice[];
    includeDiscord?: boolean;
    includeBrowser?: boolean;
  }) => {
    const current = (settings?.placeholders?.notifications as Record<string, unknown>) || {};
    const currentChannels = Array.isArray(current.enabledChannels)
      ? (current.enabledChannels as string[])
      : [];

    const nextDiscordWebhookUrl =
      params.discordWebhookUrl ?? String((current as any).discord?.webhookUrl || '');
    const nextBrowserDevices =
      params.browserDevices ?? parseBrowserDevices((current as any).browser?.devices);

    const nextChannels = new Set(currentChannels);

    if (
      params.includeDiscord === true ||
      (params.includeDiscord !== false && Boolean(nextDiscordWebhookUrl.trim()))
    ) {
      nextChannels.add('discord');
    } else {
      nextChannels.delete('discord');
    }

    if (
      params.includeBrowser === true ||
      (params.includeBrowser !== false && nextBrowserDevices.length > 0)
    ) {
      nextChannels.add('browser');
    } else {
      nextChannels.delete('browser');
    }

    return {
      ...(current || {}),
      enabledChannels: Array.from(nextChannels),
      discord: {
        webhookUrl: nextDiscordWebhookUrl,
      },
      browser: {
        devices: nextBrowserDevices,
      },
    };
  };

  const buildSettingsWithNotifications = (
    notificationsPayload: Record<string, unknown>,
  ): UserSettings => ({
    profile: settings?.profile || { username: user?.username || 'admin' },
    security: settings?.security || { lastPasswordChangeAt: new Date().toISOString() },
    apiKeys: settings?.apiKeys || { tmdb: '' },
    placeholders: {
      notifications: notificationsPayload,
      preferences: settings?.placeholders?.preferences || {},
      torrent: settings?.placeholders?.torrent || {},
      indexer: settings?.placeholders?.indexer || {},
    },
  });

  const buildUpdatedSettings = (
    overrides: Partial<UserSettings['placeholders']>,
  ): UserSettings => ({
    profile: settings?.profile || { username: user?.username || 'admin' },
    security: settings?.security || {
      lastPasswordChangeAt: new Date().toISOString(),
    },
    apiKeys: settings?.apiKeys || { tmdb: '' },
    placeholders: {
      notifications: settings?.placeholders?.notifications || {},
      preferences: settings?.placeholders?.preferences || {},
      torrent: settings?.placeholders?.torrent,
      indexer: settings?.placeholders?.indexer,
      ...overrides,
    },
  });

  const applyUpdatedSettings = (nextSettings: UserSettings) => {
    setLocalSettings(nextSettings);
    setSettings(nextSettings);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const loadSettings = async () => {
      try {
        const response = await getSettings();
        setLocalSettings(response);
        setSettings(response);
        applySettingsToForms(response);

        if (user?.username === 'admin') {
          const globalSettings = await getGlobalSettings();
          setTmdbApiKey(globalSettings.tmdbApiKey || '');
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : t('settings.messages.loadFailed'),
        );
      }
    };

    void loadSettings();
  }, [isAuthenticated, setSettings, user?.username, t]);

  useEffect(() => {
    if (!isAuthenticated || user?.username !== 'admin') {
      return;
    }

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const loadedUsers = await listUsers();
        setUsers(loadedUsers);
      } catch (loadError) {
        setUsersError(
          loadError instanceof Error ? loadError.message : t('settings.messages.loadFailed'),
        );
      } finally {
        setIsLoadingUsers(false);
      }
    };

    void loadUsers();
  }, [isAuthenticated, user]);

  // Extraction de la logique commune de chargement des namespaces
  const fetchAndSetDatabaseNamespaces = async () => {
    setIsLoadingDatabaseNamespaces(true);
    try {
      const response = await listDatabaseNamespaces();
      const namespaces = Array.isArray(response.namespaces) ? response.namespaces : [];
      setDatabaseNamespaces(namespaces);
      if (namespaces.length === 0) {
        setDatabaseRawValue('');
        setDatabaseUpdatedAt('');
      }
      setSelectedDatabaseNamespace((current) => {
        if (current && namespaces.some((entry) => entry.namespace === current)) {
          return current;
        }
        return namespaces[0]?.namespace || '';
      });
    } catch (err) {
      setDatabaseError(err instanceof Error ? err.message : t('settings.database.loadFailed'));
    } finally {
      setIsLoadingDatabaseNamespaces(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || user?.username !== 'admin') {
      return;
    }
    void fetchAndSetDatabaseNamespaces();
  }, [isAuthenticated, t, user?.username]);

  useEffect(() => {
    if (!isAuthenticated || user?.username !== 'admin' || !selectedDatabaseNamespace) {
      return;
    }

    const loadDatabaseEntry = async () => {
      setIsLoadingDatabaseValue(true);
      setDatabaseError(null);
      setDatabaseMessage(null);
      try {
        const entry = await getDatabaseNamespace(selectedDatabaseNamespace);
        setDatabaseRawValue(entry.value || '');
        setDatabaseUpdatedAt(entry.updatedAt || '');
      } catch (loadError) {
        setDatabaseError(
          loadError instanceof Error ? loadError.message : t('settings.database.entryLoadFailed'),
        );
      } finally {
        setIsLoadingDatabaseValue(false);
      }
    };

    void loadDatabaseEntry();
  }, [isAuthenticated, selectedDatabaseNamespace, t, user?.username]);

  useEffect(() => {
    if (!createdUserCredentials || isCreatedUserModalOpen) {
      return;
    }

    if (isCreateUserOpen || resetPasswordTargetId !== null) {
      return;
    }

    const openTimer = window.setTimeout(() => {
      setIsCreatedUserModalOpen(true);
    }, 0);

    return () => window.clearTimeout(openTimer);
  }, [createdUserCredentials, isCreateUserOpen, isCreatedUserModalOpen, resetPasswordTargetId]);

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const handlePasswordUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      const refreshedSettings = await getSettings();
      setLocalSettings(refreshedSettings);
      setSettings(refreshedSettings);
      await refresh();
      setCurrentPassword('');
      setNewPassword('');
      setMessage(t('settings.messages.passwordUpdated'));
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t('settings.messages.updateFailed'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTmdbSave = async (event: React.FormEvent) => {
    if (!tmdbApiKey.trim()) {
      setTmdbError(t('settings.messages.tmdbKeyRequired'));
      setIsTmdbSaving(false);
      return;
    }
    await handleAsyncSave({
      event,
      setError: setTmdbError,
      setMessage: setTmdbMessage,
      setSaving: setIsTmdbSaving,
      doSave: async () => {
        const savedGlobalSettings = await updateGlobalSettings({
          tmdbApiKey: tmdbApiKey.trim(),
        });
        setTmdbApiKey(savedGlobalSettings.tmdbApiKey || '');
        await refresh();
        return savedGlobalSettings;
      },
      successMessage: t('settings.messages.tmdbSaved'),
      errorMessage: t('settings.messages.configFailed'),
    });
  };

  const handleTorrentSave = async (event: React.FormEvent) => {
    setResetError(null);
    await handleAsyncSave({
      event,
      setError: setTorrentError,
      setMessage: setTorrentMessage,
      setSaving: setIsTorrentSaving,
      doSave: async () => {
        const updatedSettings: UserSettings = buildUpdatedSettings({
          torrent: {
            url: torrentUrl,
            port: torrentPort,
            authRequired: torrentAuthRequired,
            username: torrentAuthRequired ? torrentUsername : undefined,
            password: torrentAuthRequired ? torrentPassword : '',
            moviesFolder: torrentMoviesFolder,
            seriesFolder: torrentSeriesFolder,
          },
        });
        const savedSettings = await updateSettings(updatedSettings);
        applyUpdatedSettings(savedSettings);
        try {
          const response = await testTorrentConnection({
            url: torrentUrl,
            port: torrentPort,
            authRequired: torrentAuthRequired,
            username: torrentUsername,
            password: torrentPassword,
          });
          return {
            message: t('settings.messages.configurationSavedWithResponse', {
              response: response.message,
            }),
          };
        } catch (submitError) {
          throw new Error(
            submitError instanceof Error
              ? t('settings.messages.savedButTestFailedWithReason', { reason: submitError.message })
              : t('settings.messages.savedButTestFailed'),
          );
        }
      },
      successMessage: t('settings.messages.configurationSavedWithResponse', { response: '' }), // sera remplacé par le message réel
      errorMessage: t('settings.messages.updateFailed'),
      onSuccess: (result: any) => {
        if (result && result.message) setTorrentMessage(result.message);
      },
    });
  };

  const handleIndexerSave = async (event: React.FormEvent) => {
    setResetError(null);
    await handleAsyncSave({
      event,
      setError: setIndexerError,
      setMessage: setIndexerMessage,
      setSaving: setIsIndexerSaving,
      doSave: async () => {
        const updatedSettings: UserSettings = buildUpdatedSettings({
          indexer: {
            url: indexerUrl,
            token: indexerToken,
            defaultQuality: indexerDefaultQuality,
          },
        });
        const savedSettings = await updateSettings(updatedSettings);
        applyUpdatedSettings(savedSettings);
        try {
          const response = await testIndexerConnection(indexerUrl, indexerToken);
          return {
            message: t('settings.messages.configurationSavedWithResponse', {
              response: response.message,
            }),
          };
        } catch (submitError) {
          throw new Error(
            submitError instanceof Error
              ? t('settings.messages.savedButTestFailedWithReason', { reason: submitError.message })
              : t('settings.messages.savedButTestFailed'),
          );
        }
      },
      successMessage: t('settings.messages.configurationSavedWithResponse', { response: '' }),
      errorMessage: t('settings.messages.updateFailed'),
      onSuccess: (result: any) => {
        if (result && result.message) setIndexerMessage(result.message);
      },
    });
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
        browserDevices,
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

  const handleAddBrowserChannel = async () => {
    setBrowserError(null);
    setBrowserMessage(null);
    setIsBrowserSaving(true);

    try {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setBrowserError(t('settings.messages.browserUnsupported'));
        setIsBrowserSaving(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setBrowserError(t('settings.messages.browserPermissionDenied'));
        setIsBrowserSaving(false);
        return;
      }

      const nextName = browserDeviceName.trim() || getDefaultBrowserDeviceName();
      const existingIndex = browserDevices.findIndex((device) => device.id === browserDeviceId);
      const nextDevices = [...browserDevices];

      if (existingIndex >= 0) {
        nextDevices[existingIndex] = {
          ...nextDevices[existingIndex],
          name: nextName,
        };
      } else {
        nextDevices.push({
          id: browserDeviceId,
          name: nextName,
          createdAt: new Date().toISOString(),
        });
      }

      const notificationsPayload = buildNotificationSettingsPayload({
        browserDevices: nextDevices,
        includeBrowser: true,
      });
      const updatedSettings = buildSettingsWithNotifications(notificationsPayload);

      const savedSettings = await updateSettings(updatedSettings);
      applyUpdatedSettings(savedSettings);
      await refresh();
      setBrowserDevices(nextDevices);
      setBrowserMessage(t('settings.messages.browserSaved'));
    } catch (submitError) {
      setBrowserError(
        submitError instanceof Error
          ? submitError.message
          : t('settings.messages.browserConfigFailed'),
      );
    } finally {
      setIsBrowserSaving(false);
    }
  };

  const handleRemoveBrowserDevice = async (deviceId: string) => {
    setBrowserError(null);
    setBrowserMessage(null);
    setIsBrowserSaving(true);

    try {
      const nextDevices = browserDevices.filter((device) => device.id !== deviceId);
      const notificationsPayload = buildNotificationSettingsPayload({
        browserDevices: nextDevices,
        includeBrowser: nextDevices.length > 0,
      });
      const updatedSettings = buildSettingsWithNotifications(notificationsPayload);

      const savedSettings = await updateSettings(updatedSettings);
      applyUpdatedSettings(savedSettings);
      await refresh();
      setBrowserDevices(nextDevices);
      setBrowserMessage(t('settings.messages.browserRemoved'));
    } catch (submitError) {
      setBrowserError(
        submitError instanceof Error
          ? submitError.message
          : t('settings.messages.browserRemoveFailed'),
      );
    } finally {
      setIsBrowserSaving(false);
    }
  };

  const handleResetSettings = async () => {
    if (user?.username !== 'admin') {
      setResetError(t('auth.adminRequired'));
      return;
    }

    setResetError(null);
    setTorrentMessage(null);
    setTorrentError(null);
    setIndexerMessage(null);
    setIndexerError(null);
    setIsResetting(true);

    try {
      await resetSettings();
      await refresh();
      navigate('/login', { replace: true, state: { reset: true } });
    } catch (submitError) {
      setResetError(
        submitError instanceof Error ? submitError.message : t('settings.messages.resetFailed'),
      );
    } finally {
      setIsResetting(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTestNotifError(null);
    setTestNotifMessage(null);
    setIsSendingTestNotif(true);

    try {
      const response = await notificationService.sendTestNotification();
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

  const savePreferences = async (
    nextPreferences: Record<string, unknown>,
    nextLanguage?: SupportedLanguage,
  ) => {
    setPreferencesMessage(null);
    setPreferencesError(null);
    setIsPreferencesSaving(true);

    try {
      const updatedSettings = buildUpdatedSettings({
        preferences: nextPreferences,
      });

      const savedSettings = await updateSettings(updatedSettings);
      applyUpdatedSettings(savedSettings);
      await refresh();
      if (nextLanguage) {
        setLanguage(nextLanguage);
      }
      setPreferencesMessage(t('settings.preferences.saved'));
    } catch (submitError) {
      setPreferencesError(
        submitError instanceof Error ? submitError.message : t('settings.preferences.failed'),
      );
    } finally {
      setIsPreferencesSaving(false);
    }
  };

  const handleLanguageChange = async (nextLanguage: SupportedLanguage) => {
    setLanguageCode(nextLanguage);
    await savePreferences(
      {
        ...(settings?.placeholders?.preferences || {}),
        language: nextLanguage,
        spoilerMode,
      },
      nextLanguage,
    );
  };

  const handleSpoilerChange = async (nextSpoilerMode: boolean) => {
    setSpoilerMode(nextSpoilerMode);
    await savePreferences({
      ...(settings?.placeholders?.preferences || {}),
      language: languageCode,
      spoilerMode: nextSpoilerMode,
    });
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setUsersMessage(null);
    setUsersError(null);
    setCreatedUserCredentials(null);
    setIsCreatingUser(true);

    try {
      if (!newUsername.trim()) {
        setUsersError(t('auth.usernameRequired'));
        setIsCreatingUser(false);
        return;
      }

      const createdUser = await createUser(newUsername.trim());
      setUsers((currentUsers) => [...currentUsers, createdUser]);
      setNewUsername('');
      setIsCreateUserOpen(false);
      setUsersMessage(
        t('settings.users.userCreated', {
          username: createdUser.username,
        }),
      );
      setCreatedUserCredentials({
        username: createdUser.username,
        password: createdUser.generatedPassword,
      });
      setGeneratedPasswordContext('create');
      setIsGeneratedPasswordCopied(false);
    } catch (submitError) {
      setUsersError(
        submitError instanceof Error ? submitError.message : t('settings.messages.updateFailed'),
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    setUsersMessage(null);
    setUsersError(null);
    setCreatedUserCredentials(null);
    setIsDeletingUser(userId);

    try {
      await deleteUser(userId);
      setUsers(users.filter((u) => u.id !== userId));
      setUsersMessage(t('settings.users.userDeleted', { username }));
    } catch (submitError) {
      setUsersError(
        submitError instanceof Error ? submitError.message : t('settings.messages.updateFailed'),
      );
    } finally {
      setIsDeletingUser(null);
    }
  };

  const handleResetUserPassword = async () => {
    if (!resetPasswordTargetId) return;
    setUsersError(null);
    setCreatedUserCredentials(null);
    setIsResettingPassword(true);

    try {
      const response = await resetUserPassword(resetPasswordTargetId);
      const targetUser = users.find((u) => u.id === resetPasswordTargetId);
      setResetPasswordTargetId(null);
      setUsersMessage(
        t('settings.users.passwordReset', {
          username: targetUser?.username || 'utilisateur',
        }),
      );
      setCreatedUserCredentials({
        username: targetUser?.username || 'utilisateur',
        password: response.generatedPassword,
      });
      setGeneratedPasswordContext('reset');
      setIsGeneratedPasswordCopied(false);
    } catch (submitError) {
      setUsersError(
        submitError instanceof Error ? submitError.message : t('settings.messages.updateFailed'),
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleCopyGeneratedPassword = async () => {
    if (!createdUserCredentials?.password) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdUserCredentials.password);
      setIsGeneratedPasswordCopied(true);
      setTimeout(() => setIsGeneratedPasswordCopied(false), 1500);
    } catch {
      setUsersError(t('settings.messages.updateFailed'));
    }
  };

  const handleDatabaseReload = async () => {
    if (!selectedDatabaseNamespace) {
      return;
    }

    setDatabaseError(null);
    setDatabaseMessage(null);
    setIsLoadingDatabaseValue(true);
    try {
      const entry = await getDatabaseNamespace(selectedDatabaseNamespace);
      setDatabaseRawValue(entry.value || '');
      setDatabaseUpdatedAt(entry.updatedAt || '');
      setDatabaseMessage(t('settings.database.reloaded'));
    } catch (reloadError) {
      setDatabaseError(
        reloadError instanceof Error ? reloadError.message : t('settings.database.entryLoadFailed'),
      );
    } finally {
      setIsLoadingDatabaseValue(false);
    }
  };

  const handleDatabaseNamespacesReload = async () => {
    setDatabaseError(null);
    setDatabaseMessage(null);
    await fetchAndSetDatabaseNamespaces();
    setDatabaseMessage(t('settings.database.listReloaded'));
  };

  const handleDatabasePrettyFormat = () => {
    setDatabaseError(null);
    try {
      const prettyValue = JSON.stringify(JSON.parse(databaseRawValue), null, 2);
      setDatabaseRawValue(prettyValue);
    } catch {
      setDatabaseError(t('settings.database.invalidJson'));
    }
  };

  const handleDatabaseSave = async () => {
    if (!selectedDatabaseNamespace) {
      return;
    }

    setDatabaseError(null);
    setDatabaseMessage(null);
    setIsSavingDatabaseValue(true);
    try {
      const updatedEntry = await updateDatabaseNamespace(
        selectedDatabaseNamespace,
        databaseRawValue,
      );
      setDatabaseRawValue(updatedEntry.value || '');
      setDatabaseUpdatedAt(updatedEntry.updatedAt || '');
      setDatabaseNamespaces((current) =>
        current.map((entry) =>
          entry.namespace === updatedEntry.namespace
            ? { namespace: updatedEntry.namespace, updatedAt: updatedEntry.updatedAt }
            : entry,
        ),
      );
      setDatabaseMessage(t('settings.database.saved'));
    } catch (saveError) {
      setDatabaseError(
        saveError instanceof Error ? saveError.message : t('settings.database.saveFailed'),
      );
    } finally {
      setIsSavingDatabaseValue(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">{t('settings.title')}</h2>
        <p className="mt-2 text-sm text-white/60">
          {t('settings.about.versionLabel', { version: settings?.appInfo?.imageTag || 'dev' })}
        </p>
      </div>
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isValidSettingsTab(value)) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set('tab', value);
            setSearchParams(nextParams, { replace: true });
          }
        }}
        className="space-y-6"
      >
        <div className="w-full overflow-x-auto pb-1">
          <TabsList className="bg-white/10 border border-white/10 min-w-max">
            <TabsTrigger
              value="general"
              className="flex-none text-white data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              {t('settings.tabs.general')}
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex-none text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              {t('settings.tabs.notifications')}
            </TabsTrigger>
            <TabsTrigger
              value="api"
              className="flex-none text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              {t('settings.tabs.configuration')}
            </TabsTrigger>
            {user?.username === 'admin' && (
              <TabsTrigger
                value="users"
                className="flex-none text-white data-[state=active]:bg-orange-600 data-[state=active]:text-white"
              >
                {t('settings.tabs.users')}
              </TabsTrigger>
            )}
            {user?.username === 'admin' && (
              <TabsTrigger
                value="database"
                className="flex-none text-white data-[state=active]:bg-teal-600 data-[state=active]:text-white"
              >
                {t('settings.tabs.database')}
              </TabsTrigger>
            )}
            {user?.username === 'admin' && (
              <TabsTrigger
                value="factory"
                className="flex-none text-white data-[state=active]:bg-red-600 data-[state=active]:text-white"
              >
                {t('settings.tabs.factory')}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="general">
          <Card className="border-blue-500/30 bg-blue-950/15 text-white mb-6">
            <CardHeader>
              <CardTitle className="text-blue-200">{t('settings.preferences.title')}</CardTitle>
              <CardDescription className="text-blue-100/70">
                {t('settings.preferences.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="settings-language">{t('settings.language.field')}</Label>
                  <select
                    id="settings-language"
                    value={languageCode}
                    onChange={(event) =>
                      void handleLanguageChange(parseSupportedLanguage(event.target.value))
                    }
                    disabled={isPreferencesSaving}
                    className="w-full bg-slate-900 border border-white/10 text-white rounded-md px-3 py-2"
                  >
                    {availableLanguages.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-4 py-3 gap-4">
                  <div>
                    <p className="font-medium text-white">{t('settings.spoilers.toggleLabel')}</p>
                    <p className="text-sm text-white/55">{t('settings.spoilers.toggleHelp')}</p>
                  </div>
                  <Switch
                    checked={spoilerMode}
                    onCheckedChange={(checked) => void handleSpoilerChange(Boolean(checked))}
                    disabled={isPreferencesSaving}
                  />
                </div>

                {isPreferencesSaving ? (
                  <p className="text-sm text-white/60">{t('common.saving')}</p>
                ) : null}
                {preferencesMessage && (
                  <p className="text-sm text-emerald-300">{preferencesMessage}</p>
                )}
                {preferencesError && <p className="text-sm text-red-300">{preferencesError}</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30 bg-emerald-950/15 text-white">
            <CardHeader>
              <CardTitle className="text-emerald-200">{t('settings.security.title')}</CardTitle>
              <CardDescription className="text-emerald-100/70">
                {t('settings.security.lastChange')}:{' '}
                {settings?.security?.lastPasswordChangeAt
                  ? new Date(settings.security.lastPasswordChangeAt).toLocaleString(
                    languageCode === 'fr' ? 'fr-FR' : 'en-US',
                  )
                  : t('settings.security.unknown')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shouldChangePassword ? (
                <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {t('settings.security.changePasswordSuggestion')}
                </div>
              ) : null}
              <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="current-password">{t('settings.security.currentPassword')}</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t('settings.security.newPassword')}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>
                {message && <p className="text-sm text-emerald-300">{message}</p>}
                {error && <p className="text-sm text-red-300">{error}</p>}
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSaving ? t('common.saving') : t('settings.security.update')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          {user?.username === 'admin' ? (
            <Card className="border-blue-500/30 bg-blue-950/15 text-white">
              <CardHeader>
                <CardTitle className="text-blue-200">{t('settings.api.tmdb.title')}</CardTitle>
                <CardDescription className="text-blue-100/70">
                  {t('settings.api.tmdb.description')}{' '}
                  <a
                    href="https://www.themoviedb.org/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-blue-200"
                  >
                    themoviedb.org
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTmdbSave} className="space-y-6 max-w-lg">
                  <div className="space-y-2">
                    <Label htmlFor="tmdb-api-key">{t('settings.api.tmdb.apiToken')}</Label>
                    <Input
                      id="tmdb-api-key"
                      type="password"
                      placeholder={t('settings.api.tmdb.placeholder')}
                      value={tmdbApiKey}
                      onChange={(event) => setTmdbApiKey(event.target.value)}
                      className="bg-slate-900 border-white/10 text-white"
                    />
                  </div>

                  {tmdbMessage && <p className="text-sm text-emerald-300">{tmdbMessage}</p>}
                  {tmdbError && <p className="text-sm text-red-300">{tmdbError}</p>}

                  <Button
                    type="submit"
                    disabled={isTmdbSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isTmdbSaving ? t('common.saving') : t('settings.api.tmdb.save')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

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
                      value={torrentPort}
                      onChange={(e) => setTorrentPort(e.target.value)}
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

          <Card className="border-blue-500/30 bg-blue-950/15 text-white mt-6">
            <CardHeader>
              <CardTitle className="text-blue-200">{t('settings.api.indexer.title')}</CardTitle>
              <CardDescription className="text-blue-100/70">
                {t('settings.api.indexer.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleIndexerSave} className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="indexer-url">{t('settings.api.indexer.url')}</Label>
                  <Input
                    id="indexer-url"
                    placeholder="https://indexer.example.com"
                    value={indexerUrl}
                    onChange={(e) => setIndexerUrl(e.target.value)}
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="indexer-token">{t('settings.api.indexer.token')}</Label>
                  <Input
                    id="indexer-token"
                    type="password"
                    placeholder="••••••••••••••••"
                    value={indexerToken}
                    onChange={(e) => setIndexerToken(e.target.value)}
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="indexer-default-quality">
                    {t('settings.api.indexer.defaultQuality')}
                  </Label>
                  <select
                    id="indexer-default-quality"
                    value={indexerDefaultQuality}
                    onChange={(e) => setIndexerDefaultQuality(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 text-white rounded-md px-3 py-2"
                  >
                    {QUALITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>

                {indexerMessage && <p className="text-sm text-emerald-300">{indexerMessage}</p>}
                {indexerError && <p className="text-sm text-red-300">{indexerError}</p>}

                <Button
                  type="submit"
                  disabled={isIndexerSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isIndexerSaving
                    ? t('settings.api.common.savingAndTesting')
                    : t('settings.api.common.saveAndTest')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
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

                <div className="space-y-4 p-4 bg-slate-800/50 rounded-md border border-purple-500/20">
                  <div>
                    <h4 className="font-medium text-white">
                      {t('settings.notifications.browser.title')}
                    </h4>
                    <p className="text-sm text-purple-200/70">
                      {t('settings.notifications.browser.description')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={browserDeviceName}
                      onChange={(e) => setBrowserDeviceName(e.target.value)}
                      placeholder={t('settings.notifications.browser.devicePlaceholder')}
                      disabled={browserDevices.some((device) => device.id === browserDeviceId)}
                      className="bg-slate-900 border-white/10 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <Button
                      type="button"
                      onClick={handleAddBrowserChannel}
                      disabled={
                        isBrowserSaving ||
                        browserDevices.some((device) => device.id === browserDeviceId)
                      }
                      className={`${browserDevices.some((device) => device.id === browserDeviceId)
                        ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                      {isBrowserSaving
                        ? t('common.saving')
                        : browserDevices.some((device) => device.id === browserDeviceId)
                          ? t('settings.notifications.discord.enabled')
                          : t('settings.notifications.browser.add')}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {browserDevices.length === 0 ? (
                      <p className="text-sm text-white/60">
                        {t('settings.notifications.browser.none')}
                      </p>
                    ) : (
                      browserDevices.map((device) => (
                        <div
                          key={device.id}
                          className="flex items-center justify-between gap-3 rounded border border-white/10 bg-slate-900/50 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white">{device.name}</p>
                            <p className="text-xs text-white/50">
                              {device.id === browserDeviceId
                                ? t('settings.notifications.browser.current')
                                : t('settings.notifications.browser.registered')}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void handleRemoveBrowserDevice(device.id)}
                            disabled={isBrowserSaving}
                            className="text-red-300 hover:text-red-200 hover:bg-red-500/15"
                          >
                            {t('common.remove')}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  {browserMessage && (
                    <p className="text-sm text-blue-300 p-2 bg-blue-900/20 rounded">
                      ✓ {browserMessage}
                    </p>
                  )}

                  {browserError && (
                    <p className="text-sm text-red-300 p-2 bg-red-900/30 rounded">
                      ✗ {browserError}
                    </p>
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
        </TabsContent>

        {user?.username === 'admin' && (
          <>
            <TabsContent value="users">
              <Card className="border-orange-500/30 bg-orange-950/15 text-white">
                <CardHeader>
                  <CardTitle className="text-orange-200">{t('settings.users.title')}</CardTitle>
                  <CardDescription className="text-orange-100/70">
                    {t('settings.users.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Create User Button + Dialog */}
                  <div className="flex items-center justify-between">
                    <div>
                      {usersMessage && <p className="text-sm text-emerald-300">{usersMessage}</p>}
                      {usersError && <p className="text-sm text-red-300">{usersError}</p>}
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        setUsersMessage(null);
                        setUsersError(null);
                        setCreatedUserCredentials(null);
                        setNewUsername('');
                        setIsCreateUserOpen(true);
                      }}
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      {t('settings.users.createNew')}
                    </Button>
                  </div>

                  <Dialog
                    open={isCreateUserOpen}
                    onOpenChange={(open) => {
                      if (!isCreatingUser) {
                        setIsCreateUserOpen(open);
                        if (!open) {
                          setUsersError(null);
                        }
                      }
                    }}
                  >
                    <DialogContent className="border-orange-500/30 bg-slate-950 text-white">
                      <DialogHeader>
                        <DialogTitle className="text-orange-200">
                          {t('settings.users.createNew')}
                        </DialogTitle>
                        <DialogDescription className="text-white/70">
                          {t('settings.users.createDescription')}
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateUser}>
                        <div className="space-y-4 py-2">
                          <div className="space-y-2">
                            <Label htmlFor="new-username">{t('settings.users.username')}</Label>
                            <Input
                              id="new-username"
                              placeholder="john_doe"
                              value={newUsername}
                              onChange={(e) => setNewUsername(e.target.value)}
                              className="bg-slate-900 border-white/10 text-white"
                              autoFocus
                            />
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-white/60">
                              {t('settings.users.passwordGeneratedOnCreate')}
                            </p>
                          </div>
                          {usersError && <p className="text-sm text-red-300">{usersError}</p>}
                        </div>
                        <DialogFooter className="mt-4">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsCreateUserOpen(false)}
                            disabled={isCreatingUser}
                            className="border border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                          >
                            {t('common.cancel')}
                          </Button>
                          <Button
                            type="submit"
                            disabled={isCreatingUser}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            {isCreatingUser ? t('common.saving') : t('settings.users.create')}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={isCreatedUserModalOpen && createdUserCredentials !== null}
                    onOpenChange={(open) => {
                      setIsCreatedUserModalOpen(open);
                      if (!open) {
                        setIsGeneratedPasswordCopied(false);
                        setCreatedUserCredentials(null);
                      }
                    }}
                  >
                    <DialogContent className="border-emerald-500/30 bg-slate-950 text-white">
                      <DialogHeader>
                        <DialogTitle className="text-emerald-200">
                          {t('settings.users.generatedPasswordTitle')}
                        </DialogTitle>
                        <DialogDescription className="text-white/70">
                          {generatedPasswordContext === 'create'
                            ? t('settings.users.generatedPasswordDescription', {
                              username: createdUserCredentials?.username || '',
                            })
                            : t('settings.users.generatedPasswordDescriptionReset', {
                              username: createdUserCredentials?.username || '',
                            })}
                        </DialogDescription>
                      </DialogHeader>

                      <button
                        type="button"
                        onClick={() => void handleCopyGeneratedPassword()}
                        className={
                          'group rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 w-full text-left transition-all ' +
                          (isGeneratedPasswordCopied
                            ? 'ring-2 ring-emerald-400/60'
                            : 'hover:bg-emerald-400/10 focus-visible:ring-2 focus-visible:ring-emerald-400/60')
                        }
                        title={isGeneratedPasswordCopied ? t('common.copied') : t('common.copy')}
                      >
                        <p className="text-xs text-emerald-100/80">
                          {t('settings.users.newPassword')}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="font-mono text-lg text-emerald-100 select-all">
                            {createdUserCredentials?.password}
                          </p>
                          <span className="h-8 w-8 flex items-center justify-center text-emerald-100/70">
                            {isGeneratedPasswordCopied ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </span>
                        </div>
                      </button>

                      <DialogFooter>
                        <Button
                          type="button"
                          onClick={() => {
                            setIsCreatedUserModalOpen(false);
                            setIsGeneratedPasswordCopied(false);
                            setCreatedUserCredentials(null);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {t('common.close')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Reset Password Dialog */}
                  <Dialog
                    open={resetPasswordTargetId !== null}
                    onOpenChange={(open) => {
                      if (!isResettingPassword && !open) {
                        setResetPasswordTargetId(null);
                        setUsersError(null);
                      }
                    }}
                  >
                    <DialogContent className="border-blue-500/30 bg-slate-950 text-white">
                      <DialogHeader>
                        <DialogTitle className="text-blue-200">
                          {t('settings.users.resetPasswordTitle')}
                        </DialogTitle>
                        <DialogDescription className="text-white/70">
                          {t('settings.users.resetPasswordDescription', {
                            username:
                              users.find((u) => u.id === resetPasswordTargetId)?.username ?? '',
                          })}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 py-2">
                        <p className="text-sm text-white/70">
                          {t('settings.users.passwordGeneratedOnReset')}
                        </p>
                        {usersError && <p className="text-sm text-red-300">{usersError}</p>}
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setResetPasswordTargetId(null);
                            setUsersError(null);
                          }}
                          disabled={isResettingPassword}
                          className="border border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void handleResetUserPassword()}
                          disabled={isResettingPassword}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {isResettingPassword ? t('common.saving') : t('settings.users.resetButton')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>


                  {/* Display : if big screen */}
                  <div className="hidden lg:block gap-6 lg:grid-cols-[280px_minmax(0,1fr)] overflow-x-auto max-w-full">
                    <UserList
                      users={users}
                      isLoading={isLoadingUsers}
                      isDeletingUser={isDeletingUser}
                      t={t}
                      onResetPassword={(userId) => {
                        setUsersError(null);
                        setResetPasswordTargetId(userId);
                      }}
                      onDeleteUser={(userId, username) => void handleDeleteUser(userId, username)}
                    />
                  </div>

                </CardContent>
              </Card>

              {/* Display : if small screen */}
              <div className="lg:hidden mt-6">
                <UserList
                  users={users}
                  isLoading={isLoadingUsers}
                  isDeletingUser={isDeletingUser}
                  t={t}
                  onResetPassword={(userId) => {
                    setUsersError(null);
                    setResetPasswordTargetId(userId);
                  }}
                  onDeleteUser={(userId, username) => void handleDeleteUser(userId, username)}
                />
              </div>
            </TabsContent>

            <TabsContent value="database">
              {/* Desktop : Card avec grid */}
              <Card className="border-teal-500/30 bg-teal-950/15 text-white">
                <CardHeader>
                  <CardTitle className="text-teal-200">{t('settings.database.title')}</CardTitle>
                  <CardDescription className="text-teal-100/70">
                    {t('settings.database.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    {t('settings.database.warning')}
                  </div>
                  <div className="hidden lg:block overflow-x-auto max-w-full">
                    <DatabaseNamespaceList
                      t={t}
                      isLoading={isLoadingDatabaseNamespaces}
                      namespaces={databaseNamespaces}
                      selectedNamespace={selectedDatabaseNamespace}
                      onReload={handleDatabaseNamespacesReload}
                      onSelect={setSelectedDatabaseNamespace}
                    />

                    <DatabaseRawEditorPanel
                      t={t}
                      selectedNamespace={selectedDatabaseNamespace}
                      updatedAt={databaseUpdatedAt}
                      isLoadingValue={isLoadingDatabaseValue}
                      isSavingValue={isSavingDatabaseValue}
                      rawValue={databaseRawValue}
                      onRawValueChange={setDatabaseRawValue}
                      onReload={handleDatabaseReload}
                      onPrettyFormat={handleDatabasePrettyFormat}
                      onSave={handleDatabaseSave}
                      message={databaseMessage}
                      error={databaseError}
                    />
                  </div>
                </CardContent>
              </Card>
              {/* Mobile/tablette : composants hors Card */}
              <div className="flex flex-col gap-6 lg:hidden mt-6">
                <DatabaseNamespaceList
                  t={t}
                  isLoading={isLoadingDatabaseNamespaces}
                  namespaces={databaseNamespaces}
                  selectedNamespace={selectedDatabaseNamespace}
                  onReload={handleDatabaseNamespacesReload}
                  onSelect={setSelectedDatabaseNamespace}
                />
                <DatabaseRawEditorPanel
                  t={t}
                  selectedNamespace={selectedDatabaseNamespace}
                  updatedAt={databaseUpdatedAt}
                  isLoadingValue={isLoadingDatabaseValue}
                  isSavingValue={isSavingDatabaseValue}
                  rawValue={databaseRawValue}
                  onRawValueChange={setDatabaseRawValue}
                  onReload={handleDatabaseReload}
                  onPrettyFormat={handleDatabasePrettyFormat}
                  onSave={handleDatabaseSave}
                  message={databaseMessage}
                  error={databaseError}
                />
              </div>
            </TabsContent>

            <TabsContent value="factory">
              <Card className="border-red-500/30 bg-red-950/15 text-white">
                <CardHeader>
                  <CardTitle className="text-red-200">{t('settings.factory.title')}</CardTitle>
                  <CardDescription className="text-red-100/70">
                    {t('settings.factory.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {resetError && <p className="text-sm text-red-300">{resetError}</p>}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={isResetting}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        {isResetting ? t('settings.factory.resetting') : t('settings.factory.reset')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-red-500/30 bg-slate-950 text-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-200">
                          {t('settings.factory.confirmTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white/70">
                          {t('settings.factory.confirmDescription')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">
                          {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleResetSettings}
                          className="bg-red-600 text-white hover:bg-red-700"
                        >
                          {t('settings.factory.confirmAction')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
