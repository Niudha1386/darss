import React, { useEffect, useCallback } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useConnectionState,
  useRoomContext,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { useStudyRoom } from '../../context/StudyRoomContext';

interface LiveKitVoiceManagerProps {
  children: React.ReactNode;
}

export interface LiveKitDebugInfo {
  connectionState: string;
  roomName: string;
  isConnected: boolean;
  isReconnecting: boolean;
  activeSpeakers: string[];
  localPublished: boolean;
  localMuted: boolean;
  participantCount: number;
  participants: Array<{
    identity: string;
    name: string;
    isSpeaking: boolean;
    isMuted: boolean;
    isLocal: boolean;
  }>;
}

export const LiveKitVoiceManager: React.FC<LiveKitVoiceManagerProps> = ({ children }) => {
  const { voiceState, toggleVoiceCall } = useStudyRoom();
  const config = voiceState.liveKitConfig;

  if (!config || !voiceState.isCallActive || config.serverUrl.startsWith('builtin://')) {
    return <>{children}</>;
  }

  return (
    <LiveKitRoom
      token={config.token}
      serverUrl={config.serverUrl}
      connect={true}
      audio={!voiceState.isMuted}
      video={false}
      onDisconnected={() => {
        console.log('[LiveKit] Disconnected from SFU');
        if (voiceState.isCallActive) {
          toggleVoiceCall();
        }
      }}
      onError={(err) => {
        console.error('[LiveKit SFU Error]', err);
      }}
    >
      {/* Official LiveKit Audio Renderer for all remote participant tracks */}
      <RoomAudioRenderer />

      {/* Internal Bridge syncing LiveKit state with StudyRoom */}
      <LiveKitInternalBridge />

      {children}
    </LiveKitRoom>
  );
};

// Internal bridge that runs inside <LiveKitRoom> context
export const LiveKitInternalBridge: React.FC = () => {
  const { voiceState, updateLiveKitState, setVoiceMuteHandler } = useStudyRoom();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const connectionState = useConnectionState();
  const room = useRoomContext();

  // Register mute toggle handler with context
  useEffect(() => {
    if (!localParticipant) return;

    setVoiceMuteHandler(async (shouldMute: boolean) => {
      try {
        await localParticipant.setMicrophoneEnabled(!shouldMute);
        console.log(`[LiveKit] Microphone set to ${shouldMute ? 'MUTED' : 'ACTIVE'}`);
      } catch (err) {
        console.error('[LiveKit] Failed to toggle microphone:', err);
      }
    });

    return () => {
      setVoiceMuteHandler(null);
    };
  }, [localParticipant, setVoiceMuteHandler]);

  // Sync mute state if changed from outside
  useEffect(() => {
    if (localParticipant) {
      const isCurrentlyEnabled = localParticipant.isMicrophoneEnabled;
      const shouldBeEnabled = !voiceState.isMuted;
      if (isCurrentlyEnabled !== shouldBeEnabled) {
        localParticipant.setMicrophoneEnabled(shouldBeEnabled).catch((err) => {
          console.warn('[LiveKit] Mic sync warning:', err);
        });
      }
    }
  }, [localParticipant, voiceState.isMuted]);

  // Sync participants and debug info to StudyRoomContext
  useEffect(() => {
    const activeSpeakers = participants
      .filter((p) => p.isSpeaking)
      .map((p) => p.identity);

    const participantList = participants.map((p) => ({
      identity: p.identity,
      name: p.name || p.identity,
      isSpeaking: p.isSpeaking,
      isMuted: !p.isMicrophoneEnabled,
      isLocal: p.isLocal,
    }));

    const isConnected = connectionState === ConnectionState.Connected;
    const isReconnecting = connectionState === ConnectionState.Reconnecting;

    updateLiveKitState({
      connectionState,
      isConnected,
      isReconnecting,
      activeSpeakers,
      participants: participantList,
      roomName: room.name,
      localPublished: Boolean(localParticipant && localParticipant.isMicrophoneEnabled),
      localMuted: Boolean(localParticipant && !localParticipant.isMicrophoneEnabled),
      participantCount: participants.length,
    });
  }, [participants, connectionState, room.name, updateLiveKitState]);

  return null;
};
