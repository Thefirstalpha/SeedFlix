import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Check, ExternalLink, KeyRound, RadioTower, Scale, Server, ShieldCheck } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import {
  changePassword,
  getGlobalSettings,
  getSettings,
  testIndexerConnection,
  testTmdbApiKey,
  testTorrentConnection,
  updateGlobalSettings,
  updateSettings,
  type UserSettings,
} from "../services/authService";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";
import { Checkbox } from "./ui/checkbox";
import { Switch } from "./ui/switch";
import { useI18n, type SupportedLanguage } from "../i18n/LanguageProvider";

function parseSupportedLanguage(input: unknown): SupportedLanguage {
  return input === "en" ? "en" : "fr";
}

function buildFallbackSettings(username = "admin"): UserSettings {
  return {
    profile: {
      username,
    },
    security: {
      lastPasswordChangeAt: new Date().toISOString(),
    },
    apiKeys: {
      tmdb: "",
    },
    placeholders: {
      notifications: {},
      preferences: {
        language: "fr",
      },
      torrent: {
        url: "",
        port: "",
        authRequired: false,
        username: "",
        password: "",
        moviesFolder: "",
        seriesFolder: "",
      },
      indexer: {
        url: "",
        token: "",
        defaultQuality: "all",
      },
    },
  };
}

