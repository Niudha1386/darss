import React from 'react';
import { ChatMessage } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Bot, FileText, Image as ImageIcon, CornerUpLeft, Reply } from 'lucide-react';
import { useStudyRoom } from '../../context/StudyRoomContext';
import { formatMathAndMarkdown } from '../../utils/mathRenderer';
import { CopyButton } from '../ui/CopyButton';

interface ChatMessageItemProps {
  message: ChatMessage;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const { setReplyingToMessage } = useStudyRoom();

  if (!message) return null;

  const {
    id,
    senderName = 'کاربر',
    senderAvatarBg,
    content = '',
    timestamp = '',
    isSelf = false,
    isAI = false,
    replyTo,
    attachment,
  } = message;

  const handleReplyClick = () => {
    setReplyingToMessage({
      id,
      senderName,
      content,
      isAI,
    });
  };

  const scrollToQuoted = (targetId: string) => {
    const el = document.getElementById(`msg-${targetId}`) || document.getElementById(`aimsg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2', 'transition-all', 'duration-300');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
      }, 1500);
    }
  };

  const renderReplyQuote = () => {
    if (!replyTo) return null;
    return (
      <div
        onClick={() => scrollToQuoted(replyTo.id)}
        className="mb-2 p-2 rounded-xl bg-slate-100/90 dark:bg-slate-900/80 border-r-3 border-indigo-500 text-right cursor-pointer hover:bg-slate-200/90 dark:hover:bg-slate-800 transition-colors group/quote"
        title="نمایش پیام اصلی"
      >
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-0.5">
          <Reply className="w-3 h-3 rotate-180" />
          <span>پاسخ به {replyTo.senderName}</span>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[280px]">
          {replyTo.content}
        </p>
      </div>
    );
  };

  if (isAI) {
    return (
      <div id={`msg-${id}`} className="group relative flex gap-3 my-3 max-w-[90%] sm:max-w-[80%] animate-in fade-in duration-200">
        <Avatar name="AI" isAI size="md" />
        <div className="flex flex-col text-right min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                <Bot className="w-3.5 h-3.5" />
                {senderName}
              </span>
              <span className="text-[10px] text-slate-400">{timestamp}</span>
            </div>

            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={content} />
              <button
                type="button"
                onClick={handleReplyClick}
                className="p-1 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-600 dark:text-purple-300 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                title="پاسخ / ریپلای"
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
                <span>پاسخ</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl rounded-tr-xs bg-gradient-to-br from-purple-50 via-indigo-50/40 to-white dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-slate-900 border border-purple-200/70 dark:border-purple-800/60 shadow-xs text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed break-words">
            {renderReplyQuote()}
            {formatMathAndMarkdown(content)}
          </div>
        </div>
      </div>
    );
  }

  if (isSelf) {
    return (
      <div id={`msg-${id}`} className="group relative flex justify-start my-2 max-w-[88%] sm:max-w-[78%] mr-auto animate-in fade-in duration-150">
        <div className="flex flex-col items-start text-right min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1 pl-1 w-full">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{timestamp}</span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">شما</span>
            </div>

            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={content} />
              <button
                type="button"
                onClick={handleReplyClick}
                className="p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                title="پاسخ / ریپلای"
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
                <span>پاسخ</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl rounded-tl-xs bg-indigo-600 text-white dark:bg-indigo-500 shadow-sm text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap">
            {replyTo && (
              <div
                onClick={() => scrollToQuoted(replyTo.id)}
                className="mb-2 p-2 rounded-xl bg-indigo-700/80 dark:bg-indigo-600/80 border-r-3 border-white text-right cursor-pointer hover:bg-indigo-800 transition-colors"
              >
                <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-200 mb-0.5">
                  <Reply className="w-3 h-3 rotate-180" />
                  <span>پاسخ به {replyTo.senderName}</span>
                </div>
                <p className="text-[11px] text-white/90 truncate max-w-[260px]">
                  {replyTo.content}
                </p>
              </div>
            )}
            {content}

            {attachment && (
              <div className="mt-2.5 pt-2 border-t border-white/20 flex items-center gap-2 bg-white/10 p-2 rounded-xl">
                {attachment.type === 'image' ? (
                  <ImageIcon className="w-4 h-4" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <div className="text-right text-[11px] truncate">
                  <p className="font-semibold">{attachment.name}</p>
                  <p className="opacity-80 text-[10px]">{attachment.size}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id={`msg-${id}`} className="group relative flex gap-2.5 my-2 max-w-[88%] sm:max-w-[78%] animate-in fade-in duration-150">
      <Avatar name={senderName} bgGradient={senderAvatarBg} size="md" />
      <div className="flex flex-col text-right min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{senderName}</span>
            <span className="text-[10px] text-slate-400">{timestamp}</span>
          </div>

          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={content} />
            <button
              type="button"
              onClick={handleReplyClick}
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer flex items-center gap-1 text-[10px] font-bold"
              title="پاسخ / ریپلای"
            >
              <CornerUpLeft className="w-3.5 h-3.5" />
              <span>پاسخ</span>
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl rounded-tr-xs bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed shadow-xs break-words">
          {renderReplyQuote()}
          {formatMathAndMarkdown(content)}

          {attachment && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl text-slate-700 dark:text-slate-300">
              {attachment.type === 'image' ? (
                <ImageIcon className="w-4 h-4 text-indigo-500" />
              ) : (
                <FileText className="w-4 h-4 text-emerald-500" />
              )}
              <div className="text-right text-[11px] truncate">
                <p className="font-semibold">{attachment.name}</p>
                <p className="text-slate-400 text-[10px]">{attachment.size}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
