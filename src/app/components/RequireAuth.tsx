import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";

export function RequireAuth() {
  const location = useLocation();
  const {
    isAuthenticated,
    isLoading,
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

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-white/70">
        Vérification de la session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (hasPendingSetup && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace state={{ from: location.pathname, forced: true }} />;
  }

  return <Outlet />;
}
