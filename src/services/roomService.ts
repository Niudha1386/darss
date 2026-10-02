import { RoomData, ChatMessage, RoomMember } from '../types';
import { API_BASE_URL } from './apiConfig';

const LOCAL_STORAGE_KEY = 'studyroom_rooms_db';

export class RoomService {
  private getLocalRooms(): Record<string, RoomData> {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private saveLocalRoom(room: RoomData) {
    try {
      const rooms = this.getLocalRooms();
      rooms[room.id.toUpperCase()] = room;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(rooms));
    } catch {
      // ignore
    }
  }

  public async getRooms(): Promise<RoomData[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms`);
      if (res.ok) {
        const rooms: RoomData[] = await res.json();
        rooms.forEach((r) => this.saveLocalRoom(r));
        return rooms;
      } else {
        console.error(`getRooms HTTP error status: ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error('API getRooms error, using cached rooms', err);
    }

    // Fallback to cached rooms
    const local = this.getLocalRooms();
    return Object.values(local);
  }

  public async getRoom(roomId: string): Promise<RoomData | null> {
    if (!roomId) return null;
    const cleanId = roomId.trim().toUpperCase();

    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/${cleanId}`);
      if (res.ok) {
        const room: RoomData = await res.json();
        this.saveLocalRoom(room);
        return room;
      }
      if (res.status === 404) {
        return null;
      }
      console.error(`getRoom HTTP error for room ID ${cleanId}: status ${res.status}`);
    } catch (err) {
      console.error('Server fetch error for room ID:', cleanId, err);
    }

    return null;
  }

  public async createRoom(
    name: string,
    category: string,
    ownerName: string,
    ownerId: string
  ): Promise<RoomData> {
    const res = await fetch(`${API_BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name.trim(),
        category: category || 'عمومی',
        ownerName: ownerName.trim(),
        ownerId,
      }),
    });

    if (res.ok) {
      const room: RoomData = await res.json();
      this.saveLocalRoom(room);
      return room;
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'خطا در برقراری ارتباط با سرور برای ساخت اتاق');
  }

  public async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    try {
      const cleanId = roomId.trim().toUpperCase();
      const res = await fetch(`${API_BASE_URL}/api/rooms/${cleanId}/members`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  public async getRoomMessages(roomId: string): Promise<ChatMessage[]> {
    try {
      const cleanId = roomId.trim().toUpperCase();
      const res = await fetch(`${API_BASE_URL}/api/rooms/${cleanId}/messages`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }
}

export const roomService = new RoomService();
