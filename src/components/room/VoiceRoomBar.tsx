import React, { useState } from 'react';
import { useStudyRoom } from '../../context/StudyRoomContext';
import {
  Mic,
  MicOff,
  PhoneOff,
  Phone,
  Volume2,
  Users,
  ChevronDown,
  ChevronUp,
  Radio,
  Info,
  Server,
  RefreshCw,
} from 'lucide-react';

export function VoiceRoomBar(): React.ReactElement | null {
  const {
    voiceState,
    toggleVoiceCall,
    toggleMicrophone,
    members,
    currentUser,
    liveKitDebugInfo,
  } = useStudyRoom();
  const [showMembersList, setShowMembersList] = useState(false);

  const safeMembers = Array.isArray(members) ? members : [];

  // Filter members who are active in the voice call
  const voiceUsers = safeMembers.filter(
    (m) => m && (m.isVoiceActive || (m.id === currentUser.id && voiceState.isCallActive))
  );

  const activeSpeakersList = voiceUsers.filter((m) => m && m.isSpeaking);

  // If call is not active and not connecting, show an unobtrusive bar allowing users to join!
  if (!voiceState || (!voiceState.isCallActive && !voiceState.isConnecting)) {
    return (
      <div
        className="w-full bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-2 text-xs shrink-0"
        dir="rtl"
      >
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium min-w-0">
          <Radio className="w-4 h-4 text-indigo-500 animate-pulse shrink-0" />
          <span className="font-extrabold text-xs sm:text-[13px] truncate">🎙️ تماس صوتی</span>
          <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-slate-400">
            (زنده و دوطرفه)
          </span>
        </div>
        <div className="mr-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleVoiceCall}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 sm:px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-xs cursor-pointer active:scale-95 text-center text-xs"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>اتصال صوتی</span>
          </button>
        </div>
      </div>
    );
  }

  const isReconnecting = liveKitDebugInfo?.isReconnecting;
  const isConnected = liveKitDebugInfo?.isConnected || voiceState.isCallActive;

  return (
    <div
      className="w-full bg-emerald-500/10 dark:bg-emerald-950/20 border-b border-emerald-500/20 px-3 sm:px-4 py-2 flex flex-col gap-2 text-xs transition-all shrink-0"
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2 min-w-0">
          {voiceState.isConnecting ? (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
              <Volume2 className="w-4 h-4 animate-spin text-amber-500" />
              <span>⏳ در حال برقراری اتصال صوتی و گرفتن دسترسی میکروفون...</span>
            </div>
          ) : isReconnecting ? (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              <span>در حال اتصال مجدد به سرور صوتی...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="font-extrabold text-[13px]">
                🎙️ تماس صوتی کلاس ● متصل
              </span>

              <button
                type="button"
                onClick={() => setShowMembersList(!showMembersList)}
                className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-emerald-500/20 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 transition-colors mr-2 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>اعضای صوتی ({voiceUsers.length})</span>
                {showMembersList ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {activeSpeakersList.length > 0 && (
                <span className="hidden md:inline-block text-[11px] text-emerald-600 dark:text-emerald-400 bg-white/60 dark:bg-slate-900/40 border border-emerald-500/10 px-2 py-0.5 rounded-md font-medium pr-2">
                  🔊 در حال صحبت: {activeSpeakersList.map((s) => s.name).join('، ')}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {voiceState.isCallActive && (
            <button
              type="button"
              onClick={toggleMicrophone}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 ${
                voiceState.isMuted
                  ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                  : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 border border-emerald-200/50'
              }`}
              title={voiceState.isMuted ? 'روشن کردن میکروفون' : 'خاموش کردن میکروفون'}
            >
              {voiceState.isMuted ? (
                <>
                  <MicOff className="w-3.5 h-3.5 text-rose-600" />
                  <span>🎙️ میوت</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-emerald-600" />
                  <span>🎙️ فعال</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={toggleVoiceCall}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="خروج از تماس صوتی"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>📵 خروج</span>
          </button>
        </div>
      </div>

      {/* Expandable Voice Members List */}
      {showMembersList && voiceUsers.length > 0 && (
        <div className="mt-2 p-3 bg-white/60 dark:bg-slate-900/40 rounded-xl border border-emerald-500/10 space-y-2 animate-in slide-in-from-top duration-150 text-right">
          <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-emerald-500" />
            <span>اطلاعات تماس صوتی و اعضای متصل:</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {voiceUsers.map((member) => {
              const isMe = member.id === currentUser.id;
              const liveKitUser = liveKitDebugInfo?.participants.find(
                (p) => p.identity === member.id
              );
              const isSpeaking = liveKitUser ? liveKitUser.isSpeaking : member.isSpeaking;
              const isMuted = liveKitUser
                ? liveKitUser.isMuted
                : isMe
                ? voiceState.isMuted
                : member.isMuted;

              return (
                <div
                  key={member.id}
                  className="flex flex-col p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-500/10 shadow-2xs text-right"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSpeaking
                            ? 'bg-emerald-500 ring-4 ring-emerald-400/40 animate-pulse'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                      <span className="font-extrabold text-slate-800 dark:text-slate-100 truncate max-w-[100px]">
                        {member.name} {isMe && '(شما)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isMuted ? (
                        <span className="text-[9px] bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 text-rose-600 px-1.5 py-0.5 rounded-md font-medium">
                          میوت
                        </span>
                      ) : (
                        <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 px-1.5 py-0.5 rounded-md font-medium">
                          فعال
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Development Voice Diagnostic Panel */}
          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-[10px] space-y-1.5 font-mono text-left bg-slate-900 text-slate-100 p-3 rounded-lg shadow-inner">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-indigo-400 font-bold">
              <span className="flex items-center gap-1">
                <Server className="w-3.5 h-3.5" /> Voice Engine Diagnostic
              </span>
              <span className="text-slate-400 text-[9px]">
                Mode: {voiceState.liveKitConfig?.serverUrl.startsWith('builtin://') ? 'Direct TLS Relay' : 'LiveKit SFU'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-400">Connection State: </span>
                <span
                  className={`font-bold ${
                    isConnected ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {liveKitDebugInfo?.connectionState || (isConnected ? 'connected' : 'idle')}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Room: </span>
                <span className="font-bold text-sky-400">
                  {voiceState.liveKitConfig?.roomName || liveKitDebugInfo?.roomName || 'studyroom_...'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Local Mic: </span>
                <span
                  className={`font-bold ${
                    !voiceState.isMuted ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {!voiceState.isMuted ? 'ACTIVE (TRANSMITTING)' : 'MUTED (PAUSED)'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Audio Playback: </span>
                <span className="font-bold text-emerald-400">
                  ONLINE (REAL AUDIO)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceRoomBar;
