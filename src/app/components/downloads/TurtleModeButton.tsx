import { useEffect, useState } from 'react';
import { Loader2, Snail } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { getTurtleMode, setTurtleMode, TurtleModeStats } from '../../services/torrentService';
import { useI18n } from '../../i18n/LanguageProvider';

export function TurtleModeButton() {
  const { language } = useI18n();
  const [stats, setStats] = useState<TurtleModeStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const fetchStatus = () => {
    setIsLoading(true);
    getTurtleMode()
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleToggle = async () => {
    if (!stats || isToggling) return;
    const nextState = !stats.altSpeedEnabled;
    setIsToggling(true);

    try {
      await setTurtleMode(nextState);
      setStats((prev) => (prev ? { ...prev, altSpeedEnabled: nextState } : null));
      if (nextState) {
        toast.info(
          language === 'fr'
            ? 'Mode Tortue activé (débits limités)'
            : 'Turtle Mode enabled (speed limits active)',
        );
      } else {
        toast.success(
          language === 'fr'
            ? 'Mode Tortue désactivé (vitesse maximale)'
            : 'Turtle Mode disabled (full speed)',
        );
      }
    } catch {
      toast.error('Erreur lors du changement du Mode Tortue');
    } finally {
      setIsToggling(false);
    }
  };

  if (!stats && !isLoading) return null;

  const isEnabled = Boolean(stats?.altSpeedEnabled);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleToggle}
      disabled={isToggling}
      title={
        isEnabled
          ? (language === 'fr' ? 'Mode Tortue ACTIF - Cliquez pour désactiver' : 'Turtle Mode ACTIVE')
          : (language === 'fr' ? 'Activer le Mode Tortue (limiter les débits)' : 'Enable Turtle Mode')
      }
      className={`h-9 px-3 border transition-all gap-1.5 font-medium text-xs sm:text-sm ${
        isEnabled
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20'
          : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      {isToggling ? (
        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
      ) : (
        <Snail className={`w-4 h-4 ${isEnabled ? 'text-amber-400 animate-pulse' : ''}`} />
      )}
      <span className="hidden sm:inline">
        {isEnabled ? (language === 'fr' ? 'Tortue (Actif)' : 'Turtle (On)') : (language === 'fr' ? 'Mode Tortue' : 'Turtle Mode')}
      </span>
    </Button>
  );
}

