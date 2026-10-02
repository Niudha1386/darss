import React, { useState } from 'react';
import { useStudyRoom } from '../../context/StudyRoomContext';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Copy, LogOut, Users, Check, Crown, Share2 } from 'lucide-react';

export const RoomSidebar: React.FC = () => {
  const { activeRoom, copyRoomLink, leaveRoom, members, currentUser, showToast } = useStudyRoom();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyRoomLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const safeMembers = Array.isArray(members) ? members : [];
  const onlineMembers = safeMembers.filter((m) => m && m.isOnline);
  const offlineMembers = safeMembers.filter((m) => m && !m.isOnline);

  return (
    <aside className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 p-4 text-right">
      {/* Room Info & Share Card */}
      <div className="bg-gradient-to-br from-indigo-50/80 via-slate-50 to-white dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-900/40 mb-5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-950 px-2 py-0.5 rounded-md">
            {activeRoom?.category || 'اتاق مطالعه'}
          </span>
          {activeRoom?.id && (
            <button
              type="button"
              onClick={() => {
                if (activeRoom) {
                  navigator.clipboard?.writeText(activeRoom.id);
                  showToast(`کد ${activeRoom.id} کپی شد`);
                }
              }}
              className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-indigo-200/60 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1"
              title="کلیک برای کپی کد اتاق"
            >
              <span>کد: {activeRoom.id}</span>
              <Copy className="w-3 h-3 opacity-70" />
            </button>
          )}
        </div>

        <h2 className="text-base font-black text-slate-900 dark:text-slate-100 mb-1">
          {activeRoom?.name || 'اتاق مطالعه'}
        </h2>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          سازنده: {activeRoom?.hostName || 'کاربر'}
        </p>

        {/* Copy Invitation Link Button */}
        <Button
          variant="primary"
          size="sm"
          className="w-full py-2.5 text-xs shadow-xs"
          onClick={handleCopy}
          icon={copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
        >
          {copied ? 'لینک اتاق کپی شد' : 'دعوت به اتاق (کپی لینک)'}
        </Button>
      </div>

      {/* Members Section */}
      <div className="flex-1 overflow-y-auto pl-0.5">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indigo-500" />
            <span>👥 اعضای اتاق</span>
          </h3>
          <Badge variant="indigo" size="sm">
            {onlineMembers.length} آنلاین
          </Badge>
        </div>

        {/* Online Members List */}
        <div className="space-y-2 mb-4">
          {onlineMembers.map((member) => {
            if (!member) return null;
            const isMe = member.id === currentUser?.id || (member.name === currentUser?.name && currentUser?.name !== '');

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar
                    name={member.name}
                    bgGradient={member.avatarBg}
                    isOnline={true}
                    isSpeaking={member.isSpeaking}
                    isMuted={member.isMuted}
                    size="sm"
                  />
                  <div className="min-w-0 text-right">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {member.name} {isMe && <span className="text-indigo-600 dark:text-indigo-400 font-normal">(شما)</span>}
                      </p>
                      {member.role === 'host' && (
                        <span title="مدیر اتاق">
                          <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{member.isSpeaking ? 'درحال صحبت' : 'آنلاین'}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Offline Members List */}
        {offlineMembers.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-slate-400 mb-2 px-1">آفلاین ({offlineMembers.length})</p>
            <div className="space-y-1.5">
              {offlineMembers.map((member) => {
                if (!member) return null;
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-2.5 p-2 rounded-xl opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <Avatar
                      name={member.name}
                      bgGradient={member.avatarBg}
                      isOnline={false}
                      size="sm"
                    />
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                      {member.name}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Leave Room Button */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-auto">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          onClick={leaveRoom}
          icon={<LogOut className="w-3.5 h-3.5" />}
        >
          خروج از اتاق
        </Button>
      </div>
    </aside>
  );
};
