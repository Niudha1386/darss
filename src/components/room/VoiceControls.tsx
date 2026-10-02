import React from 'react';
import { useStudyRoom } from '../../context/StudyRoomContext';
import { Mic, MicOff, PhoneOff, Phone, Volume2 } from 'lucide-react';
import { Button } from '../ui/Button';

export const VoiceControls: React.FC = () => {
  const { voiceState, toggleVoiceCall, toggleMicrophone, members } = useStudyRoom();

  const safeMembers = Array.isArray(members) ? members : [];
  const activeSpeakersList = safeMembers.filter(m => m && (m.isSpeaking || m.id === 'user-2'));

  if (!voiceState || (!voiceState.isCallActive && !voiceState.isConnecting)) {
    return (
      <Button
        variant="accent"
        size="sm"
        onClick={toggleVoiceCall}
        icon={<Phone className="w-3.5 h-3.5" />}
      >
        شروع تماس صوتی
      </Button>
    );
  }

  if (voiceState.isConnecting) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-medium animate-pulse">
        <Volume2 className="w-3.5 h-3.5 animate-spin" />
        <span>در حال اتصال به تماس صوتی...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/60 rounded-xl px-3 py-1.5 transition-all">
      <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-semibold pl-2 border-l border-emerald-200 dark:border-emerald-800">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        <span>در حال تماس صوتی</span>
      </div>

      {/* Active speaker hint */}
      {activeSpeakersList.length > 0 && activeSpeakersList[0]?.name && (
        <span className="hidden sm:inline-block text-[11px] text-slate-500 dark:text-slate-400 pl-2">
          گوینده: {activeSpeakersList[0].name}
        </span>
      )}

      {/* Mic toggle */}
      <button
        onClick={toggleMicrophone}
        className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
          voiceState.isMuted
            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300'
            : 'bg-emerald-200 text-emerald-800 hover:bg-emerald-300 dark:bg-emerald-800 dark:text-emerald-100'
        }`}
        title={voiceState.isMuted ? 'روشن کردن میکروفون' : 'خاموش کردن میکروفون'}
      >
        {voiceState.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>

      {/* End Call */}
      <button
        onClick={toggleVoiceCall}
        className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
        title="پایان تماس صوتی"
      >
        <PhoneOff className="w-4 h-4" />
      </button>
    </div>
  );
};
