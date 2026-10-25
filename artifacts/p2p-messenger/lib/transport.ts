import { Platform } from 'react-native';
import { roomIdForPair } from './crypto';
import type {
  Contact,
  EncryptedEnvelope,
  LocalIdentity,
} from './types';

const appId = 'org.p2pmessenger.direct.v1';
const actionName = 'p2p-messenger-encrypted-v1';

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
  links: Link[];
};

export interface TransportCallbacks {
  onPeerAvailable(contactId: string): void;
  onPacket(contactId: string, packet: EncryptedEnvelope): void | Promise<void>;
  onStatus(contactId: string, status: 'searching' | 'offline'): void;
  onError?(contactId: string, message: string): void;
}

export class P2PManager {
  private sessions = new Map<string, Session>();
  private authenticated = new Set<string>();
  private searchTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private stopped = false;

  constructor(
    private readonly identity: LocalIdentity,
    private readonly callbacks: TransportCallbacks,
  ) {}

  async start(contacts: Contact[]): Promise<void> {
    this.stopped = false;
    if (Platform.OS !== 'web') {
      for (const contact of contacts) {
        this.callbacks.onStatus(contact.id, 'offline');
        this.callbacks.onError?.(
          contact.id,
          'Direct P2P runs in the Capacitor Android app or a browser. This Expo native preview is not a WebRTC host.',
        );
      }
      return;
    }

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
      contacts.map(async (contact) => {
        if (this.stopped) return;
        this.callbacks.onStatus(contact.id, 'searching');
        const roomId = await roomIdForPair(
          this.identity,
          contact,
        );
        const session: Session = { contact, links: [] };
        this.sessions.set(contact.id, session);
        const searchTimer = setTimeout(() => {
          if (!this.stopped && !this.authenticated.has(contact.id)) {
            this.callbacks.onStatus(contact.id, 'offline');
          }
        }, 20_000);
        this.searchTimers.set(contact.id, searchTimer);
        await Promise.all(
          strategies.map(async (strategy) => {
            try {
              const module = await strategy.load();
              if (this.stopped) return;
              const room = module.joinRoom(
                { appId, maxReceiveBytes: 12 * 1024 * 1024 },
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
                void Promise.resolve(this.callbacks.onPacket(contact.id, packet)).catch(
                  (error: unknown) => {
                    this.callbacks.onError?.(
                      contact.id,
                      error instanceof Error ? error.message : 'Could not process an encrypted message.',
                    );
                  },
                );
              };
              room.onPeerJoin = (peerId) => {
                if (this.stopped) return;
                link.peers.add(peerId);
                if (!this.authenticated.has(contact.id)) {
                  this.callbacks.onStatus(contact.id, 'searching');
                }
                this.callbacks.onPeerAvailable(contact.id);
              };
              room.onPeerLeave = (peerId) => {
                link.peers.delete(peerId);
                const isAnyPeerConnected = session.links.some(
                  (sessionLink) => sessionLink.peers.size > 0,
                );
                if (!isAnyPeerConnected) {
                  this.authenticated.delete(contact.id);
                  const timer = this.searchTimers.get(contact.id);
                  if (timer) clearTimeout(timer);
                  this.callbacks.onStatus(contact.id, 'offline');
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
      }),
    );
  }

  markAuthenticated(contactId: string): void {
    this.authenticated.add(contactId);
    const timer = this.searchTimers.get(contactId);
    if (timer) clearTimeout(timer);
    this.searchTimers.delete(contactId);
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
    for (const timer of this.searchTimers.values()) clearTimeout(timer);
    this.searchTimers.clear();
    this.authenticated.clear();
    const rooms = Array.from(this.sessions.values()).flatMap((session) =>
      session.links.map((link) => link.room),
    );
    this.sessions.clear();
    await Promise.all(rooms.map(async (room) => {
      try {
        await room.leave();
      } catch {
        // A room may already have closed after the app was backgrounded.
      }
    }));
  }
}
