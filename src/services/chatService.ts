import {
  ChatMessage,
  RoomData,
  RoomMember,
  ConnectionStatus,
  AIMessage,
  PamphletFile,
  AIMode,
  AIThinkingState,
  WSClientMessage,
  WSServerMessage,
  ReplyToInfo,
} from '../types';
import { API_BASE_URL, getWebSocketUrl } from './apiConfig';

type MessageHandler = (message: ChatMessage) => void;
type PresenceHandler = (members: RoomMember[]) => void;
type InitHandler = (data: {
  room: RoomData;
  messages: ChatMessage[];
  members: RoomMember[];
  aiMessages?: AIMessage[];
  pamphlets?: PamphletFile[];
  aiThinking?: AIThinkingState;
}) => void;
type AIMessageHandler = (message: AIMessage) => void;
type AIHistoryHandler = (messages: AIMessage[]) => void;
type AIThinkingHandler = (thinking: AIThinkingState) => void;
type PamphletHandler = (pamphlet: PamphletFile) => void;
type StatusHandler = (status: ConnectionStatus) => void;
type ErrorHandler = (error: string) => void;

class ChatService {
  private ws: WebSocket | null = null;
  private currentRoomId: string | null = null;
  private currentUser: { id: string; name: string; avatarBg?: string } | null = null;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: number | null = null;
  private pingInterval: number | null = null;
  private pollInterval: number | null = null;
  private intentionalDisconnect = false;
  private isWsHealthy = false;

  private cachedAIMsgCount = 0;
  private cachedLastAIMsgId = '';

  private messageListeners = new Set<MessageHandler>();
  private presenceListeners = new Set<PresenceHandler>();
  private initListeners = new Set<InitHandler>();
  private aiMessageListeners = new Set<AIMessageHandler>();
  private aiHistoryListeners = new Set<AIHistoryHandler>();
  private aiThinkingListeners = new Set<AIThinkingHandler>();
  private pamphletListeners = new Set<PamphletHandler>();
  private pamphletRemovedListeners = new Set<(fileId: string) => void>();
  private pamphletProgressListeners = new Set<(progress: {
    fileId: string;
    roomId: string;
    fileName: string;
    status: 'processing' | 'ready' | 'error' | 'scanned_ocr_required';
    current: number;
    total: number;
    percent: number;
    error?: string;
    errorCode?: string;
  }) => void>();
  private statusListeners = new Set<StatusHandler>();
  private errorListeners = new Set<ErrorHandler>();
  private voiceStateListeners = new Set<(data: { roomId: string; userId: string; isSpeaking?: boolean; isMuted?: boolean; isCallActive: boolean }) => void>();
  private voiceSignalListeners = new Set<(data: { roomId: string; senderId: string; targetUserId: string; signal: any }) => void>();
  private voiceAudioListeners = new Set<(data: { roomId: string; userId: string; chunk: string; mimeType: string }) => void>();

