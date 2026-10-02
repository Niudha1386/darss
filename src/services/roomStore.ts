import { RoomData, RoomMember } from '../types';

const STORAGE_KEY = 'studyroom_rooms_db';
const CHANNEL_NAME = 'studyroom_sync_channel';

// Pre-seeded rooms so user can test existing links immediately
const defaultRooms: Record<string, RoomData> = {
  ABC123: {
    id: 'ABC123',
    name: 'آمادگی امتحان حسابداری',
    category: 'حسابداری و مدیریت',
    createdAt: '۱۰:۰۰',
    ownerId: 'user-host-1',
    ownerName: 'سارا احمدی',
    members: [
      {
        id: 'user-host-1',
        name: 'سارا احمدی',
        joinedAt: '۱۰:۰۰',
        isOnline: true,
        avatarBg: 'from-emerald-500 to-teal-600',
        role: 'host',
      },
      {
        id: 'user-member-2',
        name: 'رضا محمدی',
        joinedAt: '۱۰:۰۵',
        isOnline: true,
        avatarBg: 'from-amber-500 to-orange-600',
        role: 'member',
      },
      {
        id: 'user-member-3',
        name: 'مینا کاظمی',
        joinedAt: '۱۰:۱۲',
        isOnline: false,
        avatarBg: 'from-pink-500 to-rose-600',
        role: 'member',
      },
    ],
  },
  MATH101: {
    id: 'MATH101',
    name: 'آمادگی کنکور - ریاضی تجربی',
    category: 'ریاضیات',
    createdAt: '۰۹:۳۰',
    ownerId: 'user-host-2',
    ownerName: 'علی رضایی',
    members: [
      {
        id: 'user-host-2',
        name: 'علی رضایی',
        joinedAt: '۰۹:۳۰',
        isOnline: true,
        avatarBg: 'from-indigo-500 to-purple-600',
        role: 'host',
      },
    ],
  },
};

// Colors for avatars
const avatarGradients = [
  'from-indigo-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-pink-500 to-rose-600',
  'from-sky-500 to-indigo-600',
  'from-violet-500 to-fuchsia-600',
];

class RoomStore {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initStorage();
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        if (event.data === 'SYNC') {
          this.notifyListeners();
        }
      };
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.notifyListeners();
        }
      });
    }
  }

  private initStorage() {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (!existing) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultRooms));
      }
    } catch {
      // Fallback
    }
  }

  private getAllRooms(): Record<string, RoomData> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return defaultRooms;
      return JSON.parse(data);
    } catch {
      return defaultRooms;
    }
  }

  private saveRooms(rooms: Record<string, RoomData>) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
      this.broadcast();
      this.notifyListeners();
    } catch {
      // Ignore write errors
    }
  }

  private broadcast() {
    if (this.channel) {
      this.channel.postMessage('SYNC');
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  public generateUniqueRoomId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    const rooms = this.getAllRooms();

    do {
      id = '';
      for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (rooms[id]);

    return id;
  }

  public getRoom(roomId: string): RoomData | null {
    if (!roomId) return null;
    const rooms = this.getAllRooms();
    const normalized = roomId.trim().toUpperCase();
    return rooms[normalized] || rooms[roomId] || null;
  }

  public createRoom(
    roomName: string,
    category: string = 'عمومی',
    ownerName: string,
    ownerId: string
  ): RoomData {
    const roomId = this.generateUniqueRoomId();
    const rooms = this.getAllRooms();

    const hostMember: RoomMember = {
      id: ownerId,
      name: ownerName,
      joinedAt: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      isOnline: true,
      avatarBg: avatarGradients[0],
      role: 'host',
    };

    const newRoom: RoomData = {
      id: roomId,
      name: roomName,
      category,
      createdAt: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      ownerId,
      ownerName,
      members: [hostMember],
    };

    rooms[roomId] = newRoom;
    this.saveRooms(rooms);
    return newRoom;
  }

  public addMemberToRoom(
    roomId: string,
    user: { id: string; name: string }
  ): RoomData | null {
    const rooms = this.getAllRooms();
    const normalized = roomId.trim().toUpperCase();
    const roomKey = rooms[normalized] ? normalized : roomId;
    const room = rooms[roomKey];

    if (!room) return null;

    // Check if member already exists in room
    const existingIndex = room.members.findIndex(
      (m) => m.id === user.id || m.name.toLowerCase() === user.name.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Update member to online and update name
      room.members[existingIndex].isOnline = true;
      room.members[existingIndex].name = user.name;
    } else {
      // Add new member
      const newMember: RoomMember = {
        id: user.id,
        name: user.name,
        joinedAt: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        isOnline: true,
        avatarBg: avatarGradients[room.members.length % avatarGradients.length],
        role: 'member',
      };
      room.members.push(newMember);
    }

    rooms[roomKey] = room;
    this.saveRooms(rooms);
    return room;
  }
}

export const roomStore = new RoomStore();
