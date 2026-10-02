import React, { useState, useRef } from 'react';
import { useStudyRoom } from '../../context/StudyRoomContext';
import { Send, Bot, Sparkles, Camera, X, Loader2, Reply } from 'lucide-react';

export const ChatInput: React.FC = () => {
  const {
    sendMessage,
    sendAIVision,
    connectionStatus,
    aiMode,
    isAskingAI,
    aiThinking,
    replyingToMessage,
    setReplyingToMessage,
  } = useStudyRoom();
  const [text, setText] = useState('');
  const [attachedImage, setAttachedImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = text.trim();
    if (!cleanText && !attachedImage) return;

    if (attachedImage) {
      sendAIVision(cleanText, attachedImage.file, aiMode);
      setAttachedImage(null);
      setText('');
      return;
    }

    const sent = sendMessage(cleanText);
    if (sent) {
      setText('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInsertAI = () => {
    if (!text.startsWith('/ai ')) {
      setText('/ai ' + text.replace(/^[/@]ai\s*/i, ''));
    }
    inputRef.current?.focus();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAttachedImage({ file, previewUrl });
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (!text.startsWith('/ai ')) {
      setText('/ai ' + text.replace(/^[/@]ai\s*/i, ''));
    }
  };

  const isDisconnected = connectionStatus === 'disconnected' || connectionStatus === 'reconnecting';
  const isAIPrompt = /^([/@]ai|ai\/|\/هوش)\b/i.test(text.trim()) || attachedImage !== null;

  return (
    <div className="w-full bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 pb-safe shrink-0 transition-colors">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Reply Preview Bar */}
        {replyingToMessage && (
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2 min-w-0 pr-1">
              <div className="w-1 h-7 bg-indigo-600 rounded-full shrink-0" />
              <Reply className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 rotate-180" />
              <div className="flex flex-col min-w-0 text-right">
                <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200">
                  در حال پاسخ به {replyingToMessage.senderName}
                </span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[280px] sm:max-w-[450px]">
                  {replyingToMessage.content}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingToMessage(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="انصراف از پاسخ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Live Thinking Status Banner */}
        {(isAskingAI || Boolean(aiThinking?.isThinking)) && (
          <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800 px-3 py-1.5 rounded-xl animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-spin shrink-0" />
            <span>🤖 جمینای در حال تحلیل و تفکر است...</span>
          </div>
        )}

        {/* Quick Helper Banner when invoking /ai or attaching image */}
        {isAIPrompt && !(isAskingAI || Boolean(aiThinking?.isThinking)) && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40 px-3 py-1 rounded-xl animate-in fade-in duration-150">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>
              {attachedImage
                ? '📷 سوال تصویری از هوش مصنوعی: تصویر به همراه متن برای تحلیل به سرور ارسال می‌شود.'
                : 'سوال از هوش مصنوعی در چت: پاسخ به عنوان پیام مشترک هوش مصنوعی در چت درج می‌شود.'}
            </span>
          </div>
        )}

        {/* Attached Image Preview Bar */}
        {attachedImage && (
          <div className="p-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <img
                src={attachedImage.previewUrl}
                alt="تصویر پیوست"
                className="w-9 h-9 object-cover rounded-lg border border-purple-300 dark:border-purple-700"
              />
              <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 truncate max-w-[200px]">
                {attachedImage.file.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              title="حذف تصویر"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Quick AI Tag Button */}
          <button
            type="button"
            onClick={handleInsertAI}
            className={`flex items-center gap-1 px-2.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs ${
              isAIPrompt
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'bg-purple-50 dark:bg-purple-950/40 border-purple-200/70 dark:border-purple-800/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60'
            }`}
            title="پرسش مستقیم از هوش مصنوعی در چت (فرمان /ai)"
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">/ai</span>
          </button>

          {/* Camera / Image Button 📷 */}
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageSelect}
            className="hidden"
            accept="image/*"
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs ${
              attachedImage
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="📷 ارسال تصویر برای هوش مصنوعی"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Message Input Field */}
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              attachedImage
                ? 'توضیحی درباره این عکس بنویسید (اختیاری)...'
                : 'پیام خود را بنویسید (یا برای پرسش از هوش مصنوعی: ai/ سوال)...'
            }
            className="flex-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!text.trim() && !attachedImage}
            className={`p-3 rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-sm active:scale-95 ${
              isAIPrompt
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600'
            }`}
            title="ارسال پیام"
          >
            <Send className="w-4 h-4 rotate-180" />
          </button>
        </form>
      </div>
    </div>
  );
};
