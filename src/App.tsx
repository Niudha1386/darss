import React from 'react';
import { StudyRoomProvider, useStudyRoom } from './context/StudyRoomContext';
import { Lobby } from './components/Lobby';
import { RoomView } from './components/room/RoomView';
import { CreateRoomModal } from './components/modals/CreateRoomModal';
import { JoinRoomModal } from './components/modals/JoinRoomModal';
import { NameEntryModal } from './components/modals/NameEntryModal';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { CheckCircle2, AlertCircle, Info, Loader2, DoorClosed } from 'lucide-react';

import { ErrorBoundary } from './components/ui/ErrorBoundary';

const ToastNotification: React.FC = () => {
  const { toast } = useStudyRoom();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />,
    info: <Info className="w-4 h-4 text-sky-500 shrink-0" />,
  };

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-top duration-200 border border-slate-700 dark:border-slate-200"
      dir="rtl"
    >
      {icons[toast.type]}
      <span>{toast.text}</span>
    </div>
  );
};

const TopLoadingIndicator: React.FC = () => {
  const { isLoadingRoom } = useStudyRoom();

  if (!isLoadingRoom) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center bg-indigo-600 text-white py-1.5 px-4 text-xs font-semibold shadow-md animate-in slide-in-from-top duration-200" dir="rtl">
      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 ml-2" />
      <span>در حال بررسی اطلاعات اتاق...</span>
    </div>
  );
};

const RoomNotFoundView: React.FC<{ error: string; onHome: () => void; onCreate: () => void }> = ({
  error,
  onHome,
  onCreate,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors" dir="rtl">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 dark:text-rose-400 flex items-center justify-center">
          <DoorClosed className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
            {error || 'این اتاق پیدا نشد یا لینک آن منقضی شده است.'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            ممکن است کد اتاق را اشتباه وارد کرده باشید یا اتاق توسط سازنده حذف شده باشد.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onHome}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            بازگشت به لابی
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer shadow-md shadow-indigo-500/20"
          >
            ساخت اتاق مطالعه
          </button>
        </div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { activeRoom, roomError, currentPath, clearRoomError, navigateTo, openModal } = useStudyRoom();

  const isRoomPath = currentPath.startsWith('/room/');
  const showRoomNotFound = isRoomPath && !activeRoom && Boolean(roomError);

  return (
    <>
      <TopLoadingIndicator />
      <ToastNotification />
      <OfflineIndicator />

      {showRoomNotFound ? (
        <RoomNotFoundView
          error={roomError || 'این اتاق پیدا نشد یا لینک آن منقضی شده است.'}
          onHome={() => {
            clearRoomError();
            navigateTo('/');
          }}
          onCreate={() => {
            clearRoomError();
            openModal('create-room');
          }}
        />
      ) : activeRoom ? (
        <RoomView />
      ) : (
        <Lobby />
      )}

      {/* Global Modals ALWAYS mounted so name entry / join forms show smoothly */}
      <CreateRoomModal />
      <JoinRoomModal />
      <NameEntryModal />
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <StudyRoomProvider>
        <AppContent />
      </StudyRoomProvider>
    </ErrorBoundary>
  );
}
