import React, { useState, useEffect } from 'react';
import { useStudyRoom } from '../context/StudyRoomContext';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { PWAInstallButton } from './ui/PWAInstallButton';
import { roomService } from '../services/roomService';
import {
  MessageSquare,
  Bot,
  FileText,
  Mic,
  PlusCircle,
  LogIn,
  Sun,
  Moon,
  Sparkles,
  ArrowLeft,
  Users,
  GraduationCap,
  Zap,
  BookOpen,
  Bug
} from 'lucide-react';

export const Lobby: React.FC = () => {
  const { openModal, theme, toggleTheme, joinRoom } = useStudyRoom();

  const [publicRooms, setPublicRooms] = useState<Array<{
    id: string;
    name: string;
    category?: string;
    membersCount: number;
    onlineCount: number;
    ownerName?: string;
  }>>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState<boolean>(true);

  const fetchRooms = React.useCallback(async () => {
    try {
      const rooms = await roomService.getRooms();
      if (rooms && Array.isArray(rooms)) {
        setPublicRooms(
          rooms.map((r: any) => ({
            id: r.id,
            name: r.name,
            category: r.category || 'عمومی',
            membersCount: Array.isArray(r.members) ? r.members.length : (r.membersCount || 1),
            onlineCount: Array.isArray(r.members) ? r.members.filter((m: any) => m.isOnline).length : (r.onlineCount || 0),
            ownerName: r.ownerName || r.hostName || 'سازنده کلاس',
          }))
        );
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000); // Live poll created rooms every 3 seconds
    return () => clearInterval(interval);
  }, [fetchRooms]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200" dir="rtl">
      {/* Top Header Bar - 3 Zone Top Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Zone 1: Wordmark Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white font-extrabold shadow-sm shadow-indigo-500/30 shrink-0">
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
              StudyRoom
            </span>
          </div>

          {/* Zone 2: Navigation / Highlights */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">قابلیت‌ها</a>
            <a href="#active-rooms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">اتاق‌های آنلاین</a>
            <a href="#about" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">درباره پلتفرم</a>
          </nav>

          {/* Zone 3: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton />

            <button
              onClick={() => openModal('error-logs')}
              className="p-2 min-w-[36px] min-h-[36px] rounded-xl text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200/80 dark:border-rose-900/50 transition-colors cursor-pointer flex items-center justify-center shrink-0"
              title="گزارش خطاها و عیب‌یابی سامانه"
            >
              <Bug className="w-4 h-4" />
            </button>
            
            <button
              onClick={toggleTheme}
              className="p-2 min-w-[36px] min-h-[36px] rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center justify-center shrink-0"
              title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => openModal('join-room')}
              icon={<LogIn className="w-3.5 h-3.5" />}
              className="hidden sm:inline-flex"
            >
              ورود با کد
            </Button>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 pt-10 sm:pt-16 pb-16 flex flex-col items-center text-center">
        {/* Subtle Badge Header */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
          <span>چت گروهی Real-time فعال شد</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.25] sm:leading-[1.2] max-w-3xl mb-6">
          با هم درس بخونید، <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-indigo-600 via-sky-500 to-teal-500 bg-clip-text text-transparent">
            بهتر یاد بگیرید
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed mb-10">
          اتاق مطالعه آنلاین بسازید، لینک آن را برای دوستانتان بفرستید و در محیطی خلوت، شیک و هوشمند همراه هم به صورت زنده چت کنید و اشکالات درسی را رفع نمایید.
        </p>

        {/* Hero CTA Action Group */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-md mb-16">
          <Button
            variant="primary"
            size="lg"
            className="w-full sm:w-auto text-base py-3.5 px-8 shadow-lg shadow-indigo-500/25"
            onClick={() => openModal('create-room')}
            icon={<PlusCircle className="w-5 h-5" />}
          >
            ساخت اتاق مطالعه
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto text-base py-3.5 px-8"
            onClick={() => openModal('join-room')}
            icon={<LogIn className="w-5 h-5" />}
          >
            ورود به اتاق
          </Button>
        </div>

        {/* Features Showcase Grid */}
        <section id="features" className="w-full pt-6 pb-12">
          <div className="text-right mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-500" />
              امکانات اتاق مطالعه گروهی
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              همه ابزارهای موردنیاز برای یک مطالعه گروهی باکیفیت و بدون حواشی.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-right">
            {/* Feature 1 */}
            <Card className="hover:border-indigo-400/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
                چت گروهی Real-time
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                گفتگوی متنی لحظه‌ای با تفکیک پیام‌های اعضا، اسکرول هوشمند و ایزولاسیون کامل اتاق‌ها.
              </p>
            </Card>

            {/* Feature 2 */}
            <Card className="hover:border-indigo-400/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
                دستیار AI
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                دستیار هوشمند تعبیه‌شده برای پاسخ به سوالات، خلاصه کردن مفاهیم و حل مسائل امتحانی.
              </p>
            </Card>

            {/* Feature 3 */}
            <Card className="hover:border-indigo-400/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
                اشتراک جزوه
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                آپلود و مشاهده جزوات، فایل‌های PDF و خلاصه درس‌ها به صورت مشترک بین اعضا.
              </p>
            </Card>

            {/* Feature 4 */}
            <Card className="hover:border-indigo-400/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4">
                <Mic className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
                تماس صوتی
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                ارتباط صوتی شفاف با قابلیت روشن/خاموش کردن میکروفون و نشانگر سخنران فعال.
              </p>
            </Card>
          </div>
        </section>

        {/* Active Real Rooms Section */}
        <section id="active-rooms" className="w-full py-8 border-t border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div className="text-right">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                <span>اتاق‌های مطالعه آنلاین فعال</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                کلاس‌ها و اتاق‌های فعال در پلتفرم (به‌صورت زنده و به‌روز):
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openModal('create-room')}
              icon={<PlusCircle className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              ساخت کلاس جدید
            </Button>
          </div>

          {isLoadingRooms && publicRooms.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs animate-pulse">
              در حال دریافت لیست اتاق‌های آنلاین...
            </div>
          ) : publicRooms.length === 0 ? (
            <div className="text-center py-12 bg-slate-100/60 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">هنوز هیچ اتاقی ساخته نشده است.</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">اولین کلاس یا اتاق مطالعه را خودتان بپازید!</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => openModal('create-room')}
                icon={<PlusCircle className="w-4 h-4" />}
              >
                ساخت اولین اتاق مطالعه
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-right">
              {publicRooms.map((room) => (
                <Card
                  key={room.id}
                  hoverable
                  onClick={() => joinRoom(room.id)}
                  className="flex flex-col justify-between cursor-pointer group hover:border-indigo-500/50 transition-all shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900">
                        {room.category}
                      </span>
                      <span className="text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                        کد: {room.id}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-1 line-clamp-1">
                      {room.name}
                    </h3>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                      سازنده: {room.ownerName || 'کاربر'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{room.membersCount} عضو</span>
                      </div>
                      {room.onlineCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{room.onlineCount} آنلاین</span>
                        </span>
                      )}
                    </div>

                    <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                      <span>ورود</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer id="about" className="w-full border-t border-slate-200/80 dark:border-slate-800/80 py-6 px-4 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} StudyRoom — وب‌اپلیکیشن مطالعه گروهی آنلاین</p>
          <div className="flex items-center gap-4 text-slate-500">
            <button
              type="button"
              onClick={() => openModal('error-logs')}
              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
            >
              <Bug className="w-3.5 h-3.5" />
              <span>گزارش خطاها و لاگ‌ها</span>
            </button>
            <span>·</span>
            <span>طراحی شده برای موبایل و دسکتاپ</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
