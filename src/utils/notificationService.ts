// Browser Notification & Audio Chime Utility for StudyRoom

let originalDocumentTitle = typeof document !== 'undefined' ? document.title : 'اتاق مطالعه StudyRoom';
let unreadMessageCount = 0;
let titleInterval: number | null = null;
let isTitleFlashing = false;

// Web Audio API Pleasant Notification Chime
export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Gentle two-tone chord (F5 -> A5)
    osc.frequency.setValueAtTime(698.46, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch (e) {
    // Ignore audio context autoplay restrictions gracefully
  }
}

// Request Browser Notifications Permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }
  return false;
}

// Show desktop/mobile browser notification when app is in the background
export function showBackgroundNotification(senderName: string, messageContent: string, roomName?: string) {
  if (typeof window === 'undefined') return;

  const isTabHidden = document.hidden;
  if (!isTabHidden) return; // Only notify if user is on another tab/window

  // 1. Play audio chime
  playNotificationChime();

  // 2. Increment unread counter and flash tab title
  unreadMessageCount++;
  startFlashingTitle(roomName);

  // 3. Desktop / Mobile Web Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const title = `💬 پیام جدید از ${senderName}`;
      const snippet = messageContent.length > 90 ? `${messageContent.substring(0, 90)}...` : messageContent;
      const notif = new Notification(title, {
        body: roomName ? `[${roomName}]: ${snippet}` : snippet,
        icon: '/pwa-192x192.png',
        tag: 'studyroom-new-msg',
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch {
      // Notification failed or blocked
    }
  }
}

function startFlashingTitle(roomName?: string) {
  if (titleInterval) return;
  isTitleFlashing = true;
  originalDocumentTitle = 'اتاق مطالعه StudyRoom';

  let toggle = false;
  titleInterval = window.setInterval(() => {
    if (!document.hidden) {
      clearFlashingTitle();
      return;
    }
    toggle = !toggle;
    document.title = toggle
      ? `💬 (${unreadMessageCount}) پیام جدید!`
      : roomName
      ? `📚 ${roomName}`
      : originalDocumentTitle;
  }, 1200);
}

export function clearFlashingTitle() {
  if (titleInterval) {
    clearInterval(titleInterval);
    titleInterval = null;
  }
  isTitleFlashing = false;
  unreadMessageCount = 0;
  if (typeof document !== 'undefined') {
    document.title = 'اتاق مطالعه StudyRoom';
  }
}

// Global listener to automatically clear unread notification counter when user switches back to tab
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      clearFlashingTitle();
    }
  });
  window.addEventListener('focus', () => {
    clearFlashingTitle();
  });
}
