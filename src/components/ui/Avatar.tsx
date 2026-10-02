import React from 'react';

interface AvatarProps {
  name?: string;
  bgGradient?: string;
  isOnline?: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isAI?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  name = '؟',
  bgGradient = 'from-indigo-500 to-purple-600',
  isOnline,
  isSpeaking,
  isMuted,
  size = 'md',
  isAI = false,
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  };

  const initial = typeof name === 'string' && name.trim() ? name.trim().charAt(0).toUpperCase() : '؟';

  return (
    <div className="relative inline-block shrink-0">
      <div
        className={`relative flex items-center justify-center font-bold text-white rounded-xl shadow-xs transition-transform ${
          sizeClasses[size]
        } ${
          isAI
            ? 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 ring-2 ring-purple-400/30'
            : `bg-gradient-to-br ${bgGradient || 'from-indigo-500 to-purple-600'}`
        } ${isSpeaking ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 animate-pulse' : ''}`}
      >
        {isAI ? (
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ) : (
          initial
        )}
      </div>

      {/* Online / Muted indicator dots */}
      {isOnline !== undefined && !isAI && (
        <span
          className={`absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
            isOnline ? (isSpeaking ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500') : 'bg-slate-400'
          }`}
        />
      )}

      {isMuted && !isAI && (
        <span className="absolute -top-1 -right-1 bg-rose-500 text-white p-0.5 rounded-full ring-2 ring-white dark:ring-slate-900 text-[10px]">
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
          </svg>
        </span>
      )}
    </div>
  );
};
