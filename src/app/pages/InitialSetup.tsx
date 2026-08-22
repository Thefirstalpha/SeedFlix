import {
  Check,
  ExternalLink,
  KeyRound,
  RadioTower,
  Scale,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { SubmitEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { useAuth } from '../context/AuthContext';
import {
  acceptLegal
} from '../services/authService';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { useI18n, type SupportedLanguage } from '../i18n/LanguageProvider';
import { configureTmdb, isTmdbConfigure, updateLanguage } from '../services/settingService';
import { SettingTransmission } from '../components/settings/SettingTransmission';
import { SettingIndexer } from '../components/settings/SettingIndexer';
import { SettingPassword } from '../components/settings/SettingPassword';
import { SettingFtp } from '../components/settings/SettingFtp';

function parseSupportedLanguage(input: unknown): SupportedLanguage {
  return input === 'en' ? 'en' : 'fr';
}

export function InitialSetup() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isLoading,
    user,
    refresh,
  } = useAuth();
  const hasPendingSetup = user?.flags?.mustSetup || user?.settings?.indexer === null || user?.settings?.transmission === null || user?.settings?.ftp === null;
  const { t, availableLanguages, setLanguage } = useI18n();

  const [activeStep, setActiveStep] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [mustConfigureTmdb, setMustConfigureTmdb] = useState(false);

  const [tmdbApiKey, setTmdbApiKey] = useState('');
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [tmdbMessage, setTmdbMessage] = useState<string | null>(null);
  const [isTmdbSaving, setIsTmdbSaving] = useState(false);


  const [languageCode, setLanguageCode] = useState<SupportedLanguage>('fr');
  const [languageMessage, setLanguageMessage] = useState<string | null>(null);
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [isLanguageSaving, setIsLanguageSaving] = useState(false);
  const [legalCheckboxChecked, setLegalCheckboxChecked] = useState(false);
  const [isLegalSaving, setIsLegalSaving] = useState(false);
  const [legalError, setLegalError] = useState<string | null>(null);
  const stepsScrollerRef = useRef<HTMLDivElement | null>(null);
  const stepItemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const isAdmin = user?.username === 'admin';

  const visibleSteps = useMemo(
    () =>
      [
        {
          key: 'legal',
          title: t('setup.steps.legal'),
          icon: Scale,
          required: user?.flags?.legalAccepted === false,
        },
        {
          key: 'password',
          title: t('setup.steps.security'),
          icon: ShieldCheck,
          required: user?.flags?.mustUpdatePassword === true,
        },
        {
          key: 'tmdb',
          title: t('setup.steps.tmdb'),
          icon: KeyRound,
          required: mustConfigureTmdb
        },
        {
          key: 'torrent',
          title: t('setup.steps.torrent'),
          icon: Server,
          required: user?.settings?.transmission === null,
        },
        {
          key: 'indexer',
          title: t('setup.steps.indexer'),
          icon: RadioTower,
          required: user?.settings?.indexer === null,
        },
        {
          key: 'ftp',
          title: t('setup.steps.ftp'),
          icon: Server,
          required: user?.settings?.ftp === null,
        },
      ]
        .filter((step) => isAdmin || step.key !== 'tmdb'),
    [
      isAdmin,
      mustConfigureTmdb,
      t,
    ],
  );

  const totalSteps = visibleSteps.length;

  const firstIncompleteStep = useMemo(() => {
    const index = visibleSteps.findIndex((step) => step.required);
    return index === -1 ? totalSteps : index;
  }, [totalSteps, visibleSteps]);

  useEffect(() => {
    setLanguageCode(parseSupportedLanguage(user?.settings?.language));
  }, [user?.username, user?.settings]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const loadSettings = async () => {
      try {
        const response = await isTmdbConfigure();
        setMustConfigureTmdb(!response);
      } finally {
        setIsBootstrapping(false);
      }
    };

    void loadSettings();
  }, [isAuthenticated, user?.username]);

  useEffect(() => {
    if (!isLoading && !hasPendingSetup) {
      navigate('/', { replace: true });
      return;
    }

    if (!isLoading && firstIncompleteStep < totalSteps) {
      setActiveStep(firstIncompleteStep);
    }
  }, [firstIncompleteStep, hasPendingSetup, isLoading, location.state, navigate, totalSteps]);

  useEffect(() => {
    const activeStepElement = stepItemRefs.current[activeStep];
    const scrollerElement = stepsScrollerRef.current;

    if (!activeStepElement || !scrollerElement) {
      return;
    }

    activeStepElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeStep, totalSteps, user, isLoading]);

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isLoading && !hasPendingSetup) {
    return <Navigate to={(location.state as { from?: string } | null)?.from || '/'} replace />;
  }

  const shouldShowPreparingScreen = isBootstrapping || (isLoading && !isAuthenticated);

  if (shouldShowPreparingScreen) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white/70">
        {t('setup.preparing')}
      </div>
    );
  }

  const currentStep = visibleSteps[activeStep];
  const currentStepNumber = activeStep + 1;
  const progressValue = totalSteps > 0 ? (currentStepNumber / totalSteps) * 100 : 0;


  const goToNextVisibleStep = async () => {
    await refresh();
    if (activeStep >= totalSteps - 1) {
      navigate('/', { replace: true });
      return;
    }

    setActiveStep((current) => Math.min(current + 1, totalSteps - 1));
  };

  const saveLanguage = async (nextLanguage: SupportedLanguage) => {
    setLanguageMessage(null);
    setLanguageError(null);
    setIsLanguageSaving(true);

    try {
      await updateLanguage(nextLanguage);
      setLanguage(nextLanguage);
      await refresh();
      setLanguageMessage(t('settings.language.success'));
    } catch (submitError) {
      setLanguageError(
        submitError instanceof Error ? submitError.message : t('settings.language.failed'),
      );
    } finally {
      setIsLanguageSaving(false);
    }
  };

  const handleLegalAccept = async () => {
    setLegalError(null);
    setIsLegalSaving(true);
    try {
      await acceptLegal();
      await goToNextVisibleStep();
    } catch (err) {
      setLegalError(err instanceof Error ? err.message : t('common.loading'));
    } finally {
      setIsLegalSaving(false);
    }
  };

  const handleTmdbSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    setTmdbError(null);
    setTmdbMessage(null);

    if (!tmdbApiKey.trim()) {
      setTmdbError(t('setup.tmdb.errors.required'));
      return;
    }

    setIsTmdbSaving(true);
    try {
      await configureTmdb(tmdbApiKey.trim());
      setTmdbMessage('');
      await goToNextVisibleStep();
    } catch (submitError) {
      setTmdbError(
        submitError instanceof Error ? submitError.message : t('setup.tmdb.errors.configFailed'),
      );
    } finally {
      setIsTmdbSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-center gap-3">
        <img src="/favicon.svg" alt={t('common.appName')} className="h-12 w-12 rounded-sm" />
        <h1 className="text-4xl font-black text-white tracking-tighter">{t('common.appName')}</h1>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
            {t('setup.badge')}
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tight text-white">{t('setup.title')}</h2>
          </div>
        </div>

        <div className="w-full max-w-[220px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white backdrop-blur-sm md:mt-1">
          <div className="space-y-1.5">
            <Label htmlFor="setup-language" className="text-xs text-white/70">
              {t('settings.language.field')}
            </Label>
            <select
              id="setup-language"
              value={languageCode}
              disabled={isLanguageSaving}
              onChange={(event) => {
                const nextLanguage = parseSupportedLanguage(event.target.value);
                setLanguageCode(nextLanguage);
                void saveLanguage(nextLanguage);
              }}
              className="h-9 w-full rounded-md border border-white/10 bg-slate-900 px-2.5 text-sm text-white outline-none disabled:opacity-60"
            >
              {availableLanguages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </div>
          {languageMessage ? (
            <p className="mt-1.5 text-xs text-emerald-300">{languageMessage}</p>
          ) : null}
          {languageError ? <p className="mt-1.5 text-xs text-red-300">{languageError}</p> : null}
        </div>
      </div>

      <Card className="border-white/10 bg-white/5 text-white">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="mt-1 text-2xl font-semibold text-white">{currentStep?.title}</h3>
            </div>
            <div className="text-sm text-white/60">
              <p className="text-sm uppercase tracking-[0.22em] text-white/45">
                {t('setup.progress', { current: currentStepNumber, total: totalSteps })}
              </p>
            </div>
          </div>

          <Progress value={progressValue} className="bg-white/10" />

          <div ref={stepsScrollerRef} className="overflow-x-auto pb-1 [scrollbar-width:thin]">
            <div className="flex min-w-full gap-3">
              {visibleSteps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === activeStep;
                const isComplete = !step.required && index < firstIncompleteStep;

                return (
                  <div
                    key={step.key}
                    ref={(node) => {
                      stepItemRefs.current[index] = node;
                    }}
                    className={`rounded-xl border px-4 py-3 text-left transition ${isActive
                      ? 'border-cyan-400/60 bg-cyan-400/10'
                      : 'border-white/10 bg-black/10 hover:bg-white/5'
                      } min-w-[220px] shrink-0`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-white/10 p-2">
                          <Icon className="h-4 w-4 text-cyan-200" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-white/45">
                            {t('setup.stepLabel', { index: index + 1 })}
                          </p>
                          <p className="font-medium text-white whitespace-nowrap">{step.title}</p>
                        </div>
                      </div>
                      {isComplete ? <Check className="h-4 w-4 text-emerald-300" /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {currentStep?.key === 'legal' ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-cyan-300" />
              {t('setup.legal.cardTitle')}
            </CardTitle>
            <CardDescription className="text-white/60">
              {t('setup.legal.cardDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2.5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/75">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">•</span>
                <span>{t('setup.legal.term1')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">•</span>
                <span>{t('setup.legal.term2')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">•</span>
                <span>{t('setup.legal.term3')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">•</span>
                <span>{t('setup.legal.term4')}</span>
              </li>
            </ul>
            <div className="flex items-start gap-3">
              <Checkbox
                id="legal-accept-checkbox"
                checked={legalCheckboxChecked}
                onCheckedChange={(checked) => setLegalCheckboxChecked(Boolean(checked))}
                className="mt-0.5"
              />
              <Label
                htmlFor="legal-accept-checkbox"
                className="cursor-pointer text-sm leading-snug text-white/80"
              >
                {t('setup.legal.checkbox')}
              </Label>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleLegalAccept}
                disabled={!legalCheckboxChecked || isLegalSaving}
                className="bg-cyan-600 text-white hover:bg-cyan-700"
              >
                {isLegalSaving ? t('common.saving') : t('setup.legal.accept')}
              </Button>
            </div>
            {legalError ? <p className="text-sm text-red-400">{legalError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {currentStep?.key === 'password' ? (
          <SettingPassword setup={true} onComplete={goToNextVisibleStep}></SettingPassword>
      ) : null}

      {currentStep?.key === 'tmdb' ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>{t('setup.tmdb.cardTitle')}</CardTitle>
            <CardDescription className="text-white/60">
              {t('setup.tmdb.cardDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTmdbSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="setup-tmdb-key">{t('setup.tmdb.keyLabel')}</Label>
                  <a
                    href="https://developer.themoviedb.org/docs/getting-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-cyan-300 transition-colors hover:text-cyan-200"
                  >
                    {t('setup.tmdb.documentation')}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <Input
                  id="setup-tmdb-key"
                  type="password"
                  value={tmdbApiKey}
                  onChange={(event) => setTmdbApiKey(event.target.value)}
                  placeholder={t('setup.tmdb.placeholder')}
                  className="border-white/10 bg-slate-900 text-white"
                />
                <p className="text-xs text-white/55">{t('setup.tmdb.helper')}</p>
              </div>
              {tmdbMessage ? <p className="text-sm text-emerald-300">{tmdbMessage}</p> : null}
              {tmdbError ? <p className="text-sm text-red-300">{tmdbError}</p> : null}
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="submit"
                  disabled={isTmdbSaving}
                  className="bg-cyan-600 text-white hover:bg-cyan-700"
                >
                  {isTmdbSaving ? t('setup.tmdb.testing') : t('setup.tmdb.saveAndContinue')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {currentStep?.key === 'torrent' ? (
        <SettingTransmission setup={true} onComplete={goToNextVisibleStep}></SettingTransmission>
      ) : null}

      {currentStep?.key === 'indexer' ? (
        <SettingIndexer setup={true} onComplete={goToNextVisibleStep}></SettingIndexer>
      ) : null}

      
      {currentStep?.key === 'ftp' ? (
          <SettingFtp setup={true} onComplete={goToNextVisibleStep}></SettingFtp>
      ) : null}

    </div>
  );
}
