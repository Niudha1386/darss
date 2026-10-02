import type { SystemLogEntry, LoggerStats } from './systemLogger';

export interface ClientErrorPayload {
  message: string;
  errorName?: string;
  stack?: string;
  context?: Record<string, any>;
}

class ClientLogger {
  private clientLogs: SystemLogEntry[] = [];
  private isInitialized = false;

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Window global error handler
    window.addEventListener('error', (event) => {
      this.reportClientError({
        message: event.message || 'Unknown browser window error',
        errorName: event.error?.name || 'Error',
        stack: event.error?.stack,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          url: window.location.href,
        },
      });
    });

    // Window unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const isErr = reason instanceof Error;
      this.reportClientError({
        message: isErr ? reason.message : String(reason || 'Unhandled Promise Rejection'),
        errorName: isErr ? reason.name : 'UnhandledRejection',
        stack: isErr ? reason.stack : undefined,
        context: {
          url: window.location.href,
        },
      });
    });
  }

  public reportClientError(payload: ClientErrorPayload) {
    const entry: SystemLogEntry = {
      id: `client_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString('fa-IR', { hour12: false }),
      dateFormatted: new Date().toISOString().split('T')[0],
      level: 'error',
      category: 'client',
      message: payload.message,
      errorName: payload.errorName,
      stack: payload.stack,
      context: {
        ...payload.context,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      },
    };

    // Keep in local cache
    this.clientLogs.unshift(entry);
    if (this.clientLogs.length > 50) this.clientLogs.pop();

    // Send to backend endpoint asynchronously
    try {
      if (typeof fetch !== 'undefined') {
        fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
          keepalive: true,
        }).catch(() => {
          // Ignore network failure when posting log
        });
      }
    } catch {
      // Ignore
    }
  }

  public getLocalClientLogs(): SystemLogEntry[] {
    return [...this.clientLogs];
  }

  public async getRemoteLogs(): Promise<{ logs: SystemLogEntry[]; stats: LoggerStats }> {
    try {
      const res = await fetch('/api/logs');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return {
        logs: data.logs || [],
        stats: data.stats || { total: 0, errors: 0, warnings: 0, infos: 0 },
      };
    } catch {
      // Fallback to local logs if backend is unreachable
      return {
        logs: this.clientLogs,
        stats: {
          total: this.clientLogs.length,
          errors: this.clientLogs.filter((l) => l.level === 'error').length,
          warnings: 0,
          infos: 0,
        },
      };
    }
  }

  public async getDiagnosticReport(): Promise<string> {
    try {
      const res = await fetch('/api/logs/report');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      if (data.report) return data.report;
    } catch {
      // Build client-side fallback report
    }

    // Client-side fallback report if backend is unreachable
    const lines: string[] = [];
    lines.push('### 📋 گزارش خطای کلاینت StudyRoom (حالت محلی)');
    lines.push('```yaml');
    lines.push(`زمان: ${new Date().toISOString()}`);
    lines.push(`آدرس_صفحه: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`);
    lines.push(`مرورگر: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`);
    lines.push(`تعداد_خطاهای_ثبت_شده: ${this.clientLogs.length}`);
    lines.push('```\n');

    this.clientLogs.forEach((err, idx) => {
      lines.push(`**خطا #${idx + 1}** (${err.timestamp})`);
      lines.push(`- **پیام:** \`${err.message}\``);
      if (err.stack) {
        lines.push('```text');
        lines.push(err.stack);
        lines.push('```');
      }
      lines.push('');
    });

    return lines.join('\n');
  }

  public async clearLogs(): Promise<boolean> {
    this.clientLogs = [];
    try {
      const res = await fetch('/api/logs', { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const clientLogger = new ClientLogger();
