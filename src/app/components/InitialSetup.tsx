import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Check, ExternalLink, KeyRound, RadioTower, Server, ShieldCheck } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import {
  changePassword,
  getSettings,
  testIndexerConnection,
  testTmdbApiKey,
  testTorrentConnection,
  updateSettings,
  type UserSettings,
} from "../services/authService";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";
import { Switch } from "./ui/switch";

const TOTAL_STEPS = 4;

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
      preferences: {},
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

  const [activeStep, setActiveStep] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

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

  const stepStatuses = useMemo(
    () => [
      { key: "password", title: "Sécurité", icon: ShieldCheck, required: mustChangePassword },
      { key: "tmdb", title: "Clé TMDB", icon: KeyRound, required: mustConfigureTmdb },
      { key: "torrent", title: "Client torrent", icon: Server, required: mustConfigureTorrent },
      { key: "indexer", title: "Tracker", icon: RadioTower, required: mustConfigureIndexer },
    ],
    [mustChangePassword, mustConfigureIndexer, mustConfigureTmdb, mustConfigureTorrent]
  );

  const firstIncompleteStep = useMemo(() => {
    const index = stepStatuses.findIndex((step) => step.required);
    return index === -1 ? TOTAL_STEPS : index;
  }, [stepStatuses]);

  useEffect(() => {
    const sourceSettings = settings || buildFallbackSettings(user?.username || "admin");
    const torrentSettings = sourceSettings.placeholders?.torrent || {};
    const indexerSettings = sourceSettings.placeholders?.indexer || {};

    setTmdbApiKey(sourceSettings.apiKeys?.tmdb || "");
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
  }, [settings, user?.username]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const loadSettings = async () => {
      try {
        const response = await getSettings();
        setSettings(response);
      } finally {
        setIsBootstrapping(false);
      }
    };

    void loadSettings();
  }, [isAuthenticated, setSettings]);

  useEffect(() => {
    if (!isLoading && !hasPendingSetup) {
      navigate("/", { replace: true });
      return;
    }

    if (!isLoading && firstIncompleteStep < TOTAL_STEPS) {
      setActiveStep(firstIncompleteStep);
    }
  }, [firstIncompleteStep, hasPendingSetup, isLoading, location.state, navigate]);

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isLoading && !hasPendingSetup) {
    return <Navigate to={(location.state as { from?: string } | null)?.from || "/"} replace />;
  }

  if (isLoading || isBootstrapping) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white/70">
        Préparation de la configuration initiale...
      </div>
    );
  }

  const currentStep = stepStatuses[activeStep];
  const currentStepNumber = activeStep + 1;
  const progressValue = (currentStepNumber / TOTAL_STEPS) * 100;
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
    if (activeStep >= TOTAL_STEPS - 1) {
      navigate("/", { replace: true });
      return;
    }

    setActiveStep((current) => Math.min(current + 1, TOTAL_STEPS - 1));
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);

    if (!newPassword) {
      setPasswordError("Le nouveau mot de passe est requis.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setIsPasswordSaving(true);
    try {
      await changePassword("admin", newPassword);
      await refresh();
      setNewPassword("");
      setConfirmPassword("");
      goToNextVisibleStep();
    } catch (submitError) {
      setPasswordError(
        submitError instanceof Error ? submitError.message : "Mise à jour impossible"
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
      setTmdbError("La clé API TMDB est requise.");
      return;
    }

    setIsTmdbSaving(true);
    try {
      const testResponse = await testTmdbApiKey(tmdbApiKey.trim());
      const updatedSettings = buildUpdatedSettings({
        apiKeys: {
          tmdb: tmdbApiKey.trim(),
        },
      });
      await updateSettings(updatedSettings);
      setSettings(updatedSettings);
      setTmdbMessage(testResponse.message);
      await refresh();

      if (mustConfigureTorrent) {
        setActiveStep(2);
        return;
      }

      if (mustConfigureIndexer) {
        setActiveStep(3);
        return;
      }

      goToNextVisibleStep();
    } catch (submitError) {
      setTmdbError(
        submitError instanceof Error ? submitError.message : "Configuration impossible"
      );
    } finally {
      setIsTmdbSaving(false);
    }
  };

  const handleTorrentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTorrentError(null);

    if (!torrentUrl.trim() || !torrentPort.trim()) {
      setTorrentError("L'URL et le port du client torrent sont requis.");
      return;
    }

    if (torrentAuthRequired && (!torrentUsername.trim() || !torrentPassword.trim())) {
      setTorrentError("Les identifiants Transmission sont requis quand l'authentification est activée.");
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
        submitError instanceof Error ? submitError.message : "Configuration du client torrent impossible"
      );
    } finally {
      setIsTorrentSaving(false);
    }
  };

  const handleIndexerSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIndexerError(null);

    if (!indexerUrl.trim() || !indexerToken.trim()) {
      setIndexerError("L'URL et le jeton API du tracker sont requis.");
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
        submitError instanceof Error ? submitError.message : "Configuration du tracker impossible"
      );
    } finally {
      setIsIndexerSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <div className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
          Première configuration
        </div>
        <div>
          <h2 className="text-4xl font-black tracking-tight text-white">Assistant de démarrage</h2>
        </div>
      </div>

      <Card className="border-white/10 bg-white/5 text-white">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="mt-1 text-2xl font-semibold text-white">{currentStep.title}</h3>
            </div>
            <div className="text-sm text-white/60">
              <p className="text-sm uppercase tracking-[0.22em] text-white/45">
                Étape {currentStepNumber} sur {TOTAL_STEPS}
              </p>
            </div>
          </div>

          <Progress value={progressValue} className="bg-white/10" />

          <div className="grid gap-3 md:grid-cols-4">
            {stepStatuses.map((step, index) => {
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
                        <p className="text-xs text-white/45">Étape {index + 1}</p>
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

      {activeStep === 0 ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Changez le mot de passe par défaut</CardTitle>
            <CardDescription className="text-white/60">
              Cette étape sécurise immédiatement le compte administrateur
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="setup-new-password">Nouveau mot de passe</Label>
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
                <Label htmlFor="setup-confirm-password">Confirmation</Label>
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
                <div className="text-sm text-white/55">Minimum 6 caractères.</div>
                <Button type="submit" disabled={isPasswordSaving} className="bg-cyan-600 text-white hover:bg-cyan-700">
                  {isPasswordSaving ? "Enregistrement..." : "Enregistrer et continuer"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {activeStep === 1 ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Renseignez votre clé API TMDB</CardTitle>
            <CardDescription className="text-white/60">
              SeedFlix utilise TMDB pour récupérer les fiches films et séries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTmdbSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="setup-tmdb-key">Clé API TMDB</Label>
                  <a
                    href="https://developer.themoviedb.org/docs/getting-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-cyan-300 transition-colors hover:text-cyan-200"
                  >
                    Documentation TMDB
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <Input
                  id="setup-tmdb-key"
                  type="password"
                  value={tmdbApiKey}
                  onChange={(event) => setTmdbApiKey(event.target.value)}
                  placeholder="Clé API v3 ou Read Access Token v4"
                  className="border-white/10 bg-slate-900 text-white"
                />
                <p className="text-xs text-white/55">
                  SeedFlix accepte la clé API TMDB classique et le jeton de lecture v4.
                </p>
              </div>
              {tmdbMessage ? <p className="text-sm text-emerald-300">{tmdbMessage}</p> : null}
              {tmdbError ? <p className="text-sm text-red-300">{tmdbError}</p> : null}
              <div className="flex items-center justify-end gap-3">
                <Button type="submit" disabled={isTmdbSaving} className="bg-cyan-600 text-white hover:bg-cyan-700">
                  {isTmdbSaving ? "Test en cours..." : "Tester, enregistrer et continuer"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {activeStep === 2 ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Configurez le client torrent</CardTitle>
            <CardDescription className="text-white/60">
              Ces informations servent à tester la connexion puis à envoyer les téléchargements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTorrentSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="setup-torrent-url">URL</Label>
                  <Input
                    id="setup-torrent-url"
                    value={torrentUrl}
                    onChange={(event) => setTorrentUrl(event.target.value)}
                    placeholder="https://seedbox.example.com"
                    className="border-white/10 bg-slate-900 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-torrent-port">Port RPC</Label>
                  <Input
                    id="setup-torrent-port"
                    value={torrentPort}
                    onChange={(event) => setTorrentPort(event.target.value)}
                    placeholder="9091"
                    className="border-white/10 bg-slate-900 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                <div>
                  <p className="font-medium text-white">Authentification requise</p>
                  <p className="text-sm text-white/55">Activez si votre client Transmission demande un identifiant.</p>
                </div>
                <Switch checked={torrentAuthRequired} onCheckedChange={setTorrentAuthRequired} />
              </div>

              {torrentAuthRequired ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="setup-torrent-username">Nom d'utilisateur</Label>
                    <Input
                      id="setup-torrent-username"
                      value={torrentUsername}
                      onChange={(event) => setTorrentUsername(event.target.value)}
                      className="border-white/10 bg-slate-900 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-torrent-password">Mot de passe</Label>
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
                  <Label htmlFor="setup-movies-folder">Dossier films</Label>
                  <Input
                    id="setup-movies-folder"
                    value={torrentMoviesFolder}
                    onChange={(event) => setTorrentMoviesFolder(event.target.value)}
                    placeholder="/downloads/movies"
                    className="border-white/10 bg-slate-900 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-series-folder">Dossier séries</Label>
                  <Input
                    id="setup-series-folder"
                    value={torrentSeriesFolder}
                    onChange={(event) => setTorrentSeriesFolder(event.target.value)}
                    placeholder="/downloads/series"
                    className="border-white/10 bg-slate-900 text-white"
                  />
                </div>
              </div>

              {torrentError ? <p className="text-sm text-red-300">{torrentError}</p> : null}

              <div className="flex items-center justify-end gap-3">
                <Button type="submit" disabled={isTorrentSaving} className="bg-cyan-600 text-white hover:bg-cyan-700">
                  {isTorrentSaving ? "Test en cours..." : "Tester et continuer"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {activeStep === 3 ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Configurez le tracker</CardTitle>
            <CardDescription className="text-white/60">
              Fournissez l'URL Torznab et le jeton API pour activer la recherche de releases.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleIndexerSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="setup-indexer-url">URL Torznab</Label>
                  <Input
                    id="setup-indexer-url"
                    value={indexerUrl}
                    onChange={(event) => setIndexerUrl(event.target.value)}
                    placeholder="https://indexer.example.com/api"
                    className="border-white/10 bg-slate-900 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-indexer-token">Jeton API</Label>
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
                <Label htmlFor="setup-indexer-quality">Qualité par défaut</Label>
                <select
                  id="setup-indexer-quality"
                  value={indexerDefaultQuality}
                  onChange={(event) => setIndexerDefaultQuality(event.target.value)}
                  className="h-10 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-white outline-none"
                >
                  <option value="all">Toutes qualités</option>
                  <option value="2160p">2160p (4K)</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                  <option value="bluray">BluRay</option>
                  <option value="webdl">WEB-DL / WEBRip</option>
                  <option value="hdtv">HDTV</option>
                </select>
              </div>

              {indexerError ? <p className="text-sm text-red-300">{indexerError}</p> : null}

              <div className="flex items-center justify-end gap-3">
                <Button
                  type="submit"
                  disabled={isIndexerSaving}
                  className="bg-cyan-600 text-white hover:bg-cyan-700"
                >
                  {isIndexerSaving ? "Test et enregistrement..." : "Tester et terminer la configuration"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}