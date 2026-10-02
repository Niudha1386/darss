import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStudyRoom } from '../../context/StudyRoomContext';
import { RoomHeader } from './RoomHeader';
import { VoiceRoomBar } from './VoiceRoomBar';
import { LiveKitVoiceManager } from './LiveKitVoiceManager';
import { RoomSidebar } from './RoomSidebar';
import { AIPanel } from './AIPanel';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInput } from './ChatInput';
import { Drawer } from '../ui/Drawer';
import { Avatar } from '../ui/Avatar';
import { MessageSquare, ArrowDown, RefreshCw, Loader2, Bot, Sparkles } from 'lucide-react';

export const RoomView: React.FC = () => {
  const { messages, isLoadingMessages, connectionStatus, aiThinking, isAskingAI } = useStudyRoom();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const safeMessages = Array.isArray(messages) ? messages : [];
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const prevMessagesCountRef = useRef<number>(safeMessages.length);

  const checkIfNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    const threshold = 100;
    const distanceToBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    return distanceToBottom <= threshold;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
      setShowScrollBottomBtn(false);
      setUnreadCount(0);
      isNearBottomRef.current = true;
    }
  }, []);

  const handleScroll = () => {
    const nearBottom = checkIfNearBottom();
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowScrollBottomBtn(false);
      setUnreadCount(0);
    }
  };

  // Scroll handling on new messages
  useEffect(() => {
    const countIncreased = safeMessages.length > prevMessagesCountRef.current;
    prevMessagesCountRef.current = safeMessages.length;

    if (!countIncreased) {
      return;
    }

    if (isNearBottomRef.current) {
      scrollToBottom(true);
    } else {
      setShowScrollBottomBtn(true);
      setUnreadCount((prev) => prev + 1);
    }
  }, [safeMessages.length, scrollToBottom]);

  // Scroll down when AI starts thinking so the thinking indicator is in view
  useEffect(() => {
    if (aiThinking && aiThinking.isThinking && isNearBottomRef.current) {
      scrollToBottom(true);
    }
  }, [aiThinking?.isThinking, scrollToBottom]);

  return (
    <LiveKitVoiceManager>
      <div className="h-[100dvh] max-h-[100dvh] w-screen max-w-full flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden" dir="rtl">
      {/* Room Header */}
      <RoomHeader
        onOpenSidebarDrawer={() => setIsSidebarOpen(true)}
        onOpenAIDrawer={() => setIsAIOpen(true)}
      />

      {/* Voice Room Status & Controls Bar */}
      <VoiceRoomBar />

      {/* Connection State Alert Banner */}
      {connectionStatus === 'reconnecting' && (
        <div className="bg-amber-600 text-white text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-xs shrink-0 animate-in slide-in-from-top duration-200">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>اتصال قطع شد، در حال تلاش برای اتصال مجدد...</span>
        </div>
      )}

      {/* Main Container - 3 Column Layout on Desktop (RTL: First = Right, Last = Left) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Right Column: AI Assistant Panel (In RTL, this is positioned on the right of Chat) */}
        <div className="hidden lg:block w-80 h-full shrink-0">
          <AIPanel />
        </div>

        {/* Center Column: Main Chat Messages & Input */}
        <main className="flex-1 h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
          {/* Scrollable Messages Stream */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 relative flex flex-col"
          >
            {isLoadingMessages ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 my-auto">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                <p className="text-xs font-medium">در حال دریافت پیام‌های اتاق...</p>
              </div>
            ) : safeMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 my-auto animate-in fade-in duration-300">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-xs">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                  هنوز پیامی ارسال نشده.
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  اولین پیام رو تو بفرست 👋
                </p>
              </div>
            ) : (
              safeMessages.map((msg) => (
                <ChatMessageItem key={msg.id} message={msg} />
              ))
            )}

            {/* Live In-Chat AI Thinking Indicator */}
            {(isAskingAI || Boolean(aiThinking?.isThinking)) && (
              <div className="flex gap-2.5 my-3 max-w-[90%] sm:max-w-[80%] animate-in fade-in duration-200">
                <Avatar name="AI" isAI size="md" />
                <div className="flex flex-col text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5" />
                      🤖 دستیار هوشمند AI
                    </span>
                    <span className="text-[10px] text-purple-500 font-mono animate-pulse">در حال تفکر...</span>
                  </div>

                  <div className="p-3.5 rounded-2xl rounded-tr-xs bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 shadow-xs text-xs text-purple-900 dark:text-purple-200 flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        جمینای در حال تفکر و آماده‌سازی پاسخ {aiThinking?.mode === 'complex' ? 'تحلیلی و عمیق' : 'خلاصه'} است...
                      </span>
                      {aiThinking?.question && (
                        <span className="text-[11px] text-purple-700 dark:text-purple-300 font-normal truncate max-w-[260px] sm:max-w-[340px]">
                          «{aiThinking.question}»
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 mr-auto">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating "New Message ↓" Pill Button */}
          {showScrollBottomBtn && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 animate-in fade-in zoom-in-95 duration-200">
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="flex items-center gap-1.5 bg-indigo-600 text-white dark:bg-indigo-500 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-lg hover:bg-indigo-700 transition-all cursor-pointer active:scale-95"
              >
                <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                <span>پیام جدید {unreadCount > 1 ? `(${unreadCount})` : ''} ↓</span>
              </button>
            </div>
          )}

          {/* Chat Message Input */}
          <ChatInput />
        </main>

        {/* Left Column: Room Sidebar (Info, Link, Members) */}
        <div className="hidden lg:block w-72 h-full shrink-0">
          <RoomSidebar />
        </div>
      </div>

      {/* Mobile Drawer for Members / Sidebar */}
      <Drawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        title="اطلاعات و اعضای اتاق"
        side="right"
      >
        <RoomSidebar />
      </Drawer>

      {/* Mobile Drawer for AI Assistant */}
      <Drawer
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        title="🤖 دستیار هوشمند"
        subtitle="سؤالت رو درباره جزوه یا درس بپرس."
        side="left"
        noPadding={true}
      >
        <AIPanel />
      </Drawer>
      </div>
    </LiveKitVoiceManager>
  );
};
