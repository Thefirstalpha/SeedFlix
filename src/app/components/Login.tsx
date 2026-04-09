import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { LockKeyhole, User } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isAuthenticated,
    isLoading,
    login,
    needsInitialSetup,
    mustChangePassword,
    mustConfigureTmdb,
    mustConfigureTorrent,
    mustConfigureIndexer,
  } = useAuth();
  const hasPendingSetup =
    needsInitialSetup ||
    mustChangePassword ||
    mustConfigureTmdb ||
    mustConfigureTorrent ||
    mustConfigureIndexer;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    if (hasPendingSetup) {
      return <Navigate to="/setup" replace state={{ from: (location.state as { from?: string } | null)?.from || "/", forced: true }} />;
    }
    const nextPath = (location.state as { from?: string } | null)?.from || "/";
    return <Navigate to={nextPath} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await login(username, password);
      const mustOpenSetup =
        response.needsInitialSetup ||
        response.mustChangePassword ||
        response.mustConfigureTmdb ||
        response.mustConfigureTorrent ||
        response.mustConfigureIndexer ||
        (username === "admin" && password === "admin");

      if (mustOpenSetup) {
        navigate("/setup", {
          replace: true,
          state: {
            from: (location.state as { from?: string } | null)?.from || "/",
            forced: true,
          },
        });
        return;
      }

      const nextPath = (location.state as { from?: string } | null)?.from || "/";
      navigate(nextPath, { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Connexion impossible"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      <div className="mb-8 flex items-center gap-3">
        <img
          src="/favicon.svg"
          alt="SeedFlix"
          className="h-12 w-12 rounded-sm"
        />
        <h1 className="text-4xl font-black text-white tracking-tighter">
          SeedFlix
        </h1>
      </div>
      <Card className="w-full max-w-md border-white/10 bg-white/5 text-white backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Connexion</CardTitle>
          <CardDescription className="text-white/60">
            Identifiez-vous pour accéder à l'application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-white/40" />
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="pl-10 bg-slate-900 border-white/10 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-white/40" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-10 bg-slate-900 border-white/10 text-white"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-300">{error}</p>}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {isSubmitting ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
