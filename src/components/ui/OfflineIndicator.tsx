import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg animate-in slide-in-from-bottom duration-300" dir="rtl">
      <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
      <span>حالت آفلاین — ارتباط اینترنت قطع است.</span>
    </div>
  );
};
