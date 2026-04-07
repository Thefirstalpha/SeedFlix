import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";

export function RequireAuth() {
  const location = useLocation();
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth();

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

  if (mustChangePassword && location.pathname !== "/settings") {
    return <Navigate to="/settings" replace state={{ from: location.pathname, forced: true }} />;
  }

  return <Outlet />;
}
