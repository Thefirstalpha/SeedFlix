import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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
} from "./ui/alert-dialog";
import {
  changePassword,
  getSettings,
  resetSettings,
  testIndexerConnection,
  testTorrentConnection,
  updateSettings,
  type UserSettings,
} from "../services/authService";
import { useAuth } from "../context/AuthContext";

const QUALITY_OPTIONS = [
  { value: "all", label: "Toutes qualités" },
  { value: "2160p", label: "2160p (4K)" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
  { value: "bluray", label: "BluRay" },
  { value: "webdl", label: "WEB-DL / WEBRip" },
  { value: "hdtv", label: "HDTV" },
];

export function Settings() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, setSettings, refresh } = useAuth();
  const [settings, setLocalSettings] = useState<UserSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torrentUrl, setTorrentUrl] = useState("");
  const [torrentPort, setTorrentPort] = useState("");
  const [torrentAuthRequired, setTorrentAuthRequired] = useState(false);
  const [torrentUsername, setTorrentUsername] = useState("");
  const [torrentPassword, setTorrentPassword] = useState("");
  const [torrentMoviesFolder, setTorrentMoviesFolder] = useState("");
  const [torrentSeriesFolder, setTorrentSeriesFolder] = useState("");
  const [torrentMessage, setTorrentMessage] = useState<string | null>(null);
  const [torrentError, setTorrentError] = useState<string | null>(null);
  const [isTorrentSaving, setIsTorrentSaving] = useState(false);
  const [indexerUrl, setIndexerUrl] = useState("");
  const [indexerToken, setIndexerToken] = useState("");
  const [indexerDefaultQuality, setIndexerDefaultQuality] = useState("all");
  const [indexerMessage, setIndexerMessage] = useState<string | null>(null);
  const [indexerError, setIndexerError] = useState<string | null>(null);
  const [isIndexerSaving, setIsIndexerSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [tmdbApiKey, setTmdbApiKey] = useState("");
  const [tmdbMessage, setTmdbMessage] = useState<string | null>(null);
  const [tmdbError, setTmdbError] = useState<string | null>(null);
  const [isTmdbSaving, setIsTmdbSaving] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [discordTested, setDiscordTested] = useState(false);
  const [discordFormOpen, setDiscordFormOpen] = useState(false);
  const [discordMessage, setDiscordMessage] = useState<string | null>(null);
  const [discordError, setDiscordError] = useState<string | null>(null);
  const [isDiscordSaving, setIsDiscordSaving] = useState(false);

  const applySettingsToForms = (incomingSettings: UserSettings) => {
    const torrentSettings = incomingSettings.placeholders?.torrent || {};
    setTorrentUrl(torrentSettings.url || "");
    setTorrentPort(torrentSettings.port || "");
    setTorrentAuthRequired(torrentSettings.authRequired || false);
    setTorrentUsername(torrentSettings.username || "");
    setTorrentPassword(torrentSettings.password || "");
    setTorrentMoviesFolder(torrentSettings.moviesFolder || "");
    setTorrentSeriesFolder(torrentSettings.seriesFolder || "");

    setIndexerUrl(incomingSettings.placeholders?.indexer?.url || "");
    setIndexerToken(incomingSettings.placeholders?.indexer?.token || "");
    setIndexerDefaultQuality(
      incomingSettings.placeholders?.indexer?.defaultQuality || "all"
    );

    setTmdbApiKey(incomingSettings.apiKeys?.tmdb || "");

    const notifSettings = incomingSettings.placeholders?.notifications || {};
    setDiscordWebhookUrl((notifSettings as any).discord?.webhookUrl || "");
    setDiscordTested(
      (notifSettings as any).enabledChannels?.includes("discord") && 
      Boolean((notifSettings as any).discord?.webhookUrl)
    );
  };

  const buildUpdatedSettings = (overrides: Partial<UserSettings["placeholders"]>): UserSettings => ({
    profile: settings?.profile || { username: user?.username || "admin" },
    security: settings?.security || {
      lastPasswordChangeAt: new Date().toISOString(),
    },
    apiKeys: settings?.apiKeys || { tmdb: "" },
    placeholders: {
      notifications: settings?.placeholders?.notifications || {},
      preferences: settings?.placeholders?.preferences || {},
      torrent: settings?.placeholders?.torrent,
      indexer: settings?.placeholders?.indexer,
      ...overrides,
    },
  });

  const buildTmdbSettings = (): UserSettings => ({
    profile: settings?.profile || { username: user?.username || "admin" },
    security: settings?.security || {
      lastPasswordChangeAt: new Date().toISOString(),
    },
    apiKeys: {
      tmdb: tmdbApiKey.trim(),
    },
    placeholders: settings?.placeholders || {
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
  });

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
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Impossible de charger les paramètres"
        );
      }
    };

    void loadSettings();
  }, [isAuthenticated, setSettings]);

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
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Mot de passe mis à jour.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Mise à jour impossible");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTmdbSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setTmdbError(null);
    setTmdbMessage(null);
    setIsTmdbSaving(true);

    if (!tmdbApiKey.trim()) {
      setTmdbError("La clé API TMDB est requise");
      setIsTmdbSaving(false);
      return;
    }

    try {
      const updatedSettings = buildTmdbSettings();
      await updateSettings(updatedSettings);
      setLocalSettings(updatedSettings);
      setSettings(updatedSettings);
      await refresh();
      setTmdbMessage("Clé API TMDB configurée avec succès.");
    } catch (submitError) {
      setTmdbError(submitError instanceof Error ? submitError.message : "Configuration impossible");
    } finally {
      setIsTmdbSaving(false);
    }
  };

  const handleTorrentSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setResetError(null);
    setTorrentError(null);
    setTorrentMessage(null);
    setIsTorrentSaving(true);

    const updatedSettings: UserSettings = buildUpdatedSettings({
      torrent: {
        url: torrentUrl,
        port: torrentPort,
        authRequired: torrentAuthRequired,
        username: torrentAuthRequired ? torrentUsername : undefined,
        password: torrentAuthRequired ? torrentPassword : "",
        moviesFolder: torrentMoviesFolder,
        seriesFolder: torrentSeriesFolder,
      },
    });

    try {
      await updateSettings(updatedSettings);
      setLocalSettings(updatedSettings);
      setSettings(updatedSettings);
    } catch (submitError) {
      setTorrentError(
        submitError instanceof Error ? submitError.message : "Mise à jour impossible"
      );
      setIsTorrentSaving(false);
      return;
    }

    try {
      const response = await testTorrentConnection({
        url: torrentUrl,
        port: torrentPort,
        authRequired: torrentAuthRequired,
        username: torrentUsername,
        password: torrentPassword,
      });
      setTorrentMessage(`Configuration enregistrée. ${response.message}`);
    } catch (submitError) {
      setTorrentError(
        submitError instanceof Error
          ? `Configuration enregistrée, mais le test a échoué: ${submitError.message}`
          : "Configuration enregistrée, mais le test de connexion a échoué"
      );
    } finally {
      setIsTorrentSaving(false);
    }
  };

  const handleIndexerSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setResetError(null);
    setIndexerError(null);
    setIndexerMessage(null);
    setIsIndexerSaving(true);

    const updatedSettings: UserSettings = buildUpdatedSettings({
      indexer: {
        url: indexerUrl,
        token: indexerToken,
        defaultQuality: indexerDefaultQuality,
      },
    });

    try {
      await updateSettings(updatedSettings);
      setLocalSettings(updatedSettings);
      setSettings(updatedSettings);
    } catch (submitError) {
      setIndexerError(
        submitError instanceof Error ? submitError.message : "Mise à jour impossible"
      );
      setIsIndexerSaving(false);
      return;
    }

    try {
      const response = await testIndexerConnection(indexerUrl, indexerToken);
      setIndexerMessage(`Configuration enregistrée. ${response.message}`);
    } catch (submitError) {
      setIndexerError(
        submitError instanceof Error
          ? `Configuration enregistrée, mais le test a échoué: ${submitError.message}`
          : "Configuration enregistrée, mais le test de connexion a échoué"
      );
    } finally {
      setIsIndexerSaving(false);
    }
  };

  const handleDiscordSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setDiscordError(null);
    setDiscordMessage(null);
    setIsDiscordSaving(true);

    try {
      // Validation
      if (!discordWebhookUrl.trim()) {
        setDiscordError("L'URL du webhook Discord est requise");
        setIsDiscordSaving(false);
        return;
      }

      // Test webhook
      const testResponse = await fetch(discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: "Test de Configuration SeedFlix",
              description: "Votre webhook Discord fonctionne correctement!",
              color: 0x10b981,
              timestamp: new Date().toISOString(),
              footer: { text: "SeedFlix Notifications" },
            },
          ],
        }),
      });

      if (!testResponse.ok) {
        setDiscordError(
          `Test échoué (${testResponse.status}). Vérifiez que l'URL est correcte et active.`
        );
        setIsDiscordSaving(false);
        return;
      }

      // Save configuration
      const enabledChannels = ["discord"];
      const updatedSettings: UserSettings = {
        profile: settings?.profile || { username: user?.username || "admin" },
        security: settings?.security || { lastPasswordChangeAt: new Date().toISOString() },
        apiKeys: settings?.apiKeys || { tmdb: "" },
        placeholders: {
          notifications: {
            enabledChannels,
            discord: {
              webhookUrl: discordWebhookUrl,
            },
          },
          preferences: settings?.placeholders?.preferences || {},
          torrent: settings?.placeholders?.torrent || {},
          indexer: settings?.placeholders?.indexer || {},
        },
      };

      await updateSettings(updatedSettings);
      setLocalSettings(updatedSettings);
      setSettings(updatedSettings);
      await refresh();
      setDiscordTested(true);
      setDiscordMessage("Webhook Discord configuré et testé avec succès!");
      // Fermer le formulaire
      setDiscordFormOpen(false);
    } catch (submitError) {
      setDiscordError(
        submitError instanceof Error
          ? submitError.message
          : "Configuration impossible"
      );
    } finally {
      setIsDiscordSaving(false);
    }
  };

  const handleResetSettings = async () => {
    setResetError(null);
    setTorrentMessage(null);
    setTorrentError(null);
    setIndexerMessage(null);
    setIndexerError(null);
    setIsResetting(true);

    try {
      await resetSettings();
      await refresh();
      navigate("/login", { replace: true, state: { reset: true } });
    } catch (submitError) {
      setResetError(
        submitError instanceof Error ? submitError.message : "Réinitialisation impossible"
      );
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">Paramètres</h2>
      </div>
      <Tabs defaultValue="security" className="space-y-6">
        <TabsList className="bg-white/10 border border-white/10">
          <TabsTrigger value="security" className="text-white data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            Sécurité
          </TabsTrigger>
          <TabsTrigger value="api" className="text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Configuration
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            Notifications
          </TabsTrigger>
          <TabsTrigger value="factory" className="text-white data-[state=active]:bg-red-600 data-[state=active]:text-white">
            Réinitialisation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="security">
          <Card className="border-emerald-500/30 bg-emerald-950/15 text-white">
            <CardHeader>
              <CardTitle className="text-emerald-200">Modifier le mot de passe</CardTitle>
              <CardDescription className="text-emerald-100/70">
                Dernière modification: {settings?.security?.lastPasswordChangeAt ? new Date(settings.security.lastPasswordChangeAt).toLocaleString("fr-FR") : "inconnue"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Mot de passe actuel</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
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
                <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isSaving ? "Enregistrement..." : "Mettre à jour"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card className="border-blue-500/30 bg-blue-950/15 text-white">
            <CardHeader>
              <CardTitle className="text-blue-200">Librairie TMDB</CardTitle>
              <CardDescription className="text-blue-100/70">
                SeedFlix accepte le jeton API v3 et le Read Access Token v4. Obtenez-les sur{" "}
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
                  <Label htmlFor="tmdb-api-key">Jeton API</Label>
                  <Input
                    id="tmdb-api-key"
                    type="password"
                    placeholder="Jeton API v3 ou Read Access Token v4"
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
                  {isTmdbSaving ? "Enregistrement..." : "Enregistrer la clé"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-blue-500/30 bg-blue-950/15 text-white mt-6">
            <CardHeader>
              <CardTitle className="text-blue-200">Client torrent</CardTitle>
              <CardDescription className="text-blue-100/70">
                Configurez vos paramètres de client torrent pour télécharger automatiquement films et séries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTorrentSave} className="space-y-4 max-w-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="torrent-url">URL du client</Label>
                    <Input
                      id="torrent-url"
                      placeholder="http://localhost"
                      value={torrentUrl}
                      onChange={(e) => setTorrentUrl(e.target.value)}
                      className="bg-slate-900 border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="torrent-port">Port</Label>
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
                    Authentification requise
                  </Label>
                </div>

                {torrentAuthRequired && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="torrent-username">Nom d'utilisateur</Label>
                      <Input
                        id="torrent-username"
                        placeholder="admin"
                        value={torrentUsername}
                        onChange={(e) => setTorrentUsername(e.target.value)}
                        className="bg-slate-900 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="torrent-password">Mot de passe</Label>
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
                  <Label htmlFor="torrent-movies-folder">Dossier pour les films</Label>
                  <Input
                    id="torrent-movies-folder"
                    placeholder="/downloads/movies"
                    value={torrentMoviesFolder}
                    onChange={(e) => setTorrentMoviesFolder(e.target.value)}
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="torrent-series-folder">Dossier pour les séries</Label>
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

                <Button type="submit" disabled={isTorrentSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isTorrentSaving ? "Enregistrement et test..." : "Enregistrer et tester la connexion"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-blue-500/30 bg-blue-950/15 text-white mt-6">
            <CardHeader>
              <CardTitle className="text-blue-200">Indexer</CardTitle>
              <CardDescription className="text-blue-100/70">
                Configurez votre indexer pour la recherche de contenu.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleIndexerSave} className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="indexer-url">URL de l'indexer</Label>
                  <Input
                    id="indexer-url"
                    placeholder="https://indexer.example.com"
                    value={indexerUrl}
                    onChange={(e) => setIndexerUrl(e.target.value)}
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="indexer-token">Jeton API</Label>
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
                  <Label htmlFor="indexer-default-quality">Qualité par défaut</Label>
                  <select
                    id="indexer-default-quality"
                    value={indexerDefaultQuality}
                    onChange={(e) => setIndexerDefaultQuality(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 text-white rounded-md px-3 py-2"
                  >
                    {QUALITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {indexerMessage && <p className="text-sm text-emerald-300">{indexerMessage}</p>}
                {indexerError && <p className="text-sm text-red-300">{indexerError}</p>}

                <Button type="submit" disabled={isIndexerSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isIndexerSaving ? "Enregistrement et test..." : "Enregistrer et tester la connexion"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="border-purple-500/30 bg-purple-950/15 text-white">
            <CardHeader>
              <CardTitle className="text-purple-200">Canaux de notification</CardTitle>
              <CardDescription className="text-purple-100/70">
                Configurez les services pour recevoir des notifications d'événements importants.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDiscordSave} className="space-y-6 max-w-lg">
                <div
                  className={`space-y-4 p-4 bg-slate-800/50 rounded-md border border-purple-500/20 ${
                    discordFormOpen ? "" : "cursor-pointer"
                  }`}
                  onClick={() => {
                    if (!discordFormOpen) {
                      setDiscordFormOpen(true);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-white">Discord</h4>
                      <p className="text-sm text-purple-200/70">Recevoir les notifications via un webhook Discord</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDiscordFormOpen(true)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                        discordTested
                          ? "bg-emerald-600 text-white hover:bg-blue-600"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {discordTested ? "Activé" : "Configurer"}
                    </button>
                  </div>

                  {discordFormOpen && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="discord-webhook">URL du Webhook Discord</Label>
                        <Input
                          id="discord-webhook"
                          type="password"
                          placeholder="https://discord.com/api/webhooks/..."
                          value={discordWebhookUrl}
                          onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                          className="bg-slate-900 border-white/10 text-white"
                        />
                        <p className="text-xs text-slate-400">
                          Créez un webhook en allant sur les paramètres du serveur Discord → Webhooks
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
                        {isDiscordSaving ? "Test en cours..." : "Tester & Sauvegarder"}
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
                          Annuler
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="factory">
          <Card className="border-red-500/30 bg-red-950/15 text-white">
            <CardHeader>
              <CardTitle className="text-red-200">Réinitialisation d'usine</CardTitle>
              <CardDescription className="text-red-100/70">
                Cette action réinitialise l'application: compte admin par défaut, paramètres, wishlist films/séries, puis déconnexion automatique.
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
                    {isResetting ? "Réinitialisation..." : "Réinitialiser les paramètres"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-red-500/30 bg-slate-950 text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-200">
                      Confirmer la réinitialisation d'usine
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-white/70">
                      Toutes les données locales seront remises à zéro (utilisateur, paramètres, wishlist films/séries) puis votre session sera expirée. Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">
                      Annuler
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetSettings}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      Oui, réinitialiser
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
