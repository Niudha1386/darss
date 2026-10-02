export interface User {
  id: string;
  name: string;
  avatar: string;
  avatarBg: string;
  isOnline: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  role: 'host' | 'member';
  isVoiceActive?: boolean;
}

export interface Room {
  id: string;
  name: string;
  category?: string;
  createdAt: string;
  hostName: string;
  membersCount: number;
}

export interface RoomMember {
  id: string;
  name: string;
  joinedAt: string;
  isOnline: boolean;
  avatarBg: string;
  role: 'host' | 'member';
}

export interface RoomData {
  id: string;
  name: string;
  category?: string;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  members: RoomMember[];
}

export interface ReplyToInfo {
  id: string;
  senderName: string;
  content: string;
  isAI?: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderAvatarBg?: string;
  content: string;
  timestamp: string;
  createdAt?: string;
  isSelf: boolean;
  isAI?: boolean;
  replyTo?: ReplyToInfo;
  attachment?: {
    name: string;
    size: string;
    type: 'image' | 'file';
    url?: string;
  };
}

export type AIMode = 'simple' | 'complex';

export interface AIThinkingState {
  isThinking: boolean;
  question?: string;
  userName?: string;
  mode?: AIMode;
}

export interface AIMessage {
  id: string;
  roomId: string;
  type: 'user' | 'ai';
  sender: string;
  senderId?: string;
  senderAvatarBg?: string;
  message: string;
  image?: string;
  createdAt: string;
  sources?: string[];
  mode?: AIMode;
  isGenerating?: boolean;
  replyTo?: ReplyToInfo;
}

// Keep AIMessageItem as an alias or backward-compat representation
export type AIMessageItem = AIMessage;

export interface PamphletChunk {
  id: string;
  roomId: string;
  fileId: string;
  fileName: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  tokenCount?: number;
}

export interface PamphletFile {
  id: string;
  roomId: string;
  name: string;
  size: string;
  type: string;
  uploadedBy: string;
  createdAt: string;
  content?: string; // text excerpt or base64 data for AI comprehension
  pagesCount?: number;
  status?: 'processing' | 'ready' | 'error' | 'scanned_ocr_required';
  processedPages?: number;
  progressPercent?: number;
  error?: string;
  errorCode?: string;
  totalChunks?: number;
}

export interface LiveKitConfig {
  token: string;
  serverUrl: string;
  roomName: string;
}

export interface VoiceState {
  isCallActive: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  connectedAt?: string;
  activeSpeakers: string[];
  liveKitConfig?: LiveKitConfig | null;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
export type AppView = 'lobby' | 'room';
export type ModalType = 'none' | 'create-room' | 'join-room' | 'name-entry';

// WebSocket Protocol Types
export type WSClientMessage =
  | { type: 'join-room'; roomId: string; user: { id: string; name: string; avatarBg?: string } }
  | { type: 'leave-room'; roomId: string; userId: string }
  | { type: 'send-message'; roomId: string; message: { id: string; content: string; senderId: string; senderName: string; senderAvatarBg?: string; replyTo?: ReplyToInfo }; mode?: AIMode }
  | { type: 'ai-ask'; roomId: string; question: string; mode?: AIMode; user: { id: string; name: string; avatarBg?: string }; replyTo?: ReplyToInfo }
  | { type: 'voice-state-update'; roomId: string; userId: string; isSpeaking?: boolean; isMuted?: boolean; isCallActive: boolean }
  | { type: 'voice-signal'; roomId: string; senderId: string; targetUserId: string; signal: any }
  | { type: 'voice-audio-chunk'; roomId: string; userId: string; chunk: string; mimeType: string }
  | { type: 'ping' };

export type WSServerMessage =
  | {
      type: 'room-init';
      roomId: string;
      room: RoomData;
      messages: ChatMessage[];
      members: RoomMember[];
      aiMessages: AIMessage[];
      pamphlets: PamphletFile[];
      aiThinking?: AIThinkingState;
    }
  | { type: 'new-message'; roomId: string; message: ChatMessage }
  | { type: 'ai-message'; roomId: string; message: AIMessage }
  | { type: 'ai-history'; roomId: string; messages: AIMessage[] }
  | { type: 'ai-thinking'; roomId: string; isThinking: boolean; question?: string; userName?: string; mode?: AIMode }
  | { type: 'pamphlet-added'; roomId: string; pamphlet: PamphletFile }
  | { type: 'pamphlet-removed'; roomId: string; fileId: string }
  | {
      type: 'pamphlet-progress';
      roomId: string;
      fileId: string;
      fileName: string;
      status: 'processing' | 'ready' | 'error' | 'scanned_ocr_required';
      current: number;
      total: number;
      percent: number;
      error?: string;
      errorCode?: string;
    }
  | { type: 'presence-update'; roomId: string; members: RoomMember[] }
  | { type: 'user-joined'; roomId: string; member: RoomMember }
  | { type: 'user-left'; roomId: string; userId: string }
  | { type: 'voice-state-update'; roomId: string; userId: string; isSpeaking?: boolean; isMuted?: boolean; isCallActive: boolean }
  | { type: 'voice-signal'; roomId: string; senderId: string; targetUserId: string; signal: any }
  | { type: 'voice-audio-chunk'; roomId: string; userId: string; chunk: string; mimeType: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };
