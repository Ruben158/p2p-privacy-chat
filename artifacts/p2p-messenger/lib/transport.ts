import { Platform } from 'react-native';
import { roomIdForPair } from './crypto';
import type {
  Contact,
  EncryptedEnvelope,
  LocalIdentity,
  NodeStatus,
} from './types';

const appId = 'org.p2pmessenger.direct.v1';
// CRITICAL: Trystero enforces a strict 12-byte max length on action names!
const actionName = 'p2p-msg-v1';

const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.wine',
  'wss://relay.nostr.band',
];

const TORRENT_TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.files.fm:7073/announce',
  'wss://tracker.btorrent.xyz',
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

type NormalizedAction = {
  send: (packet: EncryptedEnvelope, peers?: string[]) => Promise<void>;
  setOnMessage: (
    handler: (packet: EncryptedEnvelope, peerId?: string) => void,
  ) => void;
};

type RawRoom = {
  makeAction: (name: string) => unknown;
  onPeerJoin?: ((peerId: string) => void) | null;
  onPeerLeave?: ((peerId: string) => void) | null;
  getPeers?: () => Record<string, RTCPeerConnection> | string[];
  leave: () => Promise<unknown> | unknown;
};

type Link = {
  room: RawRoom;
  action: NormalizedAction;
  peers: Set<string>;
  strategy: string;
};

type Session = {
  contact: Contact;
  roomId: string;
  links: Link[];
  handshakeTimers: Array<ReturnType<typeof setTimeout>>;
  lastPacketAt: number;
  openedAt: number;
};

