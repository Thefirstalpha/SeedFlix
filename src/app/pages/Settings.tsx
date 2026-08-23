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
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';


import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';
import { useI18n, type SupportedLanguage } from '../i18n/LanguageProvider';
import {
  resetSettings
} from '../services/authService';
import { SettingTMDB } from '../components/settings/SettingTMDB';
import { SettingUsers } from '../components/settings/SettingUsers';
import { SettingTransmission } from '../components/settings/SettingTransmission';
import { SettingIndexer } from '../components/settings/SettingIndexer';
import { SettingDatabase } from '../components/settings/SettingDatabase';
import { SettingPassword } from '../components/settings/SettingPassword';
import { SettingNotification } from '../components/settings/SettingNotification';
import { SettingFtp } from '../components/settings/SettingFtp';
import { SettingLogs } from '../components/settings/SettingLogs';
import { updateLanguage, updateSpoilerMode } from '../services/settingService';


const SETTINGS_TABS = ['general', 'notifications', 'api', 'transmission', 'indexer', 'ftp', 'users', 'database', 'logs', 'factory'] as const;
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
  const { isAuthenticated, isLoading, user, refresh } =
    useAuth();
  const { t, language, availableLanguages, setLanguage } = useI18n();
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [languageCode, setLanguageCode] = useState<SupportedLanguage>(language);
  const [spoilerMode, setSpoilerMode] = useState(user?.settings?.spoilerMode as boolean || false);
  const [preferencesMessage, setPreferencesMessage] = useState<string | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [isPreferencesSaving, setIsPreferencesSaving] = useState(false);


  const [version, setVersion] = useState('dev');


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




  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const handleResetSettings = async () => {
    if (user?.username !== 'admin') {
      setResetError(t('auth.adminRequired'));
      return;
    }

    setResetError(null);
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


  const saveLanguage = async (nextLanguage: SupportedLanguage) => {
    setPreferencesMessage(null);
    setPreferencesError(null);
    setIsPreferencesSaving(true);

    try {
      await updateLanguage(nextLanguage);
      setLanguage(nextLanguage);
      setLanguageCode(nextLanguage);
      await refresh();
      setPreferencesMessage(t('settings.language.success'));
    } catch (submitError) {
      setPreferencesError(
        submitError instanceof Error ? submitError.message : t('settings.language.failed'),
      );
    } finally {
      setIsPreferencesSaving(false);
    }
  };


  const handleSpoilerChange = async (nextSpoilerSetting: boolean) => {
    setPreferencesMessage(null);
    setPreferencesError(null);
    setIsPreferencesSaving(true);

    try {
      await updateSpoilerMode(nextSpoilerSetting);
      setSpoilerMode(nextSpoilerSetting);
      await refresh();
      setPreferencesMessage(t('settings.spoilers.saved'));
    } catch (submitError) {
      setPreferencesError(
        submitError instanceof Error ? submitError.message : t('settings.spoilers.failed'),
      );
    } finally {
      setIsPreferencesSaving(false);
    }
  };


  useEffect(() => {
    fetch('/VERSION')
      .then((response) => response.text())
      .then((data) => setVersion(data))
      .catch((error) => console.error("Erreur de lecture", error));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">{t('settings.title')}</h2>
        <p className="mt-2 text-sm text-white/60">
          Version: {version}
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
              value="transmission"
              className="flex-none text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              {t('settings.tabs.transmission')}
            </TabsTrigger>
            <TabsTrigger
              value="indexer"
              className="flex-none text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              {t('settings.tabs.indexer')}
            </TabsTrigger>
            <TabsTrigger
              value="ftp"
              className="flex-none text-white data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
            >
              {t('settings.tabs.storage')}
            </TabsTrigger>
            {user?.username === 'admin' && (
              <>
                <TabsTrigger
                  value="api"
                  className="flex-none text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  {t('settings.tabs.configuration')}
                </TabsTrigger>
                <TabsTrigger
                  value="users"
                  className="flex-none text-white data-[state=active]:bg-orange-600 data-[state=active]:text-white"
                >
                  {t('settings.tabs.users')}
                </TabsTrigger>
                <TabsTrigger
                  value="database"
                  className="flex-none text-white data-[state=active]:bg-teal-600 data-[state=active]:text-white"
                >
                  {t('settings.tabs.database')}
                </TabsTrigger>
                <TabsTrigger
                  value="logs"
                  className="flex-none text-white data-[state=active]:bg-red-600 data-[state=active]:text-white"
                >
                  Logs
                </TabsTrigger>
                <TabsTrigger
                  value="factory"
                  className="flex-none text-white data-[state=active]:bg-red-600 data-[state=active]:text-white"
                >
                  {t('settings.tabs.factory')}
                </TabsTrigger>
              </>
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
                      void saveLanguage(parseSupportedLanguage(event.target.value))
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

          <SettingPassword setup={false}></SettingPassword>
        </TabsContent>

        <TabsContent value="transmission">
          <SettingTransmission setup={false}></SettingTransmission>
        </TabsContent>

        <TabsContent value="indexer">
          <SettingIndexer setup={false}></SettingIndexer>
        </TabsContent>

        <TabsContent value="notifications">
          <SettingNotification></SettingNotification>
        </TabsContent>
        <TabsContent value="ftp">
          <SettingFtp></SettingFtp>
        </TabsContent>

        {user?.username === 'admin' && (
          <>

            <TabsContent value="api">
              <SettingTMDB></SettingTMDB>
            </TabsContent>

            <TabsContent value="users">
              <SettingUsers></SettingUsers>
            </TabsContent>

            <TabsContent value="database">
              <SettingDatabase></SettingDatabase>
            </TabsContent>
            <TabsContent value="logs">
              <SettingLogs></SettingLogs>
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
