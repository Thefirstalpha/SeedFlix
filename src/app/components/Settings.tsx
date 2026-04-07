import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { changePassword, getSettings, type UserSettings } from "../services/authService";
import { useAuth } from "../context/AuthContext";

export function Settings() {
  const location = useLocation();
  const { isAuthenticated, isLoading, user, setSettings } = useAuth();
  const [settings, setLocalSettings] = useState<UserSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const loadSettings = async () => {
      try {
        const response = await getSettings();
        setLocalSettings(response);
        setSettings(response);
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
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Mot de passe mis à jour.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Mise à jour impossible");
    } finally {
      setIsSaving(false);
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

      <Tabs defaultValue="security" className="space-y-6">
        <TabsList className="bg-white/10 border border-white/10">
          <TabsTrigger value="security" className="text-white data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
            Sécurité
          </TabsTrigger>
          <TabsTrigger value="account" className="text-white data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
            Compte
          </TabsTrigger>
          <TabsTrigger value="future" className="text-white data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
            Plus tard
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
              <CardTitle>Section réservée</CardTitle>
              <CardDescription className="text-white/60">
                Espace vide pour de futurs paramètres.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6 text-white/50">
                Cette section sera complétée plus tard.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
