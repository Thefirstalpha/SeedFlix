import { Outlet, Link, useLocation } from "react-router";
import { Film, Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { getWishlistCount } from "../services/wishlistService";

export function Root() {
  const location = useLocation();
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    // Mettre à jour le compteur à chaque changement de route
    const loadCount = async () => {
      const count = await getWishlistCount();
      setWishlistCount(count);
    };

    loadCount();
  }, [location]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="border-b border-white/10 backdrop-blur-sm bg-black/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <Film className="w-8 h-8 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">
                Catalog Finder
              </h1>
            </Link>

            <Link
              to="/wishlist"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            >
              <Heart
                className={`w-5 h-5 ${wishlistCount > 0 ? "text-purple-400 fill-purple-400" : "text-white"}`}
              />
              <span className="text-white font-medium">
                Ma liste
              </span>
              {wishlistCount > 0 && (
                <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {wishlistCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-white/10 mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-white/60">
          <p>
            © 2026 CatalogFinder - Découvrez les meilleurs films
          </p>
        </div>
      </footer>
    </div>
  );
}