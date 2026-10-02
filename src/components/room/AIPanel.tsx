import React, { useState, useRef, useEffect } from 'react';
import { useStudyRoom } from '../../context/StudyRoomContext';
import { formatMathAndMarkdown } from '../../utils/mathRenderer';
import { CopyButton } from '../ui/CopyButton';
import {
  Bot,
  Sparkles,
  Upload,
  FileText,
  Send,
  CheckCircle2,
  BookOpen,
  Loader2,
  User,
  Zap,
  Brain,
  Layers,
  Camera,
  X,
  Trash2,
  CornerUpLeft,
  Reply,
} from 'lucide-react';

export const AIPanel: React.FC = () => {
  const {
    aiMessages = [],
    sendAIQuestion,
    sendAIVision,
    pamphlets = [],
    uploadProgress,
    uploadPamphlet,
    deletePamphlet,
    isAskingAI = false,
    aiMode = 'simple',
    setAiMode,
    aiThinking = { isThinking: false },
    replyingToMessage,
    setReplyingToMessage,
    currentUser,
  } = useStudyRoom();

  const safeAIMessages = Array.isArray(aiMessages) ? aiMessages : [];
  const safePamphlets = Array.isArray(pamphlets) ? pamphlets : [];

  const [question, setQuestion] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const prevMsgCountRef = useRef<number>(safeAIMessages.length);

  // Monitor user scrolling: if user scrolls up to read, do NOT hijack their position!
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    isUserScrolledUpRef.current = distanceFromBottom > 90;
  };

  // Only scroll down when a NEW message arrives and user is near bottom
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const countIncreased = safeAIMessages.length > prevMsgCountRef.current;
    prevMsgCountRef.current = safeAIMessages.length;

    if (countIncreased && !isUserScrolledUpRef.current) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [safeAIMessages.length]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!question.trim() && !selectedImage) || isAskingAI) return;

    const q = question.trim();
    const img = selectedImage;

    setQuestion('');
    setSelectedImage(null);
    isUserScrolledUpRef.current = false;

    if (img) {
      await sendAIVision(q, img.file, aiMode);
    } else {
      await sendAIQuestion(q, aiMode);
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    if (isAskingAI) return;
    isUserScrolledUpRef.current = false;
    sendAIQuestion(promptText, aiMode);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadPamphlet(file);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setSelectedImage({ file, previewUrl });
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const quickPrompts = [
    'خلاصه کردن جزوه‌های موجود این اتاق',
    'طرح ۳ سوال امتحانی از متن درس',
    'تعاریف کلیدی و فرمول‌ها را تشریح کن',
  ];

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border-l lg:border-l-0 lg:border-r border-slate-200/80 dark:border-slate-800 p-4 text-right overflow-hidden select-text">
      {/* Panel Header */}
      <div className="flex items-center gap-2.5 mb-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="w-9 h-9 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
          <Bot className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              🤖 دستیار هوشمند
            </h2>
            <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md">
              مشترک
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            سؤالت رو درباره جزوه یا درس بپرس.
          </p>
        </div>
      </div>

      {/* Mode Selector: نسخه معمولی vs نسخه عمیق و پیچیده */}
      <div className="mb-3 shrink-0">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 px-0.5">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            حالت پاسخ‌دهی هوش مصنوعی:
          </span>
          <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
            {aiMode === 'complex' ? 'استدلال گام‌به‌گام' : 'پاسخ مستقیم'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs font-bold">
          <button
            type="button"
            onClick={() => setAiMode('simple')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
              aiMode === 'simple'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>نسخه معمولی</span>
            <span className="text-[9px] opacity-75 font-normal hidden sm:inline">(خلاصه)</span>
          </button>

          <button
            type="button"
            onClick={() => setAiMode('complex')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
              aiMode === 'complex'
                ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs ring-1 ring-purple-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span>نسخه پیچیده</span>
            <span className="text-[9px] opacity-75 font-normal hidden sm:inline">(تحلیلی)</span>
          </button>
        </div>
      </div>

      {/* Upload Pamphlet Section: 📚 منابع این اتاق */}
      <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/40 dark:from-indigo-950/30 dark:to-purple-950/20 p-3 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 mb-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>📚 منابع این اتاق</span>
          </div>
          <span className="text-[10px] font-medium text-slate-500 bg-white/70 dark:bg-slate-900/70 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/40">
            {safePamphlets.length} فایل
          </span>
        </div>

        {/* Upload Action */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept=".pdf,.txt,.doc,.docx"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>در حال خواندن و آپلود...</span>
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>آپلود جزوه (PDF, TXT, DOCX)</span>
            </>
          )}
        </button>

        {/* Live Fast Upload Progress Card */}
        {uploadProgress && uploadProgress.isUploading && (
          <div className="mt-2 p-2.5 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[11px] shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-1.5 font-bold">
              <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 truncate max-w-[180px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
                <span className="truncate">{uploadProgress.fileName}</span>
              </span>
              <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                {uploadProgress.percent}٪
              </span>
            </div>

            {/* Glowing Progress Track */}
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-150"
                style={{ width: `${Math.max(4, uploadProgress.percent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>{uploadProgress.loadedFormatted} از {uploadProgress.totalFormatted}</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">{uploadProgress.speedText}</span>
            </div>
          </div>
        )}

        {/* Pamphlet List & Live Processing Progress */}
        {safePamphlets.length > 0 && (
          <div className="mt-2.5 space-y-2 max-h-36 overflow-y-auto pl-1 pr-0.5">
            {safePamphlets.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-indigo-100 dark:border-indigo-900/40 text-[11px] shadow-2xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                    <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-mono uppercase bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-500">
                      {item.type}
                    </span>
                  </div>
                </div>

                {deleteConfirmId === item.id ? (
                  <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 space-y-1.5">
                    <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300 leading-relaxed">
                      آیا مطمئن هستید که می‌خواهید این جزوه را حذف کنید؟
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          await deletePamphlet(item.id);
                          setDeleteConfirmId(null);
                        }}
                        className="px-2 py-0.5 bg-rose-600 text-white text-[10px] rounded-md hover:bg-rose-700 font-bold cursor-pointer transition-colors"
                      >
                        حذف
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 text-[10px] rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 font-medium cursor-pointer transition-colors"
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Progress / Status Indicator */}
                    {item.status === 'processing' ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-amber-600 dark:text-amber-400">
                          <span className="flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
                            <span>⏳ در حال پردازش...</span>
                          </span>
                          <span className="font-mono font-bold">{item.progressPercent || 0}٪</span>
                        </div>
                        <div className="w-full h-1 bg-amber-100 dark:bg-amber-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(5, item.progressPercent || 0)}%` }}
                          />
                        </div>
                      </div>
                    ) : item.status === 'scanned_ocr_required' || item.status === 'error' ? (
                      <div className="flex items-center justify-between text-[10px] text-rose-600 dark:text-rose-400">
                        <span className="truncate max-w-[140px] font-medium" title={item.error || 'خطا در پردازش'}>
                          خطا در پردازش
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              fetch(`/api/rooms/${item.roomId}/pamphlets/${item.id}/resume`, { method: 'POST' }).catch(() => {});
                            }}
                            className="px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200/50 text-[9px] font-bold cursor-pointer transition-colors"
                          >
                            تلاش مجدد
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer transition-colors rounded-md"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pt-0.5">
                        <span className="flex items-center gap-1">
                          <span className="text-emerald-500">✓</span>
                          <span>آماده استفاده توسط AI</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer transition-colors rounded-md"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Shared AI Q&A Stream - Smooth Native Container Scroll without Page Jumping */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-3 mb-2.5 pr-1 pl-0.5 overscroll-contain"
      >
        {safeAIMessages.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-center my-auto">
            <Sparkles className="w-6 h-6 text-indigo-500 mx-auto mb-1.5 animate-pulse" />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              پرسش‌ها و پاسخ‌ها برای همه اعضا نمایش داده می‌شوند.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              هر عضوی از هوش مصنوعی سوال متنی یا تصویری بپرسد، پاسخ برای کل اتاق مشترک است و بر اساس جزوه اتاق یا تفکر عمیق مدل پاسخ داده می‌شود.
            </p>
          </div>
        ) : null}

        {/* Quick Prompts */}
        {safeAIMessages.length < 2 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-400 px-1">پیشنهاد سریع:</p>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickPrompt(p)}
                  disabled={isAskingAI}
                  className="text-[11px] py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/60 dark:hover:text-indigo-300 transition-colors text-right cursor-pointer disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Shared Messages List */}
        {safeAIMessages.map((item) => {
          if (!item) return null;
          const isUser = item.type === 'user';
          const isSelf = item.senderId === currentUser?.id;

          const handleReplyClick = () => {
            setReplyingToMessage({
              id: item.id,
              senderName: isUser ? (item.sender || 'کاربر') : '🤖 دستیار هوشمند',
              content: item.message,
              isAI: !isUser,
            });
          };

          if (isUser) {
            return (
              <div
                key={item.id}
                id={`aimsg-${item.id}`}
                className="group p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-right space-y-2 animate-in fade-in duration-200"
              >
                <div className="flex items-center justify-between text-[11px] text-indigo-800 dark:text-indigo-300">
                  <div className="flex items-center gap-1.5 font-bold">
                    <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{item.sender || 'کاربر'} {isSelf ? '(شما)' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-indigo-400 dark:text-indigo-500 font-mono">
                      {item.createdAt}
                    </span>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <CopyButton text={item.message} className="!p-0.5 hover:bg-slate-200/50 dark:hover:bg-slate-800/50" />
                      <button
                        type="button"
                        onClick={handleReplyClick}
                        className="p-0.5 text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-200 cursor-pointer"
                        title="ریپلای / پاسخ"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                {item.replyTo && (
                  <div className="p-2 rounded-xl bg-indigo-100/80 dark:bg-indigo-900/60 border-r-3 border-indigo-500 text-[11px] text-indigo-900 dark:text-indigo-100">
                    <span className="font-bold block text-[10px] text-indigo-700 dark:text-indigo-300">
                      پاسخ به {item.replyTo.senderName}:
                    </span>
                    <span className="truncate block opacity-90">{item.replyTo.content}</span>
                  </div>
                )}
                {item.image && (
                  <div className="mt-1">
                    <img
                      src={item.image.startsWith('data:') ? item.image : `data:image/jpeg;base64,${item.image}`}
                      alt="تصویر ارسالی"
                      className="max-h-36 rounded-xl border border-indigo-200/80 dark:border-indigo-800 object-cover shadow-xs"
                    />
                  </div>
                )}
                <p className="text-xs font-medium text-slate-900 dark:text-slate-100 leading-relaxed pr-1">
                  {item.message}
                </p>
              </div>
            );
          }

          // AI Message Card
          return (
            <div
              key={item.id}
              id={`aimsg-${item.id}`}
              className="group p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-right space-y-2 animate-in fade-in duration-200 shadow-xs"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-slate-700/50">
                <div className="flex items-center gap-1.5 text-xs font-black text-indigo-700 dark:text-indigo-400">
                  <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>🤖 دستیار هوشمند</span>
                  {item.mode === 'complex' && (
                    <span className="text-[9px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-1.5 py-0.2 rounded-md">
                      عمیق و تحلیلی
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.createdAt}
                  </span>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyButton text={item.message} className="!p-0.5 hover:bg-slate-200/50 dark:hover:bg-slate-800/50" />
                    <button
                      type="button"
                      onClick={handleReplyClick}
                      className="p-0.5 text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-200 cursor-pointer"
                      title="ریپلای / پاسخ"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {item.replyTo && (
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 border-r-3 border-purple-500 text-[11px] text-purple-950 dark:text-purple-200">
                  <span className="font-bold block text-[10px] text-purple-700 dark:text-purple-300">
                    پاسخ به {item.replyTo.senderName}:
                  </span>
                  <span className="truncate block opacity-90">{item.replyTo.content}</span>
                </div>
              )}

              <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-text">
                {formatMathAndMarkdown(item.message)}
              </div>

              {item.sources && Array.isArray(item.sources) && item.sources.length > 0 && (
                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="font-semibold">بر اساس جزوه:</span>
                  {item.sources.map((src, i) => (
                    <span
                      key={i}
                      className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono"
                    >
                      {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Live Interactive Thinking Indicator */}
        {(isAskingAI || Boolean(aiThinking?.isThinking)) && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 border border-purple-300/80 dark:border-purple-700/80 text-right space-y-2 animate-pulse shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300">
                <Brain className="w-4 h-4 animate-spin text-purple-600 shrink-0" />
                <span>جمینای در حال تحلیل و تفکر است...</span>
              </div>
              <span className="text-[10px] font-semibold bg-purple-200/80 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded-full">
                {aiMode === 'complex' ? 'تحلیل عمیق و پیچیده' : 'پاسخ سریع و خلاصه'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-purple-900 dark:text-purple-200 pr-1">
              <div className="flex gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce"></span>
              </div>
              <p className="truncate">
                {aiThinking?.question ? `«${aiThinking.question}»` : 'بررسی منابع و فرموله‌کردن پاسخ...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Reply Preview Bar */}
      {replyingToMessage && (
        <div className="mb-2 p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-between shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0 pr-1">
            <div className="w-1 h-6 bg-indigo-600 rounded-full shrink-0" />
            <Reply className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 rotate-180" />
            <div className="flex flex-col min-w-0 text-right">
              <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                پاسخ به {replyingToMessage.senderName}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                {replyingToMessage.content}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingToMessage(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
            title="انصراف"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Selected Image Preview */}
      {selectedImage && (
        <div className="mb-2 p-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <img
              src={selectedImage.previewUrl}
              alt="پیش‌نمایش تصویر"
              className="w-10 h-10 object-cover rounded-lg border border-purple-300 dark:border-purple-700"
            />
            <span className="text-[11px] font-semibold text-purple-900 dark:text-purple-200 truncate max-w-[180px]">
              {selectedImage.file.name}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
            title="حذف تصویر"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Question Input Form with Camera Button 📷 */}
      <form onSubmit={handleAsk} className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
        {/* Hidden Image Input */}
        <input
          type="file"
          ref={imageInputRef}
          onChange={handleImageSelect}
          className="hidden"
          accept="image/*"
        />

        {/* Camera / Image Button 📷 */}
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={isAskingAI}
          className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs ${
            selectedImage
              ? 'bg-purple-600 border-purple-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          title="📷 پرسش از روی عکس فرمول، مسئله یا صفحه کتاب"
        >
          <Camera className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            selectedImage
              ? 'سوال یا توضیحی درباره این عکس بنویسید (اختیاری)...'
              : aiMode === 'complex'
              ? 'سؤال تحلیلی و عمیق خود را بپرسید...'
              : 'سؤالت رو بنویس (نسخه خلاصه و سریع)...'
          }
          disabled={isAskingAI}
          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={(!question.trim() && !selectedImage) || isAskingAI}
          className={`p-2.5 rounded-xl text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-xs ${
            aiMode === 'complex' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
          title="ارسال سوال به هوش مصنوعی"
        >
          {isAskingAI ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4 rotate-180" />
          )}
        </button>
      </form>
    </div>
  );
};
