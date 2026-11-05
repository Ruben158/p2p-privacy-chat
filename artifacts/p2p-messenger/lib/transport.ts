import { Platform } from 'react-native';
import { roomIdForPair } from './crypto';
import type {
  Contact,
  EncryptedEnvelope,
  LocalIdentity,
  NodeStatus,
} from './types';

const appId = 'org.p2pmessenger.direct.v1';
const actionName = 'p2p-msg-v1';
const MAX_CHUNK_CHARS = 12_000;

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

type ChunkFrame = {
  __chunk: true;
  id: string;
  idx: number;
  total: number;
  part: string;
};

type WirePacket = EncryptedEnvelope | ChunkFrame;

type NormalizedAction = {
  send: (packet: WirePacket, peers?: string[]) => Promise<void>;
  setOnMessage: (
    handler: (packet: WirePacket, peerId?: string) => void,
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
  if (Array.isArray(rawAction) && typeof rawAction[0] === 'function') {
    const sendFn = rawAction[0] as (
      data: WirePacket,
      targetPeers?: string[] | string | null,
    ) => Promise<unknown> | unknown;
    const receiveFn = rawAction[1] as (
      cb: (data: WirePacket, peerId: string) => void,
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

  const objAction = rawAction as {
    send?: (
      data: WirePacket,
      options?: unknown,
    ) => Promise<unknown> | unknown;
    onMessage?:
      | ((data: WirePacket, context?: { peerId?: string }) => void)
      | null;
  };

  return {
    send: async (packet, peers) => {
      if (typeof objAction?.send !== 'function') return;
      try {
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
  private incomingChunks = new Map<
    string,
    { parts: string[]; received: number; total: number; createdAt: number }
  >();
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
      for (const [k, v] of this.incomingChunks.entries()) {
        if (now - v.createdAt > 180_000) this.incomingChunks.delete(k);
      }
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
    }, 2_500);

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
          now - session.openedAt > 45_000
        ) {
          void this.rejoinSession(contactId, session.contact);
        }
      }
    }, 15_000);
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
      if (this.isDeviceOnline()) {
        this.callbacks.onNodeStatus?.('online');
        for (const [contactId, session] of this.sessions.entries()) {
          this.syncRoomPeers(session);
          this.scheduleHandshakeBurst(contactId, session);
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

  private handleIncomingWirePacket(
    contactId: string,
    session: Session,
    wire: WirePacket,
  ): void {
    if ('__chunk' in wire && wire.__chunk === true) {
      const key = `${contactId}:${wire.id}`;
      let entry = this.incomingChunks.get(key);
      if (!entry) {
        entry = {
          parts: new Array(wire.total).fill(''),
          received: 0,
          total: wire.total,
          createdAt: Date.now(),
        };
        this.incomingChunks.set(key, entry);
      }
      if (wire.idx >= 0 && wire.idx < entry.total && !entry.parts[wire.idx]) {
        entry.parts[wire.idx] = wire.part;
        entry.received += 1;
      }
      if (entry.received >= entry.total) {
        this.incomingChunks.delete(key);
        try {
          const fullJson = entry.parts.join('');
          const parsed = JSON.parse(fullJson) as EncryptedEnvelope;
          void Promise.resolve(this.callbacks.onPacket(contactId, parsed)).catch(
            () => undefined,
          );
        } catch {
          // Ignore malformed chunk assembly
        }
      }
      return;
    }

    void Promise.resolve(
      this.callbacks.onPacket(contactId, wire as EncryptedEnvelope),
    ).catch((error: unknown) => {
      this.callbacks.onError?.(
        contactId,
        error instanceof Error
          ? error.message
          : 'Could not process an encrypted message.',
      );
    });
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
              maxReceiveBytes: 25 * 1024 * 1024,
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
            this.handleIncomingWirePacket(contact.id, session, packet);
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
    const delays = [150, 500, 1200, 2500, 5000];
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

    const serialized = JSON.stringify(packet);
    const needsChunking = serialized.length > MAX_CHUNK_CHARS;
    const chunkId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const chunks: string[] = [];
    if (needsChunking) {
      for (let i = 0; i < serialized.length; i += MAX_CHUNK_CHARS) {
        chunks.push(serialized.slice(i, i + MAX_CHUNK_CHARS));
      }
    }

    let sent = false;
    await Promise.all(
      session.links.map(async (link) => {
        try {
          const targets =
            link.peers.size > 0 ? Array.from(link.peers) : undefined;
          if (!needsChunking) {
            await link.action.send(packet, targets);
          } else {
            for (let idx = 0; idx < chunks.length; idx++) {
              await link.action.send(
                {
                  __chunk: true,
                  id: chunkId,
                  idx,
                  total: chunks.length,
                  part: chunks[idx],
                },
                targets,
              );
              if (idx % 3 === 2) {
                await new Promise((r) => setTimeout(r, 4));
              }
            }
          }
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
