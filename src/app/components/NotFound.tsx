import { Home } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from './ui/button';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <h1 className="text-6xl font-bold text-white">404</h1>
      <h2 className="text-2xl font-semibold text-white/80">Page non trouvée</h2>
      <p className="text-white/60 max-w-md">
        Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <Link to="/">
        <Button className="bg-purple-600 hover:bg-purple-700 text-white">
          <Home className="w-4 h-4 mr-2" />
          Retour à l'accueil
        </Button>
      </Link>
    </div>
  );
}
