import React, { useState, useEffect, useCallback } from 'react';
import { useStudyRoom } from '../../context/StudyRoomContext';
import { clientLogger } from '../../services/clientLogger';
import type { SystemLogEntry, LoggerStats, LogLevel, LogCategory } from '../../services/systemLogger';
import {
  X,
  Bug,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Trash2,
  RefreshCw,
  Server,
  FileText,
  Bot,
  Globe,
  Radio,
  Clock,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Check,
  Terminal,
} from 'lucide-react';

export const ErrorLogModal: React.FC = () => {
  const { modalType, closeModal, showToast } = useStudyRoom();
  const isOpen = modalType === 'error-logs';

  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [stats, setStats] = useState<LoggerStats>({ total: 0, errors: 0, warnings: 0, infos: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [copiedItemIndex, setCopiedItemIndex] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'error' | 'warn' | LogCategory>('all');

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await clientLogger.getRemoteLogs();
      setLogs(res.logs);
      setStats(res.stats);
    } catch {
      showToast('خطا در دریافت لیست لاگ‌ها', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeModal();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, fetchLogs, closeModal]);

  if (!isOpen) return null;

  const handleCopyReport = async () => {
    try {
      const report = await clientLogger.getDiagnosticReport();
      await navigator.clipboard.writeText(report);
      setCopiedAll(true);
      showToast('گزارش کامل خطاها کپی شد! می‌توانید آن را در چت ارسال کنید.', 'success');
      setTimeout(() => setCopiedAll(false), 3000);
    } catch {
      showToast('خطا در دسترسی به کلیپ‌بورد', 'error');
    }
  };

  const handleCopySingleLog = async (log: SystemLogEntry) => {
    try {
      const text = [
        `[${log.level.toUpperCase()} - ${log.category.toUpperCase()}] ${log.timestamp}`,
        `پیام: ${log.message}`,
        log.errorName ? `نوع: ${log.errorName}` : '',
        log.context ? `کانتکست: ${JSON.stringify(log.context, null, 2)}` : '',
        log.stack ? `استک تریس:\n${log.stack}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await navigator.clipboard.writeText(text);
      setCopiedItemIndex(log.id);
      showToast('خطا کپی شد!', 'success');
      setTimeout(() => setCopiedItemIndex(null), 2000);
    } catch {
      showToast('خطا در کپی کردن', 'error');
    }
  };

  const handleDownloadReport = async () => {
    try {
      const report = await clientLogger.getDiagnosticReport();
      const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studyroom-error-report-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('فایل گزارش با موفقیت دانلود شد', 'success');
    } catch {
      showToast('خطا در دانلود گزارش', 'error');
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('آیا از پاکسازی تمام لاگ‌های ثبت‌شده مطمئن هستید؟')) {
      return;
    }
    const ok = await clientLogger.clearLogs();
    if (ok) {
      setLogs([]);
      setStats({ total: 0, errors: 0, warnings: 0, infos: 0 });
      showToast('تمامی لاگ‌ها با موفقیت پاکسازی شدند.', 'info');
    } else {
      showToast('خطا در پاکسازی لاگ‌ها', 'error');
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'error') return log.level === 'error';
    if (selectedFilter === 'warn') return log.level === 'warn';
    return log.category === selectedFilter;
  });

  const getCategoryIcon = (category: LogCategory) => {
    switch (category) {
      case 'server':
      case 'api':
        return <Server className="w-3.5 h-3.5" />;
      case 'pdf':
        return <FileText className="w-3.5 h-3.5" />;
      case 'gemini':
        return <Bot className="w-3.5 h-3.5" />;
      case 'client':
        return <Globe className="w-3.5 h-3.5" />;
      case 'websocket':
      case 'livekit':
        return <Radio className="w-3.5 h-3.5" />;
      default:
        return <Terminal className="w-3.5 h-3.5" />;
    }
  };

  const getCategoryLabel = (category: LogCategory) => {
    switch (category) {
      case 'server':
        return 'سرور';
      case 'api':
        return 'API';
      case 'pdf':
        return 'پردازش PDF';
      case 'gemini':
        return 'هوش مصنوعی';
      case 'client':
        return 'فرانت‌اند';
      case 'websocket':
        return 'سوکت';
      case 'livekit':
        return 'صوت/ویدیو';
      default:
        return 'سیستم';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeModal();
        }
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-900/50 shrink-0">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                سیستم گزارش خطاها و عیب‌یابی
                {stats.errors > 0 ? (
                  <span className="text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                    {stats.errors} خطا ثبت شده
                  </span>
                ) : (
                  <span className="text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    سیستم پایدار
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ثبت خودکار تمامی خطاهای سرور، فایل‌های PDF، سوکت و کلاینت برای حل سریع مشکلات
              </p>
            </div>
          </div>

          <button
            onClick={closeModal}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Action Banner: One-Click Copy For AI */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50 via-sky-50 to-purple-50 dark:from-indigo-950/40 dark:via-sky-950/30 dark:to-purple-950/40 border-b border-indigo-100/80 dark:border-indigo-950">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ارسال گزارش برای رفع مشکل توسط هوش مصنوعی
              </h3>
              <p className="text-[11px] sm:text-xs text-indigo-800/80 dark:text-indigo-300/80">
                با یک کلیک، تمام اطلاعات لازم (نسخه محیط، خطاهای اخیر و استک تریس) کپی می‌شود تا در چت بفرستید.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyReport}
                className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 ${
                  copiedAll
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 hover:scale-[1.02]'
                }`}
              >
                {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedAll ? 'کپی شد! در چت پیست کنید' : 'کپی گزارش برای ارسال'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadReport}
                className="p-2 sm:px-3 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                title="دانلود فایل گزارش (.md)"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline">دانلود فایل</span>
              </button>

              <button
                type="button"
                onClick={fetchLogs}
                disabled={isLoading}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="بروزرسانی لاگ‌ها"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Stats & Filters Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Quick Stats Badges */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900/60">
              <AlertTriangle className="w-3 h-3" />
              {stats.errors} خطا
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900/60">
              <AlertTriangle className="w-3 h-3" />
              {stats.warnings} هشدار
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              مجموع: {stats.total}
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full">
            {[
              { id: 'all', label: 'همه' },
              { id: 'error', label: 'فقط خطاها' },
              { id: 'pdf', label: 'PDF' },
              { id: 'gemini', label: 'هوش مصنوعی' },
              { id: 'server', label: 'سرور' },
              { id: 'client', label: 'کلاینت' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFilter(f.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                  selectedFilter === f.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}

            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer mr-1"
                title="پاکسازی همه لاگ‌ها"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Log Entries List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                هیچ خطایی در این بخش ثبت نشده است
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                اگر در حین کار با برنامه هرگونه خطایی رخ دهد، به‌صورت خودکار در اینجا با جزئیات کامل ذخیره می‌شود.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const isError = log.level === 'error';
              const isWarn = log.level === 'warn';

              return (
                <div
                  key={log.id}
                  className={`pt-2.5 first:pt-0 rounded-2xl p-3 transition-colors ${
                    isError
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40'
                      : isWarn
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40'
                      : 'bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isError
                            ? 'bg-rose-500 text-white'
                            : isWarn
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-500 text-white'
                        }`}
                      >
                        {getCategoryIcon(log.category)}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              isError
                                ? 'bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200'
                                : isWarn
                                ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {getCategoryLabel(log.category)}
                          </span>

                          {log.errorName && (
                            <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold">
                              {log.errorName}
                            </span>
                          )}

                          <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {log.timeFormatted || log.timestamp.slice(11, 19)}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 break-words font-mono">
                          {log.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopySingleLog(log)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title="کپی متن این خطا"
                      >
                        {copiedItemIndex === log.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {(log.stack || (log.context && Object.keys(log.context).length > 0)) && (
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title={isExpanded ? 'بستن جزئیات' : 'مشاهده استک تریس'}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Stack Trace and Context */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono space-y-2">
                      {log.context && Object.keys(log.context).length > 0 && (
                        <div>
                          <span className="text-slate-500 block mb-1">داده‌های تکمیلی (Context):</span>
                          <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-xl overflow-x-auto max-h-36 text-[10px]">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.stack && (
                        <div>
                          <span className="text-slate-500 block mb-1">استک تریس خطا (Stack Trace):</span>
                          <pre className="bg-slate-950 text-rose-300 p-2.5 rounded-xl overflow-x-auto max-h-48 text-[10px] whitespace-pre font-mono">
                            {log.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>لاگ‌های سیستم به صورت دائم ذخیره و همگام می‌شوند.</span>
          <button
            type="button"
            onClick={closeModal}
            className="py-1.5 px-4 rounded-xl font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