export function InitialSetup() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isLoading,
    user,
    settings,
    setSettings,
    refresh,
    mustChangePassword,
    mustConfigureTmdb,
    mustConfigureTorrent,
    mustConfigureIndexer,
    needsInitialSetup,
  } = useAuth();
  const hasPendingSetup =
    needsInitialSetup ||
    mustChangePassword ||
    mustConfigureTmdb ||
    mustConfigureTorrent ||
    mustConfigureIndexer;
  const { t, availableLanguages, setLanguage } = useI18n();

  const [activeStep, setActiveStep] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  const [tmdbApiKey, setTmdbApiKey] = useState("");
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [tmdbMessage, setTmdbMessage] = useState<string | null>(null);
  const [isTmdbSaving, setIsTmdbSaving] = useState(false);

  const [torrentUrl, setTorrentUrl] = useState("");
  const [torrentPort, setTorrentPort] = useState("");
  const [torrentAuthRequired, setTorrentAuthRequired] = useState(false);
  const [torrentUsername, setTorrentUsername] = useState("");
  const [torrentPassword, setTorrentPassword] = useState("");
  const [torrentMoviesFolder, setTorrentMoviesFolder] = useState("");
  const [torrentSeriesFolder, setTorrentSeriesFolder] = useState("");
  const [torrentError, setTorrentError] = useState<string | null>(null);
  const [isTorrentSaving, setIsTorrentSaving] = useState(false);

  const [indexerUrl, setIndexerUrl] = useState("");
  const [indexerToken, setIndexerToken] = useState("");
  const [indexerDefaultQuality, setIndexerDefaultQuality] = useState("all");
  const [indexerError, setIndexerError] = useState<string | null>(null);
  const [isIndexerSaving, setIsIndexerSaving] = useState(false);
  const [languageCode, setLanguageCode] = useState<SupportedLanguage>("fr");
  const [languageMessage, setLanguageMessage] = useState<string | null>(null);
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [isLanguageSaving, setIsLanguageSaving] = useState(false);
  const [legalCheckboxChecked, setLegalCheckboxChecked] = useState(false);
  const isAdmin = user?.username === "admin";

  const visibleSteps = useMemo(
    () => [
      { key: "legal", title: t("setup.steps.legal"), icon: Scale, required: needsInitialSetup },
      { key: "password", title: t("setup.steps.security"), icon: ShieldCheck, required: mustChangePassword },
      { key: "tmdb", title: t("setup.steps.tmdb"), icon: KeyRound, required: mustConfigureTmdb },
      { key: "torrent", title: t("setup.steps.torrent"), icon: Server, required: mustConfigureTorrent },
      { key: "indexer", title: t("setup.steps.indexer"), icon: RadioTower, required: mustConfigureIndexer },
    ]
      .filter((step) => step.key !== "legal" || needsInitialSetup)
      .filter((step) => isAdmin || step.key !== "tmdb"),
    [isAdmin, mustChangePassword, mustConfigureIndexer, mustConfigureTmdb, mustConfigureTorrent, needsInitialSetup, t]
  );

  const totalSteps = visibleSteps.length;

  const firstIncompleteStep = useMemo(() => {
    const index = visibleSteps.findIndex((step) => step.required);
    return index === -1 ? totalSteps : index;
  }, [totalSteps, visibleSteps]);

  useEffect(() => {
    const sourceSettings = settings || buildFallbackSettings(user?.username || "admin");
    const torrentSettings = sourceSettings.placeholders?.torrent || {};
    const indexerSettings = sourceSettings.placeholders?.indexer || {};

    setTorrentUrl(torrentSettings.url || "");
    setTorrentPort(torrentSettings.port || "");
    setTorrentAuthRequired(Boolean(torrentSettings.authRequired));
    setTorrentUsername(torrentSettings.username || "");
    setTorrentPassword(torrentSettings.password || "");
    setTorrentMoviesFolder(torrentSettings.moviesFolder || "");
    setTorrentSeriesFolder(torrentSettings.seriesFolder || "");
    setIndexerUrl(indexerSettings.url || "");
    setIndexerToken(indexerSettings.token || "");
    setIndexerDefaultQuality(indexerSettings.defaultQuality || "all");
    setLanguageCode(parseSupportedLanguage(sourceSettings.placeholders?.preferences?.language));
  }, [settings, user?.username]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const loadSettings = async () => {
      try {
        const response = await getSettings();
        setSettings(response);
        if (user?.username === "admin") {
          const globalSettings = await getGlobalSettings();
          setTmdbApiKey(globalSettings.tmdbApiKey || "");
        }
      } finally {
        setIsBootstrapping(false);
      }
    };

    void loadSettings();
  }, [isAuthenticated, setSettings, user?.username]);

  useEffect(() => {
    if (!isLoading && !hasPendingSetup) {
      navigate("/", { replace: true });
      return;
    }

    if (!isLoading && firstIncompleteStep < totalSteps) {
      setActiveStep(firstIncompleteStep);
    }
  }, [firstIncompleteStep, hasPendingSetup, isLoading, location.state, navigate, totalSteps]);

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isLoading && !hasPendingSetup) {
    return <Navigate to={(location.state as { from?: string } | null)?.from || "/"} replace />;
  }

  if (isLoading || isBootstrapping) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white/70">
        {t("setup.preparing")}
      </div>
    );
  }

  const currentStep = visibleSteps[activeStep];
  const currentStepNumber = activeStep + 1;
  const progressValue = totalSteps > 0 ? (currentStepNumber / totalSteps) * 100 : 0;
  const currentSettings = settings || buildFallbackSettings(user?.username || "admin");

  const buildUpdatedSettings = (overrides: Partial<UserSettings>): UserSettings => ({
    ...currentSettings,
    ...overrides,
    apiKeys: {
      ...(currentSettings.apiKeys || { tmdb: "" }),
      ...(overrides.apiKeys || {}),
    },
    placeholders: {
      ...(currentSettings.placeholders || buildFallbackSettings(user?.username || "admin").placeholders),
      ...(overrides.placeholders || {}),
      preferences: {
        ...(currentSettings.placeholders?.preferences || {}),
        ...(overrides.placeholders?.preferences || {}),
      },
      torrent: {
        ...(currentSettings.placeholders?.torrent || {}),
        ...(overrides.placeholders?.torrent || {}),
      },
      indexer: {
        ...(currentSettings.placeholders?.indexer || {}),
        ...(overrides.placeholders?.indexer || {}),
      },
    },
  });

  const goToNextVisibleStep = () => {
    if (activeStep >= totalSteps - 1) {
      navigate("/", { replace: true });
      return;
    }

    setActiveStep((current) => Math.min(current + 1, totalSteps - 1));
  };

  const saveLanguage = async (nextLanguage: SupportedLanguage) => {
    setLanguageMessage(null);
    setLanguageError(null);
    setIsLanguageSaving(true);

    try {
      const updatedSettings = buildUpdatedSettings({
        placeholders: {
          preferences: {
            ...(currentSettings.placeholders?.preferences || {}),
            language: nextLanguage,
          },
        },
      });

      await updateSettings(updatedSettings);
      setSettings(updatedSettings);
      setLanguage(nextLanguage);
      await refresh();
      setLanguageMessage(t("settings.language.success"));
    } catch (submitError) {
      setLanguageError(
        submitError instanceof Error ? submitError.message : t("settings.language.failed")
      );
    } finally {
      setIsLanguageSaving(false);
    }
  };

  const handleLegalAccept = () => {
    goToNextVisibleStep();
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);

    if (!newPassword) {
      setPasswordError(t("setup.password.errors.required"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("setup.password.errors.mismatch"));
      return;
    }

    if (user?.username !== "admin" && !currentPassword) {
      setPasswordError(t("setup.password.errors.required"));
      return;
    }

    setIsPasswordSaving(true);
    try {
      await changePassword(user?.username === "admin" ? "admin" : currentPassword, newPassword);
      await refresh();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      goToNextVisibleStep();
    } catch (submitError) {
      setPasswordError(
        submitError instanceof Error ? submitError.message : t("setup.password.errors.updateFailed")
      );
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handleTmdbSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTmdbError(null);
    setTmdbMessage(null);

    if (!tmdbApiKey.trim()) {
      setTmdbError(t("setup.tmdb.errors.required"));
      return;
    }

    setIsTmdbSaving(true);
    try {
      const testResponse = await testTmdbApiKey(tmdbApiKey.trim());
      const savedGlobalSettings = await updateGlobalSettings({ tmdbApiKey: tmdbApiKey.trim() });
      setTmdbApiKey(savedGlobalSettings.tmdbApiKey || "");
      setTmdbMessage(testResponse.message);
      await refresh();

      goToNextVisibleStep();
    } catch (submitError) {
      setTmdbError(
        submitError instanceof Error ? submitError.message : t("setup.tmdb.errors.configFailed")
      );
    } finally {
      setIsTmdbSaving(false);
    }
  };

  const handleTorrentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTorrentError(null);

    if (!torrentUrl.trim() || !torrentPort.trim()) {
      setTorrentError(t("setup.torrent.errors.urlPortRequired"));
      return;
    }

    if (torrentAuthRequired && (!torrentUsername.trim() || !torrentPassword.trim())) {
      setTorrentError(t("setup.torrent.errors.credentialsRequired"));
      return;
    }

    setIsTorrentSaving(true);
    try {
      await testTorrentConnection({
        url: torrentUrl.trim(),
        port: torrentPort.trim(),
        authRequired: torrentAuthRequired,
        username: torrentUsername.trim(),
        password: torrentPassword,
      });

      const updatedSettings = buildUpdatedSettings({
        placeholders: {
          torrent: {
            url: torrentUrl.trim(),
            port: torrentPort.trim(),
            authRequired: torrentAuthRequired,
            username: torrentAuthRequired ? torrentUsername.trim() : "",
            password: torrentAuthRequired ? torrentPassword : "",
            moviesFolder: torrentMoviesFolder.trim(),
            seriesFolder: torrentSeriesFolder.trim(),
          },
        },
      });
      await updateSettings(updatedSettings);
      setSettings(updatedSettings);
      await refresh();
      goToNextVisibleStep();
    } catch (submitError) {
      setTorrentError(
        submitError instanceof Error ? submitError.message : t("setup.torrent.errors.configFailed")
      );
    } finally {
      setIsTorrentSaving(false);
    }
  };

  const handleIndexerSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIndexerError(null);

    if (!indexerUrl.trim() || !indexerToken.trim()) {
      setIndexerError(t("setup.indexer.errors.urlTokenRequired"));
      return;
    }

    setIsIndexerSaving(true);
    try {
      await testIndexerConnection(indexerUrl.trim(), indexerToken.trim());

      const updatedSettings = buildUpdatedSettings({
        placeholders: {
          indexer: {
            url: indexerUrl.trim(),
            token: indexerToken.trim(),
            defaultQuality: indexerDefaultQuality,
          },
        },
      });
      await updateSettings(updatedSettings);
      setSettings(updatedSettings);
      await refresh();

      navigate("/", { replace: true });
    } catch (submitError) {
      setIndexerError(
        submitError instanceof Error ? submitError.message : t("setup.indexer.errors.configFailed")
      );
    } finally {
      setIsIndexerSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-center gap-3">
        <img
          src="/favicon.svg"
          alt={t("common.appName")}
          className="h-12 w-12 rounded-sm"
        />
        <h1 className="text-4xl font-black text-white tracking-tighter">{t("common.appName")}</h1>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
            {t("setup.badge")}
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tight text-white">{t("setup.title")}</h2>
          </div>
        </div>

        <div className="w-full max-w-[220px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white backdrop-blur-sm md:mt-1">
          <div className="space-y-1.5">
            <Label htmlFor="setup-language" className="text-xs text-white/70">{t("settings.language.field")}</Label>
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
          {languageMessage ? <p className="mt-1.5 text-xs text-emerald-300">{languageMessage}</p> : null}
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
                {t("setup.progress", { current: currentStepNumber, total: totalSteps })}
              </p>
            </div>
          </div>

          <Progress value={progressValue} className="bg-white/10" />

          <div className={`grid gap-3 ${totalSteps === 3 ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
            {visibleSteps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === activeStep;
              const isComplete = !step.required && index < firstIncompleteStep;

              return (
                <div
                  key={step.key}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-cyan-400/60 bg-cyan-400/10"
                      : "border-white/10 bg-black/10 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-white/10 p-2">
                        <Icon className="h-4 w-4 text-cyan-200" />
                      </div>
                      <div>
                        <p className="text-xs text-white/45">{t("setup.stepLabel", { index: index + 1 })}</p>
                        <p className="font-medium text-white">{step.title}</p>
                      </div>
                    </div>
                    {isComplete ? <Check className="h-4 w-4 text-emerald-300" /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {currentStep?.key === "legal" ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-cyan-300" />
              {t("setup.legal.cardTitle")}
            </CardTitle>
            <CardDescription className="text-white/60">
              {t("setup.legal.cardDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2.5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/75">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">•</span>
                <span>{t("setup.legal.term1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">•</span>
                <span>{t("setup.legal.term2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">•</span>
                <span>{t("setup.legal.term3")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-cyan-400">•</span>
                <span>{t("setup.legal.term4")}</span>
              </li>
            </ul>
            <div className="flex items-start gap-3">
              <Checkbox
                id="legal-accept-checkbox"
                checked={legalCheckboxChecked}
                onCheckedChange={(checked) => setLegalCheckboxChecked(Boolean(checked))}
                className="mt-0.5"
              />
              <Label htmlFor="legal-accept-checkbox" className="cursor-pointer text-sm leading-snug text-white/80">
                {t("setup.legal.checkbox")}
              </Label>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleLegalAccept}
                disabled={!legalCheckboxChecked}
                className="bg-cyan-600 text-white hover:bg-cyan-700"
              >
                {t("setup.legal.accept")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {currentStep?.key === "password" ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>
              {user?.username === "admin"
                ? t("setup.password.cardTitle")
                : t("setup.password.cardTitleUser")}
            </CardTitle>
            <CardDescription className="text-white/60">
              {user?.username === "admin"
                ? t("setup.password.cardDescription")
                : t("setup.password.cardDescriptionUser")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {user?.username !== "admin" ? (
                  <div className="space-y-2">
                    <Label htmlFor="setup-current-password">{t("setup.password.currentPassword")}</Label>
                    <Input
                      id="setup-current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      className="border-white/10 bg-slate-900 text-white"
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="setup-new-password">{t("setup.password.newPassword")}</Label>
                  <Input
                    id="setup-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="border-white/10 bg-slate-900 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2 md:max-w-md">
                <Label htmlFor="setup-confirm-password">{t("setup.password.confirm")}</Label>
                <Input
                  id="setup-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="border-white/10 bg-slate-900 text-white"
                />
              </div>
              {passwordError ? <p className="text-sm text-red-300">{passwordError}</p> : null}
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-white/55">{t("setup.password.minimum")}</div>
                <Button type="submit" disabled={isPasswordSaving} className="bg-cyan-600 text-white hover:bg-cyan-700">
                  {isPasswordSaving ? t("common.saving") : t("setup.password.saveAndContinue")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {currentStep?.key === "tmdb" ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>{t("setup.tmdb.cardTitle")}</CardTitle>
            <CardDescription className="text-white/60">
              {t("setup.tmdb.cardDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTmdbSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="setup-tmdb-key">{t("setup.tmdb.keyLabel")}</Label>
                  <a
                    href="https://developer.themoviedb.org/docs/getting-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-cyan-300 transition-colors hover:text-cyan-200"
                  >
                    {t("setup.tmdb.documentation")}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <Input
                  id="setup-tmdb-key"
                  type="password"
                  value={tmdbApiKey}
                  onChange={(event) => setTmdbApiKey(event.target.value)}
                  placeholder={t("setup.tmdb.placeholder")}
                  className="border-white/10 bg-slate-900 text-white"
                />
                <p className="text-xs text-white/55">
                  {t("setup.tmdb.helper")}
                </p>
              </div>
              {tmdbMessage ? <p className="text-sm text-emerald-300">{tmdbMessage}</p> : null}
              {tmdbError ? <p className="text-sm text-red-300">{tmdbError}</p> : null}
              <div className="flex items-center justify-end gap-3">
                <Button type="submit" disabled={isTmdbSaving} className="bg-cyan-600 text-white hover:bg-cyan-700">
                  {isTmdbSaving ? t("setup.tmdb.testing") : t("setup.tmdb.saveAndContinue")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {currentStep?.key === "torrent" ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>{t("setup.torrent.cardTitle")}</CardTitle>
            <CardDescription className="text-white/60">
              {t("setup.torrent.cardDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTorrentSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="setup-torrent-url">{t("setup.torrent.url")}</Label>
                  <Input
                    id="setup-torrent-url"
                    value={torrentUrl}
                    onChange={(event) => setTorrentUrl(event.target.value)}
                    placeholder={t("setup.torrent.urlPlaceholder")}
                    className="border-white/10 bg-slate-900 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-torrent-port">{t("setup.torrent.port")}</Label>
                  <Input
                    id="setup-torrent-port"
                    value={torrentPort}
                    onChange={(event) => setTorrentPort(event.target.value)}
                    placeholder={t("setup.torrent.portPlaceholder")}
                    className="border-white/10 bg-slate-900 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{t("setup.torrent.authRequired")}</p>
                  <p className="text-sm text-white/55">{t("setup.torrent.authDescription")}</p>
                </div>
                <Switch checked={torrentAuthRequired} onCheckedChange={setTorrentAuthRequired} />
              </div>

              {torrentAuthRequired ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="setup-torrent-username">{t("setup.torrent.username")}</Label>
                    <Input
                      id="setup-torrent-username"
                      value={torrentUsername}
                      onChange={(event) => setTorrentUsername(event.target.value)}
                      className="border-white/10 bg-slate-900 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-torrent-password">{t("setup.torrent.password")}</Label>
                    <Input
                      id="setup-torrent-password"
                      type="password"
                      value={torrentPassword}
                      onChange={(event) => setTorrentPassword(event.target.value)}
                      className="border-white/10 bg-slate-900 text-white"
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="setup-movies-folder">{t("setup.torrent.moviesFolder")}</Label>
                  <Input
                    id="setup-movies-folder"
                    value={torrentMoviesFolder}
                    onChange={(event) => setTorrentMoviesFolder(event.target.value)}
                    placeholder={t("setup.torrent.moviesFolderPlaceholder")}
                    className="border-white/10 bg-slate-900 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-series-folder">{t("setup.torrent.seriesFolder")}</Label>
                  <Input
                    id="setup-series-folder"
                    value={torrentSeriesFolder}
                    onChange={(event) => setTorrentSeriesFolder(event.target.value)}
                    placeholder={t("setup.torrent.seriesFolderPlaceholder")}
                    className="border-white/10 bg-slate-900 text-white"
                  />
                </div>
              </div>

              {torrentError ? <p className="text-sm text-red-300">{torrentError}</p> : null}

              <div className="flex items-center justify-end gap-3">
                <Button type="submit" disabled={isTorrentSaving} className="bg-cyan-600 text-white hover:bg-cyan-700">
                  {isTorrentSaving ? t("setup.torrent.testing") : t("setup.torrent.testAndContinue")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {currentStep?.key === "indexer" ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>{t("setup.indexer.cardTitle")}</CardTitle>
            <CardDescription className="text-white/60">
              {t("setup.indexer.cardDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleIndexerSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="setup-indexer-url">{t("setup.indexer.url")}</Label>
                  <Input
                    id="setup-indexer-url"
                    value={indexerUrl}
                    onChange={(event) => setIndexerUrl(event.target.value)}
                    placeholder={t("setup.indexer.urlPlaceholder")}
                    className="border-white/10 bg-slate-900 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-indexer-token">{t("setup.indexer.token")}</Label>
                  <Input
                    id="setup-indexer-token"
                    type="password"
                    value={indexerToken}
                    onChange={(event) => setIndexerToken(event.target.value)}
                    className="border-white/10 bg-slate-900 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2 md:max-w-xs">
                <Label htmlFor="setup-indexer-quality">{t("setup.indexer.defaultQuality")}</Label>
                <select
                  id="setup-indexer-quality"
                  value={indexerDefaultQuality}
                  onChange={(event) => setIndexerDefaultQuality(event.target.value)}
                  className="h-10 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-white outline-none"
                >
                  <option value="all">{t("setup.indexer.allQualities")}</option>
                  <option value="2160p">{t("setup.indexer.quality.2160p")}</option>
                  <option value="1080p">{t("setup.indexer.quality.1080p")}</option>
                  <option value="720p">{t("setup.indexer.quality.720p")}</option>
                  <option value="480p">{t("setup.indexer.quality.480p")}</option>
                  <option value="bluray">{t("setup.indexer.quality.bluray")}</option>
                  <option value="webdl">{t("setup.indexer.quality.webdl")}</option>
                  <option value="hdtv">{t("setup.indexer.quality.hdtv")}</option>
                </select>
              </div>

              <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200/90">
                {t("setup.indexer.legalNote")}
              </p>

              {indexerError ? <p className="text-sm text-red-300">{indexerError}</p> : null}

              <div className="flex items-center justify-end gap-3">
                <Button
                  type="submit"
                  disabled={isIndexerSaving}
                  className="bg-cyan-600 text-white hover:bg-cyan-700"
                >
                  {isIndexerSaving ? t("setup.indexer.testing") : t("setup.indexer.testAndFinish")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}