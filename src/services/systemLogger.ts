import fs from 'fs';
import path from 'path';

export type LogLevel = 'error' | 'warn' | 'info';
export type LogCategory = 'server' | 'api' | 'pdf' | 'gemini' | 'websocket' | 'client' | 'livekit' | 'system';

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  timeFormatted: string;
  dateFormatted: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  errorName?: string;
  stack?: string;
  context?: Record<string, any>;
}

export interface LoggerStats {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  lastErrorTime?: string;
}

const LOGS_DIR = path.resolve(process.cwd(), '.data/logs');
const LOG_FILE = path.join(LOGS_DIR, 'system-logs.jsonl');
const MAX_MEMORY_LOGS = 300;
const MAX_DISK_LINES = 1500;

class SystemLogger {
  private logs: SystemLogEntry[] = [];
  private isInitialized = false;
  private originalConsoleError: typeof console.error = console.error;
  private originalConsoleWarn: typeof console.warn = console.warn;

  constructor() {
    this.ensureDirectory();
    this.loadPersistedLogs();
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
      }
    } catch {
      // Ignore directory creation errors
    }
  }

  private loadPersistedLogs() {
    try {
      if (fs.existsSync(LOG_FILE)) {
        const content = fs.readFileSync(LOG_FILE, 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);
        const parsed: SystemLogEntry[] = [];
        // Read up to last MAX_MEMORY_LOGS lines
        const recentLines = lines.slice(-MAX_MEMORY_LOGS);
        for (const line of recentLines) {
          try {
            parsed.push(JSON.parse(line));
          } catch {
            // Ignore malformed line
          }
        }
        this.logs = parsed;
      }
    } catch (e) {
      this.originalConsoleError('[SystemLogger] Error loading persisted logs:', e);
    }
  }

  private persistLog(entry: SystemLogEntry) {
    try {
      this.ensureDirectory();
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(LOG_FILE, line, 'utf-8');

      // Periodic truncation if file grows too large
      if (this.logs.length % 100 === 0) {
        this.trimDiskFile();
      }
    } catch {
      // Ignore disk write failure in constrained runtime
    }
  }

  private trimDiskFile() {
    try {
      if (!fs.existsSync(LOG_FILE)) return;
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      if (lines.length > MAX_DISK_LINES) {
        const kept = lines.slice(-MAX_DISK_LINES).join('\n') + '\n';
        fs.writeFileSync(LOG_FILE, kept, 'utf-8');
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Initializes global crash hooks (uncaughtException, unhandledRejection, console interception)
   */
  public initializeHooks() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Capture uncaught exceptions
    process.on('uncaughtException', (err: Error) => {
      this.error('server', `Uncaught Exception: ${err.message}`, err, { fatal: true });
      this.originalConsoleError('[SystemLogger FATAL] Uncaught Exception:', err);
    });

    // Capture unhandled rejections
    process.on('unhandledRejection', (reason: any) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      this.error('server', `Unhandled Promise Rejection: ${err.message}`, err, { unhandled: true });
      this.originalConsoleError('[SystemLogger FATAL] Unhandled Rejection:', reason);
    });

    // Intercept console.error to catch third-party warnings and library exceptions
    console.error = (...args: any[]) => {
      this.originalConsoleError(...args);
      try {
        const firstArg = args[0];
        let message = '';
        let errObj: Error | undefined;

        if (firstArg instanceof Error) {
          errObj = firstArg;
          message = firstArg.message;
        } else if (typeof firstArg === 'string') {
          message = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          const foundErr = args.find((a) => a instanceof Error);
          if (foundErr) errObj = foundErr;
        } else {
          message = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        }

        // Determine category based on message content
        let category: LogCategory = 'server';
        const lower = message.toLowerCase();
        if (lower.includes('pdf') || lower.includes('dommatrix') || lower.includes('canvas')) {
          category = 'pdf';
        } else if (lower.includes('gemini') || lower.includes('googlegenai') || lower.includes('ai')) {
          category = 'gemini';
        } else if (lower.includes('livekit') || lower.includes('voice')) {
          category = 'livekit';
        } else if (lower.includes('websocket') || lower.includes('ws')) {
          category = 'websocket';
        }

        // Avoid infinite loop if console.error is invoked inside systemLogger
        if (!message.includes('[SystemLogger]')) {
          this.recordInternal({
            level: 'error',
            category,
            message: message.slice(0, 1000),
            errorName: errObj?.name,
            stack: errObj?.stack,
          });
        }
      } catch {
        // Ignore logger interception errors
      }
    };

    this.info('system', 'System Logger initialized successfully with auto-crash capture and disk persistence.');
  }

  private recordInternal(params: {
    level: LogLevel;
    category: LogCategory;
    message: string;
    errorName?: string;
    stack?: string;
    context?: Record<string, any>;
  }): SystemLogEntry {
    const now = new Date();
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Formatting for fast user inspection
    const timeFormatted = now.toLocaleTimeString('fa-IR', { hour12: false });
    const dateFormatted = now.toISOString().split('T')[0];

    const entry: SystemLogEntry = {
      id,
      timestamp: now.toISOString(),
      timeFormatted,
      dateFormatted,
      level: params.level,
      category: params.category,
      message: params.message,
      errorName: params.errorName,
      stack: params.stack,
      context: params.context,
    };

    this.logs.push(entry);
    if (this.logs.length > MAX_MEMORY_LOGS) {
      this.logs.shift();
    }

    this.persistLog(entry);
    return entry;
  }

  public error(category: LogCategory, message: string, error?: Error | unknown, context?: Record<string, any>): SystemLogEntry {
    const errObj = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
    return this.recordInternal({
      level: 'error',
      category,
      message,
      errorName: errObj?.name,
      stack: errObj?.stack,
      context,
    });
  }

  public warn(category: LogCategory, message: string, context?: Record<string, any>): SystemLogEntry {
    return this.recordInternal({
      level: 'warn',
      category,
      message,
      context,
    });
  }

  public info(category: LogCategory, message: string, context?: Record<string, any>): SystemLogEntry {
    return this.recordInternal({
      level: 'info',
      category,
      message,
      context,
    });
  }

  public getLogs(filter?: { level?: LogLevel; category?: LogCategory; limit?: number }): SystemLogEntry[] {
    let result = [...this.logs];
    if (filter?.level) {
      result = result.filter((l) => l.level === filter.level);
    }
    if (filter?.category) {
      result = result.filter((l) => l.category === filter.category);
    }
    result.reverse(); // Newest first
    if (filter?.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }
    return result;
  }

  public getStats(): LoggerStats {
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    let lastErrorTime: string | undefined;

    for (let i = this.logs.length - 1; i >= 0; i--) {
      const l = this.logs[i];
      if (l.level === 'error') {
        errors++;
        if (!lastErrorTime) lastErrorTime = l.timestamp;
      } else if (l.level === 'warn') {
        warnings++;
      } else {
        infos++;
      }
    }

    return {
      total: this.logs.length,
      errors,
      warnings,
      infos,
      lastErrorTime,
    };
  }

  public clearLogs() {
    this.logs = [];
    try {
      if (fs.existsSync(LOG_FILE)) {
        fs.unlinkSync(LOG_FILE);
      }
    } catch {
      // Ignore
    }
    this.info('system', 'Log buffer cleared by user request.');
  }

  /**
   * Generates a complete, ready-to-copy Markdown diagnostic report for AI assistance
   */
  public generateDiagnosticReport(): string {
    const stats = this.getStats();
    const memory = process.memoryUsage();
    const memoryFormatted = {
      rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
    };

    const recentErrors = this.logs.filter((l) => l.level === 'error').slice(-15).reverse();
    const recentWarns = this.logs.filter((l) => l.level === 'warn').slice(-10).reverse();

    const lines: string[] = [];
    lines.push('### 📋 گزارش کامل خطای سامانه StudyRoom جهت رفع مشکل توسط هوش مصنوعی');
    lines.push('```yaml');
    lines.push(`گزارش_ایجاد_شده: ${new Date().toISOString()}`);
    lines.push(`نسخه_Node: ${process.version}`);
    lines.push(`سیستم_عامل: ${process.platform} (${process.arch})`);
    lines.push(`زمان_روشن_بودن_سرور: ${Math.round(process.uptime())} ثانیه`);
    lines.push(`مصرف_حافظه: RSS=${memoryFormatted.rss}, Heap=${memoryFormatted.heapUsed}/${memoryFormatted.heapTotal}`);
    lines.push(`تعداد_خطاها: ${stats.errors}`);
    lines.push(`تعداد_هشدارها: ${stats.warnings}`);
    lines.push(`وضعیت_Gemini_API: ${process.env.GEMINI_API_KEY || process.env.API_KEY ? 'تنظیم شده' : 'فاقد کلید'}`);
    lines.push('```\n');

    if (recentErrors.length === 0) {
      lines.push('✅ **هیچ خطای بحرانی در سیستم ثبت نشده است.**');
    } else {
      lines.push(`#### ❌ لیست خطاهای اخیر (${recentErrors.length} مورد):\n`);
      recentErrors.forEach((err, idx) => {
        lines.push(`**خطا #${idx + 1} - [${err.category.toUpperCase()}]** (${err.timestamp})`);
        lines.push(`- **پیام:** \`${err.message}\``);
        if (err.errorName) lines.push(`- **نوع خطا:** \`${err.errorName}\``);
        if (err.context && Object.keys(err.context).length > 0) {
          lines.push(`- **کانتکست/داده‌های تکمیلی:** \`${JSON.stringify(err.context)}\``);
        }
        if (err.stack) {
          lines.push('```text');
          lines.push(err.stack.trim());
          lines.push('```');
        }
        lines.push('');
      });
    }

    if (recentWarns.length > 0) {
      lines.push(`#### ⚠️ هشدارهای اخیر (${recentWarns.length} مورد):\n`);
      recentWarns.forEach((warn, idx) => {
        lines.push(`- **[${warn.category}]** (${warn.timestamp}): ${warn.message}`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('*این گزارش به‌صورت خودکار توسط سیستم لاگینگ StudyRoom آماده شده است. می‌توانید این متن را در چت ارسال کنید تا خطاها فورا بررسی و حل شوند.*');

    return lines.join('\n');
  }
}

export const systemLogger = new SystemLogger();