  private updateStatus(newStatus: ConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((fn) => fn(newStatus));
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public connectToRoom(roomId: string, user: { id: string; name: string; avatarBg?: string }) {
    const cleanRoomId = roomId.trim().toUpperCase();
    if (this.currentRoomId === cleanRoomId && this.currentUser?.id === user.id && (this.isWsHealthy || this.status === 'connected')) {
      return;
    }

    this.intentionalDisconnect = false;
    this.currentRoomId = cleanRoomId;
    this.currentUser = user;
    this.reconnectAttempts = 0;
    this.cachedAIMsgCount = 0;
    this.cachedLastAIMsgId = '';

    // Immediately fetch initial state via HTTP
    this.syncRoomStateHTTP(true);

    // Establish WebSocket connection
    this.establishConnection();

    // Start background HTTP sync as backup
    this.startHttpPolling();
  }

  private getWebSocketUrl(): string {
    if (typeof window === 'undefined') return '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  private async syncRoomStateHTTP(isInitial = false) {
    if (!this.currentRoomId || !this.currentUser) return;

    try {
      if (isInitial) {
        const joinRes = await fetch(`${API_BASE_URL}/api/rooms/${this.currentRoomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: this.currentUser }),
        });

        if (joinRes.ok) {
          const data = await joinRes.json();
          this.cachedAIMsgCount = data.aiMessages?.length || 0;
          this.cachedLastAIMsgId = data.aiMessages?.[data.aiMessages.length - 1]?.id || '';
          this.initListeners.forEach((fn) => fn(data));
          this.updateStatus('connected');
          return;
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/rooms/${this.currentRoomId}/sync-state`);
      if (res.ok) {
        const data = await res.json();
        if (isInitial) {
          this.cachedAIMsgCount = data.aiMessages?.length || 0;
          this.cachedLastAIMsgId = data.aiMessages?.[data.aiMessages.length - 1]?.id || '';
          this.initListeners.forEach((fn) => fn(data));
        } else {
          this.presenceListeners.forEach((fn) => fn(data.members));
          if (data.messages && Array.isArray(data.messages)) {
            data.messages.forEach((msg: ChatMessage) => {
              this.messageListeners.forEach((fn) => fn(msg));
            });
          }
          // Only emit AI history if new messages actually arrived (avoids resetting scroll position!)
          if (data.aiMessages && Array.isArray(data.aiMessages)) {
            const lastId = data.aiMessages[data.aiMessages.length - 1]?.id || '';
            if (data.aiMessages.length !== this.cachedAIMsgCount || lastId !== this.cachedLastAIMsgId) {
              this.cachedAIMsgCount = data.aiMessages.length;
              this.cachedLastAIMsgId = lastId;
              this.aiHistoryListeners.forEach((fn) => fn(data.aiMessages));
            }
          }
          if (data.pamphlets && Array.isArray(data.pamphlets)) {
            data.pamphlets.forEach((p: PamphletFile) => {
              this.pamphletListeners.forEach((fn) => fn(p));
            });
          }
        }
        this.updateStatus('connected');
      }
    } catch {
      // ignore network errors silently during polling
    }
  }

  private establishConnection() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    if (this.status !== 'connected') {
      this.updateStatus('connecting');
    }

    try {
      const url = this.getWebSocketUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isWsHealthy = true;
        this.reconnectAttempts = 0;
        this.updateStatus('connected');
        this.startHeartbeat();

        if (this.currentRoomId && this.currentUser) {
          const joinMsg: WSClientMessage = {
            type: 'join-room',
            roomId: this.currentRoomId,
            user: this.currentUser,
          };
          this.sendWS(joinMsg);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WSServerMessage = JSON.parse(event.data);

          if (data.type === 'pong') {
            return;
          }

          if (data.type === 'room-init') {
            if (data.roomId === this.currentRoomId) {
              this.cachedAIMsgCount = data.aiMessages?.length || 0;
              this.cachedLastAIMsgId = data.aiMessages?.[data.aiMessages.length - 1]?.id || '';
              this.initListeners.forEach((fn) =>
                fn({
                  room: data.room,
                  messages: data.messages,
                  members: data.members,
                  aiMessages: data.aiMessages,
                  pamphlets: data.pamphlets,
                  aiThinking: data.aiThinking,
                })
              );
            }
            return;
          }

          if (data.type === 'new-message') {
            if (data.roomId === this.currentRoomId) {
              this.messageListeners.forEach((fn) => fn(data.message));
            }
            return;
          }

          if (data.type === 'ai-message') {
            if (data.roomId === this.currentRoomId) {
              this.cachedAIMsgCount++;
              this.cachedLastAIMsgId = data.message.id;
              this.aiMessageListeners.forEach((fn) => fn(data.message));
            }
            return;
          }

          if (data.type === 'ai-history') {
            if (data.roomId === this.currentRoomId) {
              this.cachedAIMsgCount = data.messages.length;
              this.cachedLastAIMsgId = data.messages[data.messages.length - 1]?.id || '';
              this.aiHistoryListeners.forEach((fn) => fn(data.messages));
            }
            return;
          }

          if (data.type === 'ai-thinking') {
            if (data.roomId === this.currentRoomId) {
              this.aiThinkingListeners.forEach((fn) =>
                fn({
                  isThinking: data.isThinking,
                  question: data.question,
                  userName: data.userName,
                  mode: data.mode,
                })
              );
            }
            return;
          }

          if (data.type === 'pamphlet-added') {
            if (data.roomId === this.currentRoomId) {
              this.pamphletListeners.forEach((fn) => fn(data.pamphlet));
            }
            return;
          }

          if (data.type === 'pamphlet-progress') {
            if (data.roomId === this.currentRoomId) {
              this.pamphletProgressListeners.forEach((fn) => fn(data));
            }
            return;
          }

          if (data.type === 'pamphlet-removed') {
            if (data.roomId === this.currentRoomId) {
              this.pamphletRemovedListeners.forEach((fn) => fn(data.fileId));
            }
            return;
          }

          if (data.type === 'presence-update') {
            if (data.roomId === this.currentRoomId) {
              this.presenceListeners.forEach((fn) => fn(data.members));
            }
            return;
          }

          if (data.type === 'voice-state-update') {
            if (data.roomId === this.currentRoomId) {
              this.voiceStateListeners.forEach((fn) => fn(data));
            }
            return;
          }

          if (data.type === 'voice-audio-chunk') {
            if (data.roomId === this.currentRoomId) {
              this.voiceAudioListeners.forEach((fn) => fn(data));
            }
            return;
          }

          if (data.type === 'voice-signal') {
            if (data.roomId === this.currentRoomId) {
              this.voiceSignalListeners.forEach((fn) => fn(data));
            }
            return;
          }

          if (data.type === 'error') {
            this.errorListeners.forEach((fn) => fn(data.message));
            return;
          }
        } catch (err) {
          console.error('Failed to parse incoming WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        this.isWsHealthy = false;
        this.stopHeartbeat();
        if (!this.intentionalDisconnect && this.currentRoomId) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.isWsHealthy = false;
        this.stopHeartbeat();
      };
    } catch {
      this.isWsHealthy = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.intentionalDisconnect || !this.currentRoomId) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(2000 * this.reconnectAttempts, 10000);

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = window.setTimeout(() => {
        if (!this.intentionalDisconnect && this.currentRoomId) {
          this.establishConnection();
        }
      }, delay);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendWS({ type: 'ping' });
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private startHttpPolling() {
    this.stopHttpPolling();
    this.pollInterval = window.setInterval(() => {
      if (!this.intentionalDisconnect && this.currentRoomId) {
        this.syncRoomStateHTTP(false);
      }
    }, 3000);
  }

  private stopHttpPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  public sendMessage(content: string, mode: AIMode = 'simple', replyTo?: ReplyToInfo): boolean {
    const raw = content.trim();
    if (!raw || !this.currentRoomId || !this.currentUser) return false;

    const msgPayload = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      content: raw,
      senderId: this.currentUser.id,
      senderName: this.currentUser.name,
      senderAvatarBg: this.currentUser.avatarBg,
      replyTo,
    };

    let sentViaWs = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      sentViaWs = this.sendWS({
        type: 'send-message',
        roomId: this.currentRoomId,
        message: msgPayload,
        mode,
      });
    }

    if (!sentViaWs && this.currentRoomId) {
      fetch(`${API_BASE_URL}/api/rooms/${this.currentRoomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...msgPayload, mode }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((savedMsg: ChatMessage | null) => {
          if (savedMsg) {
            this.messageListeners.forEach((fn) => fn(savedMsg));
          }
        })
        .catch((err) => {
          console.warn('Failed to send message via HTTP REST:', err);
        });
    }

    return true;
  }

  /**
   * Secure AI Endpoint: POST /api/ai/chat
   * Supports both simple and complex (deep reasoning) modes
   */
  public async askAI(question: string, mode: AIMode = 'simple', replyTo?: ReplyToInfo): Promise<boolean> {
    const raw = question.trim();
    if (!raw || !this.currentRoomId || !this.currentUser) return false;

    const roomId = this.currentRoomId;
    const user = this.currentUser;

    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          message: raw,
          mode,
          userId: user.id,
          userName: user.name,
          replyTo,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.userMsg) this.aiMessageListeners.forEach((fn) => fn(data.userMsg));
        if (data.aiMsg) this.aiMessageListeners.forEach((fn) => fn(data.aiMsg));
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || 'دستیار هوشمند موقتاً در دسترس نیست. دوباره تلاش کن.';
        this.errorListeners.forEach((fn) => fn(errMsg));
        return false;
      }
    } catch {
      this.errorListeners.forEach((fn) =>
        fn('دستیار هوشمند موقتاً در دسترس نیست. دوباره تلاش کن.')
      );
      return false;
    }
  }

  /**
   * Secure Multimodal AI Endpoint: POST /api/ai/vision
   * Sends image + optional prompt to server-side Gemini safely
   */
  public async askAIVision(
    question: string,
    imageData: string,
    mimeType: string,
    mode: AIMode = 'simple',
    replyTo?: ReplyToInfo
  ): Promise<boolean> {
    const raw = question.trim();
    if (!this.currentRoomId || !this.currentUser || !imageData) return false;

    const roomId = this.currentRoomId;
    const user = this.currentUser;

    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/vision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          message: raw || 'لطفاً این تصویر (فرمول / مسئله / نمودار / صفحه درس) را تحلیل کن و پاسخ کامل بده.',
          image: imageData,
          mimeType: mimeType || 'image/jpeg',
          mode,
          userId: user.id,
          userName: user.name,
          replyTo,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.userMsg) this.aiMessageListeners.forEach((fn) => fn(data.userMsg));
        if (data.aiMsg) this.aiMessageListeners.forEach((fn) => fn(data.aiMsg));
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || 'دستیار هوشمند موقتاً در دسترس نیست. دوباره تلاش کن.';
        this.errorListeners.forEach((fn) => fn(errMsg));
        return false;
      }
    } catch {
      this.errorListeners.forEach((fn) =>
        fn('دستیار هوشمند موقتاً در دسترس نیست. دوباره تلاش کن.')
      );
      return false;
    }
  }

  /**
   * Safe AI Health Check: GET /api/ai/status
   */
  public async checkAIStatus(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/status`);
      if (res.ok) {
        const data = await res.json();
        return Boolean(data.available);
      }
    } catch {
      // ignore
    }
    return false;
  }

  public async uploadPamphlet(pamphletData: {
    name: string;
    size: string;
    type: string;
    content?: string;
  }): Promise<PamphletFile | null> {
    if (!this.currentRoomId || !this.currentUser) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/${this.currentRoomId}/pamphlets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pamphletData,
          uploadedBy: this.currentUser.name,
        }),
      });

      if (res.ok) {
        const created: PamphletFile = await res.json();
        this.pamphletListeners.forEach((fn) => fn(created));
        return created;
      }
    } catch (err) {
      console.error('Failed to upload pamphlet:', err);
    }
    return null;
  }

  public onPamphletProgress(
    fn: (progress: {
      fileId: string;
      roomId: string;
      fileName: string;
      status: 'processing' | 'ready' | 'error' | 'scanned_ocr_required';
      current: number;
      total: number;
      percent: number;
      error?: string;
      errorCode?: string;
    }) => void
  ): () => void {
    this.pamphletProgressListeners.add(fn);
    return () => this.pamphletProgressListeners.delete(fn);
  }

  public uploadPamphletFile(
    file: File,
    onProgress?: (progress: { loaded: number; total: number; percent: number; speedText: string }) => void
  ): Promise<PamphletFile | null> {
    if (!this.currentRoomId || !this.currentUser) return Promise.resolve(null);

    const roomId = this.currentRoomId;
    const userName = this.currentUser.name;

    // Use chunk size of 2MB (2 * 1024 * 1024)
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const uploadId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const chunkProgresses: { [index: number]: number } = {};
    const startTime = Date.now();

    const updateCombinedProgress = () => {
      if (!onProgress) return;
      let totalLoaded = 0;
      for (let i = 0; i < totalChunks; i++) {
        totalLoaded += chunkProgresses[i] || 0;
      }
      if (totalLoaded > totalSize) totalLoaded = totalSize;

      const percent = Math.min(99, Math.round((totalLoaded / totalSize) * 100));
      const elapsedSec = (Date.now() - startTime) / 1000;
      const speedBps = elapsedSec > 0 ? totalLoaded / elapsedSec : 0;
      const speedText =
        speedBps > 1024 * 1024
          ? `${(speedBps / (1024 * 1024)).toFixed(1)} مگابایت/ثانیه`
          : `${(speedBps / 1024).toFixed(0)} کیلوبایت/ثانیه`;

      onProgress({
        loaded: totalLoaded,
        total: totalSize,
        percent,
        speedText,
      });
    };

    // Single chunk upload logic using Promise
    const uploadChunk = (chunkIndex: number, chunkBlob: Blob): Promise<void> => {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 3;

        const attemptUpload = () => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              chunkProgresses[chunkIndex] = e.loaded;
              updateCombinedProgress();
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              chunkProgresses[chunkIndex] = chunkBlob.size;
              updateCombinedProgress();
              resolve();
            } else {
              handleFailure();
            }
          };

          xhr.onerror = () => {
            handleFailure();
          };

          const handleFailure = () => {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(attemptUpload, 1000);
            } else {
              reject(new Error(`خطا در آپلود بخش ${chunkIndex + 1} پس از ۳ تلاش`));
            }
          };

          const formData = new FormData();
          formData.append('file', chunkBlob, `chunk_${chunkIndex}`);
          formData.append('uploadId', uploadId);
          formData.append('chunkIndex', String(chunkIndex));

          xhr.open('POST', `${API_BASE_URL}/api/rooms/${roomId}/pamphlets/upload-chunk`);
          xhr.send(formData);
        };

        attemptUpload();
      });
    };

    return new Promise(async (resolve, reject) => {
      try {
        const queue: Array<{ index: number; blob: Blob }> = [];
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, totalSize);
          const chunkBlob = file.slice(start, end);
          queue.push({ index: i, blob: chunkBlob });
          chunkProgresses[i] = 0;
        }

        // Limit concurrency to 4 parallel HTTP streams
        const CONCURRENCY = 4;
        const activeUploads: Array<Promise<void>> = [];

        const runNext = (): Promise<void> => {
          if (queue.length === 0) return Promise.resolve();
          const item = queue.shift()!;
          const uploadPromise = uploadChunk(item.index, item.blob).then(() => {
            // Remove ourselves from active set and start next
            const idx = activeUploads.indexOf(uploadPromise);
            if (idx >= 0) activeUploads.splice(idx, 1);
          });
          activeUploads.push(uploadPromise);

          // Return after launching next chunk
          let chainPromise: Promise<void> = uploadPromise;
          if (queue.length > 0) {
            chainPromise = uploadPromise.then(() => runNext());
          }
          return chainPromise;
        };

        // Launch up to CONCURRENCY items
        const initialPromises: Array<Promise<void>> = [];
        const itemsToLaunch = Math.min(CONCURRENCY, queue.length);
        for (let i = 0; i < itemsToLaunch; i++) {
          initialPromises.push(runNext());
        }

        // Wait for all chunks to finish uploading
        await Promise.all(initialPromises);

        // All chunks successfully uploaded! Now request assembly
        if (onProgress) {
          onProgress({
            loaded: totalSize,
            total: totalSize,
            percent: 99,
            speedText: 'در حال سرهم‌بندی...',
          });
        }

        const assembleRes = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/pamphlets/assemble`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uploadId,
            fileName: file.name,
            fileSize: totalSize,
            fileType: file.name.split('.').pop()?.toUpperCase() || 'PDF',
            totalChunks,
            uploadedBy: userName,
          }),
        });

        if (assembleRes.ok) {
          const created: PamphletFile = await assembleRes.json();
          this.pamphletListeners.forEach((fn) => fn(created));
          if (onProgress) {
            onProgress({
              loaded: totalSize,
              total: totalSize,
              percent: 100,
              speedText: 'تکمیل شد',
            });
          }
          resolve(created);
        } else {
          const errData = await assembleRes.json().catch(() => ({}));
          reject(new Error(errData.error || 'خطا در سرهم‌بندی قطعات جزوه'));
        }
      } catch (err: any) {
        reject(err);
      }
    });
  }

  private async uploadPamphletFallback(file: File): Promise<PamphletFile | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
      const formattedSize =
        file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(0)} کیلوبایت`
          : `${(file.size / (1024 * 1024)).toFixed(1)} مگابایت`;

      reader.onload = async () => {
        const content = reader.result as string;
        const res = await this.uploadPamphlet({
          name: file.name,
          size: formattedSize,
          type: ext,
          content,
        });
        resolve(res);
      };
      reader.onerror = () => resolve(null);

      if (file.type.includes('text') || file.name.endsWith('.txt')) {
        reader.readAsText(file, 'utf-8');
      } else {
        reader.readAsDataURL(file);
      }
    });
  }

  private sendWS(msg: WSClientMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  public leaveRoom() {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.stopHttpPolling();

    if (this.ws && this.currentRoomId && this.currentUser) {
      this.sendWS({
        type: 'leave-room',
        roomId: this.currentRoomId,
        userId: this.currentUser.id,
      });
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }

    this.ws = null;
    this.currentRoomId = null;
    this.currentUser = null;
    this.updateStatus('disconnected');
  }

  // Subscription methods
  public onInit(listener: InitHandler) {
    this.initListeners.add(listener);
    return () => this.initListeners.delete(listener);
  }

  public onNewMessage(listener: MessageHandler) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onAIMessage(listener: AIMessageHandler) {
    this.aiMessageListeners.add(listener);
    return () => this.aiMessageListeners.delete(listener);
  }

  public onAIHistory(listener: AIHistoryHandler) {
    this.aiHistoryListeners.add(listener);
    return () => this.aiHistoryListeners.delete(listener);
  }

  public onAIThinking(listener: AIThinkingHandler) {
    this.aiThinkingListeners.add(listener);
    return () => this.aiThinkingListeners.delete(listener);
  }

  public onPamphletAdded(listener: PamphletHandler) {
    this.pamphletListeners.add(listener);
    return () => this.pamphletListeners.delete(listener);
  }

  public onPamphletRemoved(listener: (fileId: string) => void) {
    this.pamphletRemovedListeners.add(listener);
    return () => this.pamphletRemovedListeners.delete(listener);
  }

  public onPresenceUpdate(listener: PresenceHandler) {
    this.presenceListeners.add(listener);
    return () => this.presenceListeners.delete(listener);
  }

  public onStatusChange(listener: StatusHandler) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  public onError(listener: ErrorHandler) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  public sendVoiceStateUpdate(roomId: string, userId: string, isCallActive: boolean, isMuted?: boolean, isSpeaking?: boolean) {
    this.sendWS({
      type: 'voice-state-update',
      roomId,
      userId,
      isCallActive,
      isMuted,
      isSpeaking,
    });
  }

  public sendVoiceSignal(roomId: string, senderId: string, targetUserId: string, signal: any) {
    this.sendWS({
      type: 'voice-signal',
      roomId,
      senderId,
      targetUserId,
      signal,
    });
  }

  public onVoiceStateUpdate(fn: (data: { roomId: string; userId: string; isSpeaking?: boolean; isMuted?: boolean; isCallActive: boolean }) => void) {
    this.voiceStateListeners.add(fn);
    return () => this.voiceStateListeners.delete(fn);
  }

  public onVoiceSignal(fn: (data: { roomId: string; senderId: string; targetUserId: string; signal: any }) => void) {
    this.voiceSignalListeners.add(fn);
    return () => this.voiceSignalListeners.delete(fn);
  }

  public sendVoiceAudioChunk(roomId: string, userId: string, chunk: string, mimeType: string) {
    this.sendWS({
      type: 'voice-audio-chunk',
      roomId,
      userId,
      chunk,
      mimeType,
    });
  }

  public onVoiceAudioChunk(fn: (data: { roomId: string; userId: string; chunk: string; mimeType: string }) => void) {
    this.voiceAudioListeners.add(fn);
    return () => this.voiceAudioListeners.delete(fn);
  }

  public sendLeaveDirect(roomId: string, userId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'leave-room', roomId, userId }));
      } catch {}
    }
  }
}

export const chatService = new ChatService();
