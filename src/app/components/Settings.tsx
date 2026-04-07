import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { changePassword, getSettings, updateSettings, type UserSettings } from "../services/authService";
import { useAuth } from "../context/AuthContext";

export function Settings() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, setSettings, mustChangePassword, refresh } = useAuth();
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
  const [indexerMessage, setIndexerMessage] = useState<string | null>(null);
  const [indexerError, setIndexerError] = useState<string | null>(null);
  const [isIndexerSaving, setIsIndexerSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const loadSettings = async () => {
      try {
        const response = await getSettings();
        setLocalSettings(response);
        setSettings(response);
        
        // Load torrent settings
        const torrentSettings = response.placeholders?.torrent || {};
        setTorrentUrl(torrentSettings.url || "");
        setTorrentPort(torrentSettings.port || "");
        setTorrentAuthRequired(torrentSettings.authRequired || false);
        setTorrentUsername(torrentSettings.username || "");
        setTorrentPassword("");
        setTorrentMoviesFolder(torrentSettings.moviesFolder || "");
        setTorrentSeriesFolder(torrentSettings.seriesFolder || "");
        
        // Load indexer settings
        const indexerSettings = response.placeholders?.indexer || {};
        setIndexerUrl(indexerSettings.url || "");
        setIndexerToken("");
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
    const wasForcedChange = mustChangePassword;
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

      if (wasForcedChange) {
        const nextPath = (location.state as { from?: string } | null)?.from || "/";
        navigate(nextPath, { replace: true });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Mise à jour impossible");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTorrentSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setTorrentError(null);
    setTorrentMessage(null);
    setIsTorrentSaving(true);
    try {
      const updatedSettings: UserSettings = {
        profile: settings?.profile || { username: user?.username || "admin" },
        security: settings?.security || {
          lastPasswordChangeAt: new Date().toISOString(),
        },
        placeholders: {
          notifications: settings?.placeholders?.notifications || {},
          preferences: settings?.placeholders?.preferences || {},
          torrent: {
            url: torrentUrl,
            port: torrentPort,
            authRequired: torrentAuthRequired,
            username: torrentAuthRequired ? torrentUsername : undefined,
            moviesFolder: torrentMoviesFolder,
            seriesFolder: torrentSeriesFolder,
          },
        },
      };
      await updateSettings(updatedSettings);
      setLocalSettings(updatedSettings);
      setSettings(updatedSettings);
      setTorrentMessage("Configuration torrent enregistrée.");
    } catch (submitError) {
      setTorrentError(
        submitError instanceof Error ? submitError.message : "Mise à jour impossible"
      );
    } finally {
      setIsTorrentSaving(false);
    }
  };

  const handleIndexerSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIndexerError(null);
    setIndexerMessage(null);
    setIsIndexerSaving(true);
    try {
      const updatedSettings: UserSettings = {
        profile: settings?.profile || { username: user?.username || "admin" },
        security: settings?.security || {
          lastPasswordChangeAt: new Date().toISOString(),
        },
        placeholders: {
          notifications: settings?.placeholders?.notifications || {},
          preferences: settings?.placeholders?.preferences || {},
          torrent: settings?.placeholders?.torrent,
          indexer: {
            url: indexerUrl,
            token: indexerToken,
          },
        },
      };
      await updateSettings(updatedSettings);
      setLocalSettings(updatedSettings);
      setSettings(updatedSettings);
      setIndexerMessage("Configuration indexer enregistrée.");
    } catch (submitError) {
      setIndexerError(
        submitError instanceof Error ? submitError.message : "Mise à jour impossible"
      );
    } finally {
      setIsIndexerSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">Paramètres</h2>
        <p className="text-white/60 mt-1">
          Gérez votre compte et préparez les futures préférences de l'application.
        </p>
      </div>

      {mustChangePassword && (
        <div className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Vous utilisez encore les identifiants par défaut. Changez le mot de passe avant d'accéder au reste du site.
        </div>
      )}

      <Tabs defaultValue="security" className="space-y-6">
        <TabsList className="bg-white/10 border border-white/10">
          <TabsTrigger value="security" className="text-white data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
            Sécurité
          </TabsTrigger>
          <TabsTrigger value="account" disabled={mustChangePassword} className="text-white data-[state=active]:bg-cyan-600 data-[state=active]:text-white disabled:opacity-50 disabled:cursor-not-allowed">
            Compte
          </TabsTrigger>
          <TabsTrigger value="future" disabled={mustChangePassword} className="text-white data-[state=active]:bg-cyan-600 data-[state=active]:text-white disabled:opacity-50 disabled:cursor-not-allowed">
            Téléchargements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="security">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Modifier le mot de passe</CardTitle>
              <CardDescription className="text-white/60">
                Dernière modification: {settings?.security?.lastPasswordChangeAt ? new Date(settings.security.lastPasswordChangeAt).toLocaleString("fr-FR") : "inconnue"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-lg">
                {mustChangePassword && (
                  <p className="text-sm text-white/70">
                    Le compte `admin` doit définir un mot de passe personnalisé avant de continuer.
                  </p>
                )}
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
                <Button type="submit" disabled={isSaving} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                  {isSaving ? "Enregistrement..." : "Mettre à jour"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Compte actuel</CardTitle>
              <CardDescription className="text-white/60">
                Informations stockées côté backend.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-white/80">
              <p>Nom d'utilisateur: {user?.username || settings?.profile?.username || "-"}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="future">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Client torrent</CardTitle>
              <CardDescription className="text-white/60">
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

                <Button type="submit" disabled={isTorrentSaving} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                  {isTorrentSaving ? "Enregistrement..." : "Enregistrer la configuration"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white mt-6">
            <CardHeader>
              <CardTitle>Indexer</CardTitle>
              <CardDescription className="text-white/60">
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

                {indexerMessage && <p className="text-sm text-emerald-300">{indexerMessage}</p>}
                {indexerError && <p className="text-sm text-red-300">{indexerError}</p>}

                <Button type="submit" disabled={isIndexerSaving} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                  {isIndexerSaving ? "Enregistrement..." : "Enregistrer la configuration"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
