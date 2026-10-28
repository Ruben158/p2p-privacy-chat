import { Platform } from 'react-native';
import { roomIdForPair } from './crypto';
import type {
  Contact,
  EncryptedEnvelope,
  LocalIdentity,
  NodeStatus,
} from './types';

const appId = 'org.p2pmessenger.direct.v1';
const actionName = 'p2p-messenger-encrypted-v1';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

type MessageAction = {
  send(
    message: EncryptedEnvelope,
    options?: { target?: string | string[] },
  ): Promise<unknown> | unknown;
  onMessage:
    | ((message: EncryptedEnvelope, context: { peerId: string }) => void)
    | null;
};

type RoomLike = {
  makeAction(name: string): MessageAction;
  onPeerJoin: ((peerId: string) => void) | null;
  onPeerLeave: ((peerId: string) => void) | null;
  leave(): Promise<unknown> | unknown;
};

type JoinRoomModule = {
  joinRoom(
    config: {
      appId: string;
      maxReceiveBytes: number;
      rtcConfig?: RTCConfiguration;
    },
    roomId: string,
    callbacks?: { onJoinError?: (event: { error?: unknown }) => void },
  ): RoomLike;
};

type Link = {
  room: RoomLike;
  action: MessageAction;
  peers: Set<string>;
  strategy: 'nostr' | 'torrent';
};

type Session = {
  contact: Contact;
  roomId: string;
  links: Link[];
  handshakeTimers: Array<ReturnType<typeof setTimeout>>;
  lastPacketAt: number;
};

export interface TransportCallbacks {
  onPeerAvailable(contactId: string): void;
  onHeartbeat(contactId: string, authenticated: boolean): void;
  onPacket(contactId: string, packet: EncryptedEnvelope): void | Promise<void>;
  onStatus(contactId: string, status: 'searching' | 'connected' | 'offline'): void;
  onNodeStatus?(status: NodeStatus): void;
  onError?(contactId: string, message: string): void;
}

export class P2PManager {
  private sessions = new Map<string, Session>();
  private authenticated = new Set<string>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reannounceInterval: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private cleanupListeners: (() => void) | null = null;

  constructor(
    private readonly identity: LocalIdentity,
    private readonly callbacks: TransportCallbacks,
  ) {}

  private isDeviceOnline(): boolean {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return true;
    return navigator.onLine !== false;
  }