function normalizeRoomAction(rawAction: unknown): NormalizedAction {
  // Case 1: Standard Trystero tuple [sendFn, receiveFn, onProgressFn]
  if (Array.isArray(rawAction) && typeof rawAction[0] === 'function') {
    const sendFn = rawAction[0] as (
      data: EncryptedEnvelope,
      targetPeers?: string[] | string | null,
    ) => Promise<unknown> | unknown;
    const receiveFn = rawAction[1] as (
      cb: (data: EncryptedEnvelope, peerId: string) => void,
    ) => void;

    return {
      send: async (packet, peers) => {
        if (peers && peers.length > 0) {
          await Promise.resolve(sendFn(packet, peers));
        } else {
          await Promise.resolve(sendFn(packet));
        }
      },
      setOnMessage: (handler) => {
        if (typeof receiveFn === 'function') {
          receiveFn((data, peerId) => handler(data, peerId));
        }
      },
    };
  }

  // Case 2: Object-style action { send, onMessage }
  const objAction = rawAction as {
    send?: (
      data: EncryptedEnvelope,
      options?: unknown,
    ) => Promise<unknown> | unknown;
    onMessage?:
      | ((data: EncryptedEnvelope, context?: { peerId?: string }) => void)
      | null;
  };

  return {
    send: async (packet, peers) => {
      if (typeof objAction?.send !== 'function') return;
      try {
        // Send to all peers in the private 1-to-1 room
        await Promise.resolve(objAction.send(packet));
      } catch {
        if (peers && peers.length > 0) {
          await Promise.resolve(objAction.send(packet, { target: peers }));
        }
      }
    },
    setOnMessage: (handler) => {
      if (objAction && typeof objAction === 'object') {
        objAction.onMessage = (data, ctx) => handler(data, ctx?.peerId);
      }
    },
  };
}

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
        this.syncRoomPeers(session);
        const hasPeers = session.links.some((link) => link.peers.size > 0);
        if (hasPeers || this.authenticated.has(contactId)) {
          this.callbacks.onHeartbeat(
            contactId,
            this.authenticated.has(contactId),
          );
        }
        if (
          !hasPeers &&
          this.authenticated.has(contactId) &&
          now - session.lastPacketAt > 35_000
        ) {
          this.authenticated.delete(contactId);
          this.callbacks.onStatus(
            contactId,
            this.isDeviceOnline() ? 'searching' : 'offline',
          );
        }
      }
    }, 4_000);

    if (this.reannounceInterval) clearInterval(this.reannounceInterval);
    this.reannounceInterval = setInterval(() => {
      if (this.stopped || !this.isDeviceOnline()) return;
      const now = Date.now();
      for (const [contactId, session] of this.sessions.entries()) {
        this.syncRoomPeers(session);
        const hasPeers = session.links.some((link) => link.peers.size > 0);
        if (hasPeers) {
          this.callbacks.onPeerAvailable(contactId);
        } else if (
          !this.authenticated.has(contactId) &&
          now - session.openedAt > 90_000
        ) {
          void this.rejoinSession(contactId, session.contact);
        }
      }
    }, 30_000);
  }

  private syncRoomPeers(session: Session): void {
    for (const link of session.links) {
      if (typeof link.room.getPeers === 'function') {
        try {
          const rawPeers = link.room.getPeers();
          if (Array.isArray(rawPeers)) {
            rawPeers.forEach((p) => link.peers.add(p));
          } else if (rawPeers && typeof rawPeers === 'object') {
            Object.keys(rawPeers).forEach((p) => link.peers.add(p));
          }
        } catch {
          // Ignore getPeers errors
        }
      }
    }
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
            this.syncRoomPeers(session);
            this.scheduleHandshakeBurst(contactId, session);
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
      openedAt: Date.now(),
    };
    this.sessions.set(contact.id, session);

    const strategies: Array<{
      name: string;
      relayUrls: string[];
      load: () => Promise<{ joinRoom: (...args: unknown[]) => RawRoom }>;
    }> = [
      {
        name: 'nostr',
        relayUrls: NOSTR_RELAYS,
        load: async () =>
          (await import('trystero')) as unknown as {
            joinRoom: (...args: unknown[]) => RawRoom;
          },
      },
      {
        name: 'torrent',
        relayUrls: TORRENT_TRACKERS,
        load: async () =>
          (await import('@trystero-p2p/torrent')) as unknown as {
            joinRoom: (...args: unknown[]) => RawRoom;
          },
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
              relayUrls: strategy.relayUrls,
              maxReceiveBytes: 12 * 1024 * 1024,
              rtcConfig: RTC_CONFIG,
            },
            roomId,
          );

          const rawAction = room.makeAction(actionName);
          const action = normalizeRoomAction(rawAction);
          const link: Link = {
            room,
            action,
            peers: new Set<string>(),
            strategy: strategy.name,
          };
          session.links.push(link);

          action.setOnMessage((packet, peerId) => {
            if (this.stopped || !packet || typeof packet !== 'object') return;
            if (peerId) link.peers.add(peerId);
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
          });

          const handlePeerJoin = (peerId: string) => {
            if (this.stopped || this.sessions.get(contact.id) !== session) return;
            if (peerId) link.peers.add(peerId);
            this.scheduleHandshakeBurst(contact.id, session);
          };

          const handlePeerLeave = (peerId: string) => {
            if (peerId) link.peers.delete(peerId);
            this.syncRoomPeers(session);
            const isAnyPeerConnected = session.links.some(
              (sessionLink) => sessionLink.peers.size > 0,
            );
            if (
              !isAnyPeerConnected &&
              Date.now() - session.lastPacketAt > 15_000
            ) {
              this.authenticated.delete(contact.id);
              this.callbacks.onStatus(
                contact.id,
                this.isDeviceOnline() ? 'searching' : 'offline',
              );
            }
          };

          if (typeof room.onPeerJoin === 'function') {
            try {
              (room.onPeerJoin as unknown as (cb: (id: string) => void) => void)(
                handlePeerJoin,
              );
            } catch {
              room.onPeerJoin = handlePeerJoin;
            }
          } else {
            room.onPeerJoin = handlePeerJoin;
          }

          if (typeof room.onPeerLeave === 'function') {
            try {
              (room.onPeerLeave as unknown as (cb: (id: string) => void) => void)(
                handlePeerLeave,
              );
            } catch {
              room.onPeerLeave = handlePeerLeave;
            }
          } else {
            room.onPeerLeave = handlePeerLeave;
          }

          // Immediately trigger a handshake attempt in case peers are already present
          this.scheduleHandshakeBurst(contact.id, session);
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
    const delays = [250, 800, 1800, 3500, 6500];
    for (const delay of delays) {
      const timer = setTimeout(() => {
        if (this.stopped || this.sessions.get(contactId) !== session) return;
        this.syncRoomPeers(session);
        this.callbacks.onPeerAvailable(contactId);
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
    this.syncRoomPeers(session);
    const hasPeers = session.links.some((link) => link.peers.size > 0);
    if (hasPeers || this.authenticated.has(contactId)) {
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
    if (!session || session.links.length === 0) return false;
    this.syncRoomPeers(session);
    let sent = false;
    await Promise.all(
      session.links.map(async (link) => {
        try {
          const targets =
            link.peers.size > 0 ? Array.from(link.peers) : undefined;
          await link.action.send(packet, targets);
          sent = true;
        } catch {
          // Try remaining links
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
