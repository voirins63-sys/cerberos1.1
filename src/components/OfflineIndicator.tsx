import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/src/hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-4 left-3 right-3 sm:right-auto sm:left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-950/95 border border-amber-500/60 px-3.5 py-2 text-xs font-semibold text-amber-100 shadow-2xl"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Mode hors-ligne — Données en cache affichées</span>
    </div>
  );
};