  async start(contacts: Contact[]): Promise<void> {
    this.stopped = false;
    if (Platform.OS !== 'web') {
      this.callbacks.onNodeStatus?.('offline');
      for (const contact of contacts) {
        this.callbacks.onStatus(contact.id, 'offline');
        this.callbacks.onError?.(
          contact.id,
          'Direct P2P runs in the Capacitor Android app or a browser. This Expo native preview is not a WebRTC host.',
        );
      }
      return;
    }

    this.callbacks.onNodeStatus?.(this.isDeviceOnline() ? 'connecting' : 'offline');
    this.attachLifecycleListeners();
    await this.syncContacts(contacts);
    this.callbacks.onNodeStatus?.(this.isDeviceOnline() ? 'online' : 'offline');

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.stopped) return;
      if (!this.isDeviceOnline()) {
        this.callbacks.onNodeStatus?.('offline');
        return;
      }
      this.callbacks.onNodeStatus?.('online');
      const now = Date.now();
      for (const [contactId, session] of this.sessions.entries()) {
        const hasPeers = session.links.some((link) => link.peers.size > 0);
        if (hasPeers) {
          this.callbacks.onHeartbeat(
            contactId,
            this.authenticated.has(contactId),
          );
        } else if (
          this.authenticated.has(contactId) &&
          now - session.lastPacketAt > 25_000
        ) {
          this.authenticated.delete(contactId);
          this.callbacks.onStatus(
            contactId,
            this.isDeviceOnline() ? 'searching' : 'offline',
          );
        }
      }
    }, 5_000);

    if (this.reannounceInterval) clearInterval(this.reannounceInterval);
    this.reannounceInterval = setInterval(() => {
      if (this.stopped || !this.isDeviceOnline()) return;
      for (const [contactId, session] of this.sessions.entries()) {
        const hasPeers = session.links.some((link) => link.peers.size > 0);
        if (!hasPeers && !this.authenticated.has(contactId)) {
          void this.rejoinSession(contactId, session.contact);
        }
      }
    }, 40_000);
  }

  private attachLifecycleListeners(): void {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    this.cleanupListeners?.();

    const handleOnline = () => {
      if (this.stopped) return;
      this.callbacks.onNodeStatus?.('connecting');
      void this.reconnectAll();
    };

    const handleOffline = () => {
      if (this.stopped) return;
      this.callbacks.onNodeStatus?.('offline');
      for (const contactId of this.sessions.keys()) {
        this.authenticated.delete(contactId);
        this.callbacks.onStatus(contactId, 'offline');
      }
    };

    const handleVisibility = () => {
      if (this.stopped) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (this.isDeviceOnline()) {
          this.callbacks.onNodeStatus?.('online');
          for (const [contactId, session] of this.sessions.entries()) {
            const hasPeers = session.links.some((link) => link.peers.size > 0);
            if (hasPeers) {
              this.callbacks.onPeerAvailable(contactId);
            } else {
              void this.rejoinSession(contactId, session.contact);
            }
          }
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    this.cleanupListeners = () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }

  async syncContacts(contacts: Contact[]): Promise<void> {
    if (this.stopped || Platform.OS !== 'web') return;
    const nextIds = new Set(contacts.map((c) => c.id));

    for (const [existingId, session] of this.sessions.entries()) {
      if (!nextIds.has(existingId)) {
        await this.closeSession(session);
        this.sessions.delete(existingId);
        this.authenticated.delete(existingId);
      }
    }

    await Promise.all(
      contacts.map(async (contact) => {
        if (this.stopped) return;
        if (this.sessions.has(contact.id)) {
          const existing = this.sessions.get(contact.id)!;
          existing.contact = contact;
          return;
        }
        await this.openSession(contact);
      }),
    );
  }

  private async openSession(contact: Contact): Promise<void> {
    if (this.stopped) return;
    const online = this.isDeviceOnline();
    this.callbacks.onStatus(contact.id, online ? 'searching' : 'offline');
    const roomId = await roomIdForPair(this.identity, contact);
    const session: Session = {
      contact,
      roomId,
      links: [],
      handshakeTimers: [],
      lastPacketAt: 0,
    };
    this.sessions.set(contact.id, session);

    const strategies: Array<{
      name: 'nostr' | 'torrent';
      load: () => Promise<JoinRoomModule>;
    }> = [
      {
        name: 'nostr',
        load: async () => (await import('trystero')) as JoinRoomModule,
      },
      {
        name: 'torrent',
        load: async () =>
          (await import('@trystero-p2p/torrent')) as JoinRoomModule,
      },
    ];

    await Promise.all(
      strategies.map(async (strategy) => {
        try {
          const module = await strategy.load();
          if (this.stopped || this.sessions.get(contact.id) !== session) return;
          const room = module.joinRoom(
            {
              appId,
              maxReceiveBytes: 12 * 1024 * 1024,
              rtcConfig: RTC_CONFIG,
            },
            roomId,
            {
              onJoinError: ({ error }) => {
                this.callbacks.onError?.(
                  contact.id,
                  error instanceof Error
                    ? error.message
                    : 'The signaling connection could not be opened.',
                );
              },
            },
          );
          const action = room.makeAction(actionName);
          const link: Link = {
            room,
            action,
            peers: new Set<string>(),
            strategy: strategy.name,
          };
          session.links.push(link);

          action.onMessage = (packet) => {
            if (this.stopped || !packet || typeof packet !== 'object') return;
            session.lastPacketAt = Date.now();
            void Promise.resolve(this.callbacks.onPacket(contact.id, packet)).catch(
              (error: unknown) => {
                this.callbacks.onError?.(
                  contact.id,
                  error instanceof Error
                    ? error.message
                    : 'Could not process an encrypted message.',
                );
              },
            );
          };

          room.onPeerJoin = (peerId) => {
            if (this.stopped || this.sessions.get(contact.id) !== session) return;
            link.peers.add(peerId);
            if (!this.authenticated.has(contact.id)) {
              this.callbacks.onStatus(contact.id, 'searching');
            }
            this.scheduleHandshakeBurst(contact.id, session);
          };

          room.onPeerLeave = (peerId) => {
            link.peers.delete(peerId);
            const isAnyPeerConnected = session.links.some(
              (sessionLink) => sessionLink.peers.size > 0,
            );
            if (!isAnyPeerConnected) {
              this.authenticated.delete(contact.id);
              this.callbacks.onStatus(
                contact.id,
                this.isDeviceOnline() ? 'searching' : 'offline',
              );
            }
          };
        } catch (error) {
          if (!this.stopped) {
            this.callbacks.onError?.(
              contact.id,
              error instanceof Error
                ? error.message
                : `${strategy.name} discovery could not start.`,
            );
          }
        }
      }),
    );
  }

  private scheduleHandshakeBurst(contactId: string, session: Session): void {
    for (const timer of session.handshakeTimers) clearTimeout(timer);
    session.handshakeTimers = [];

    this.callbacks.onPeerAvailable(contactId);
    const delays = [300, 1000, 2400, 4800];
    for (const delay of delays) {
      const timer = setTimeout(() => {
        if (this.stopped || this.sessions.get(contactId) !== session) return;
        const hasPeers = session.links.some((l) => l.peers.size > 0);
        if (hasPeers) {
          this.callbacks.onPeerAvailable(contactId);
        }
      }, delay);
      session.handshakeTimers.push(timer);
    }
  }

  private async closeSession(session: Session): Promise<void> {
    for (const timer of session.handshakeTimers) clearTimeout(timer);
    session.handshakeTimers = [];
    const rooms = session.links.map((link) => link.room);
    session.links = [];
    await Promise.all(
      rooms.map(async (room) => {
        try {
          await room.leave();
        } catch {
          // Ignore room leave errors
        }
      }),
    );
  }

  private async rejoinSession(contactId: string, contact: Contact): Promise<void> {
    if (this.stopped) return;
    const existing = this.sessions.get(contactId);
    if (existing) {
      await this.closeSession(existing);
      this.sessions.delete(contactId);
    }
    this.authenticated.delete(contactId);
    await this.openSession(contact);
  }

  async reconnectAll(): Promise<void> {
    if (this.stopped || Platform.OS !== 'web') return;
    const online = this.isDeviceOnline();
    this.callbacks.onNodeStatus?.(online ? 'connecting' : 'offline');
    const contacts = Array.from(this.sessions.values()).map((s) => s.contact);
    for (const session of this.sessions.values()) {
      await this.closeSession(session);
    }
    this.sessions.clear();
    this.authenticated.clear();
    await Promise.all(contacts.map((contact) => this.openSession(contact)));
    this.callbacks.onNodeStatus?.(this.isDeviceOnline() ? 'online' : 'offline');
  }

  async nudgeContact(contactId: string): Promise<void> {
    if (this.stopped || Platform.OS !== 'web') return;
    const session = this.sessions.get(contactId);
    if (!session) return;
    const hasPeers = session.links.some((link) => link.peers.size > 0);
    if (hasPeers) {
      this.scheduleHandshakeBurst(contactId, session);
    } else {
      await this.rejoinSession(contactId, session.contact);
    }
  }

  markAuthenticated(contactId: string): void {
    this.authenticated.add(contactId);
    const session = this.sessions.get(contactId);
    if (session) {
      session.lastPacketAt = Date.now();
    }
    this.callbacks.onStatus(contactId, 'connected');
  }

  async send(contactId: string, packet: EncryptedEnvelope): Promise<boolean> {
    const session = this.sessions.get(contactId);
    if (!session) return false;
    let sent = false;
    await Promise.all(
      session.links.map(async (link) => {
        if (link.peers.size === 0) return;
        try {
          await link.action.send(packet, {
            target: Array.from(link.peers),
          });
          sent = true;
        } catch {
          // An unresponsive strategy remains available for the other path.
        }
      }),
    );
    return sent;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.cleanupListeners?.();
    this.cleanupListeners = null;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.reannounceInterval) {
      clearInterval(this.reannounceInterval);
      this.reannounceInterval = null;
    }
    this.authenticated.clear();
    const sessions = Array.from(this.sessions.values());
    this.sessions.clear();
    await Promise.all(sessions.map((session) => this.closeSession(session)));
  }
}
