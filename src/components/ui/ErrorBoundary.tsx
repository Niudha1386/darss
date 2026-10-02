import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check, Terminal } from 'lucide-react';
import { clientLogger } from '../../services/clientLogger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('StudyRoom UI Error Caught:', error, errorInfo);

    // Report to clientLogger so it can be retrieved from logs
    clientLogger.reportClientError({
      message: error.message || 'React Component Crash',
      errorName: error.name || 'ComponentError',
      stack: error.stack,
      context: {
        componentStack: errorInfo.componentStack,
        url: typeof window !== 'undefined' ? window.location.href : '',
      },
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    window.location.href = '/';
  };

  private handleCopyError = async () => {
    const report = [
      '### 📋 گزارش خطای رخ داده در رابط کاربری (React Crash Report)',
      '```yaml',
      `زمان: ${new Date().toISOString()}`,
      `پیام_خطا: ${this.state.error?.message || 'نامشخص'}`,
      `نوع_خطا: ${this.state.error?.name || 'Error'}`,
      `آدرس: ${window.location.href}`,
      '```',
      '',
      '#### استک تریس کامپوننت:',
      '```text',
      this.state.error?.stack || 'فاقد استک',
      '```',
      '',
      '#### استک کامپوننت‌های ری‌اکت:',
      '```text',
      this.state.errorInfo?.componentStack || 'نامشخص',
      '```',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(report);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    } catch {
      // Fallback
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4" dir="rtl">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center border border-rose-200 dark:border-rose-900/40">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                مشکلی در بارگذاری رابط کاربری رخ داد
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                خطا در حافظه لاگ سیستم ثبت شد. می‌توانید متن گزارش را کپی کرده و در چت ارسال کنید تا رفع شود.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-900 text-rose-300 p-3 rounded-2xl text-[11px] font-mono text-right overflow-x-auto max-h-32 text-left border border-slate-800">
                <p className="font-bold text-rose-400 mb-1">{this.state.error.name}: {this.state.error.message}</p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={this.handleCopyError}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 ${
                  this.state.copied
                    ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                }`}
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>گزارش کپی شد! در چت پیست کنید</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>کپی گزارش کامل خطا برای ارسال</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>بارگذاری مجدد و بازگشت به لابی</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
