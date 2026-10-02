import React from 'react';
import { useStudyRoom } from '../../context/StudyRoomContext';
import { PWAInstallButton } from '../ui/PWAInstallButton';
import {
  Users,
  Bot,
  Copy,
  LogOut,
  Sun,
  Moon,
  GraduationCap
} from 'lucide-react';

interface RoomHeaderProps {
  onOpenSidebarDrawer: () => void;
  onOpenAIDrawer: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  onOpenSidebarDrawer,
  onOpenAIDrawer,
}) => {
  const { activeRoom, copyRoomLink, leaveRoom, theme, toggleTheme, members, connectionStatus } = useStudyRoom();

  const safeMembers = Array.isArray(members) ? members : [];
  const onlineCount = safeMembers.filter((m) => m && m.isOnline).length;
  const isConnected = connectionStatus === 'connected';

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md px-3 sm:px-6 py-2.5 transition-colors shrink-0">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {/* Left / Start Zone: Room Info & Brand */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Sidebar Button */}
          <button
            type="button"
            onClick={onOpenSidebarDrawer}
            className="lg:hidden min-w-[38px] min-h-[38px] p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center shrink-0"
            title="اطلاعات و اعضای اتاق"
          >
            <Users className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 hidden xs:flex">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="text-xs sm:text-base font-black text-slate-900 dark:text-slate-100 truncate max-w-[120px] xs:max-w-[160px] sm:max-w-xs">
                  {activeRoom?.name || 'اتاق مطالعه'}
                </h1>
                {activeRoom?.id && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    {activeRoom.id}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    connectionStatus === 'reconnecting' ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
                  }`}
                  title={connectionStatus === 'reconnecting' ? 'در حال اتصال مجدد' : 'متصل به سرور چت'}
                />
                <span className="whitespace-nowrap">{onlineCount > 0 ? `${onlineCount} آنلاین` : 'آنلاین'}</span>
                {connectionStatus === 'reconnecting' && (
                  <span className="text-[10px] text-amber-500 font-medium whitespace-nowrap">
                    (در حال اتصال...)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Right Zone: AI Drawer, Share & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Copy Link Button */}
          <button
            type="button"
            onClick={copyRoomLink}
            className="min-w-[38px] min-h-[38px] p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title="کپی لینک دعوت"
          >
            <Copy className="w-4 h-4" />
          </button>

          {/* Mobile AI Drawer Trigger */}
          <button
            type="button"
            onClick={onOpenAIDrawer}
            className="lg:hidden min-w-[38px] min-h-[38px] p-2 rounded-xl text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 cursor-pointer flex items-center justify-center shrink-0"
            title="دستیار هوشمند"
          >
            <Bot className="w-4 h-4" />
          </button>

          <PWAInstallButton className="hidden md:inline-flex" />

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="min-w-[38px] min-h-[38px] p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center justify-center shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Exit Room */}
          <button
            type="button"
            onClick={leaveRoom}
            className="min-w-[38px] min-h-[38px] p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title="خروج از اتاق"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
