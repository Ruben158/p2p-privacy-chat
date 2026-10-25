import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createLocalIdentity, openEnvelope, randomId, sealPayload } from '@/lib/crypto';
import { contactFromInvite } from '@/lib/encoding';
import {
  deleteContact as removeSavedContact,
  getMessage,
  getMessagesForContact,
  getOutboxForContact,
  loadSnapshot,
  removeOutboxItem,
  saveContact,
  saveIdentity,
  saveMessage,
  saveOutboxItem,
  updateMessage,
  wipeLocalData,
} from '@/lib/storage';
import { P2PManager } from '@/lib/transport';
import type {
  ChatMessage,
  ConnectionStatus,
  Contact,
  EncryptedEnvelope,
  LocalIdentity,
  LocalSnapshot,
  MessageContent,
  OutboxItem,
  PublicIdentity,
  SecurePayload,
} from '@/lib/types';

interface MessengerContextValue {
  ready: boolean;
  identity: LocalIdentity | null;
  contacts: Contact[];
  messages: ChatMessage[];
  connectionStatus: Record<string, ConnectionStatus>;
  typing: Record<string, boolean>;
  networkErrors: Record<string, string>;
  storageError: string | null;
  createIdentity(displayName: string): Promise<void>;
  restoreIdentity(identity: LocalIdentity): Promise<void>;
  addContact(identity: PublicIdentity): Promise<Contact>;
  removeContact(contactId: string): Promise<void>;
  sendText(contactId: string, text: string): Promise<void>;
  sendAttachment(contactId: string, file: File, kind: 'image' | 'audio'): Promise<void>;
  sendTyping(contactId: string, active: boolean): Promise<void>;
  markIncomingRead(contactId: string): Promise<void>;
  wipe(): Promise<void>;
}

const MessengerContext = createContext<MessengerContextValue | null>(null);

function mergeMessage(current: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return [...current.filter((item) => item.id !== message.id), message].sort(
    (left, right) => left.createdAt - right.createdAt,
  );
}

function upsertOutboxItem(
  identity: LocalIdentity,
  contact: Contact,
  payload: SecurePayload,
  id: string,
  createdAt: number,
): OutboxItem {
  return {
    id,
    contactId: contact.id,
    envelope: sealPayload(identity, contact, payload),
    createdAt,
  };
}

export function MessengerProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    Record<string, ConnectionStatus>
  >({});
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [networkErrors, setNetworkErrors] = useState<Record<string, string>>({});
  const [storageError, setStorageError] = useState<string | null>(null);
  const managerRef = useRef<P2PManager | null>(null);
  const identityRef = useRef<LocalIdentity | null>(null);
  const contactsRef = useRef<Contact[]>([]);
  const packetHandlerRef = useRef<
    (contactId: string, packet: EncryptedEnvelope) => Promise<void>
  >(async () => undefined);
  const controlSenderRef = useRef<
    (contactId: string, payload: SecurePayload) => Promise<void>
  >(async () => undefined);
  const flushingRef = useRef(new Set<string>());

  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    let cancelled = false;
    void loadSnapshot()
      .then((snapshot: LocalSnapshot) => {
        if (cancelled) return;
        setIdentity(snapshot.identity);
        setContacts(snapshot.contacts);
        setMessages(snapshot.messages);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStorageError(
            error instanceof Error
              ? error.message
              : 'Local storage could not be opened.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const flushOutbox = useCallback(async (contactId: string) => {
    if (flushingRef.current.has(contactId)) return;
    flushingRef.current.add(contactId);
    try {
      const pending = await getOutboxForContact(contactId);
      for (const item of pending) {
        await managerRef.current?.send(contactId, item.envelope);
      }
    } finally {
      flushingRef.current.delete(contactId);
    }
  }, []);

  const sendControl = useCallback(
    async (contactId: string, payload: SecurePayload) => {
      const currentIdentity = identityRef.current;
      const contact = contactsRef.current.find((item) => item.id === contactId);
      if (!currentIdentity || !contact) return;
      const envelope = sealPayload(currentIdentity, contact, payload);
      await managerRef.current?.send(contactId, envelope);
    },
    [],
  );

  useEffect(() => {
    controlSenderRef.current = sendControl;
  }, [sendControl]);

  const handlePacket = useCallback(
    async (contactId: string, packet: EncryptedEnvelope) => {
      const localIdentity = identityRef.current;
      const contact = contactsRef.current.find((item) => item.id === contactId);
      if (!localIdentity || !contact) return;
      const payload = openEnvelope(localIdentity, contact, packet);
      if (!payload) return;

      managerRef.current?.markAuthenticated(contactId);
      setConnectionStatus((current) => ({ ...current, [contactId]: 'connected' }));
      setNetworkErrors((current) => {
        const next = { ...current };
        delete next[contactId];
        return next;
      });

      if (payload.kind === 'hello') {
        await flushOutbox(contactId);
        return;
      }
      if (payload.kind === 'typing') {
        setTyping((current) => ({ ...current, [contactId]: payload.active }));
        return;
      }
      if (payload.kind === 'ack') {
        const existing = await getMessage(payload.messageId);
        if (!existing || existing.contactId !== contactId || existing.direction !== 'outgoing') {
          return;
        }
        const updated = await updateMessage(payload.messageId, { status: 'delivered' });
        await removeOutboxItem(payload.messageId);
        if (updated) setMessages((current) => mergeMessage(current, updated));
        return;
      }
      if (payload.kind === 'read') {
        const existing = await getMessage(payload.messageId);
        if (!existing || existing.contactId !== contactId || existing.direction !== 'outgoing') {
          return;
        }
        const updated = await updateMessage(payload.messageId, { status: 'read' });
        if (updated) setMessages((current) => mergeMessage(current, updated));
        return;
      }

      if (payload.kind === 'message') {
        const existing = await getMessage(payload.message.id);
        if (existing && existing.contactId !== contactId) return;
        if (!existing) {
          const incoming: ChatMessage = {
            id: payload.message.id,
            contactId,
            direction: 'incoming',
            content: payload.message,
            createdAt: payload.message.createdAt,
            status: 'delivered',
          };
          await saveMessage(incoming);
          setMessages((current) => mergeMessage(current, incoming));
        }
        await sendControl(contactId, {
          kind: 'ack',
          messageId: payload.message.id,
        });
      }
    },
    [flushOutbox, sendControl],
  );

  useEffect(() => {
    packetHandlerRef.current = handlePacket;
  }, [handlePacket]);

  const contactsKey = contacts.map((contact) => contact.id).sort().join('|');
  useEffect(() => {
    if (!ready || !identity) return;
    const manager = new P2PManager(identity, {
      onPeerAvailable(contactId) {
        void controlSenderRef.current(contactId, { kind: 'hello' });
      },
      onPacket(contactId, packet) {
        return packetHandlerRef.current(contactId, packet);
      },
      onStatus(contactId, status) {
        setConnectionStatus((current) => ({ ...current, [contactId]: status }));
      },
      onError(contactId, message) {
        setNetworkErrors((current) => ({ ...current, [contactId]: message }));
      },
    });
    managerRef.current = manager;
    for (const contact of contacts) {
      setConnectionStatus((current) => ({
        ...current,
        [contact.id]: 'searching',
      }));
    }
    void manager.start(contacts);
    return () => {
      if (managerRef.current === manager) managerRef.current = null;
      void manager.stop();
    };
  }, [ready, identity?.signPublic, contactsKey]);

  const createIdentity = useCallback(async (displayName: string) => {
    const nextIdentity = createLocalIdentity(displayName);
    await saveIdentity(nextIdentity);
    setIdentity(nextIdentity);
  }, []);

  const restoreIdentity = useCallback(async (nextIdentity: LocalIdentity) => {
    await saveIdentity(nextIdentity);
    setIdentity(nextIdentity);
  }, []);

  const addContact = useCallback(
    async (publicIdentity: PublicIdentity) => {
      if (publicIdentity.signPublic === identityRef.current?.signPublic) {
        throw new Error('That is your own invite.');
      }
      const contact = contactFromInvite(publicIdentity);
      if (contactsRef.current.some((item) => item.id === contact.id)) {
        throw new Error('This person is already in your contacts.');
      }
      await saveContact(contact);
      setContacts((current) => [...current, contact]);
      return contact;
    },
    [],
  );

  const removeContact = useCallback(async (contactId: string) => {
    await removeSavedContact(contactId);
    setContacts((current) => current.filter((contact) => contact.id !== contactId));
    setMessages((current) => current.filter((message) => message.contactId !== contactId));
    setConnectionStatus((current) => {
      const next = { ...current };
      delete next[contactId];
      return next;
    });
  }, []);

  const sendContent = useCallback(
    async (contactId: string, content: MessageContent) => {
      const localIdentity = identityRef.current;
      const contact = contactsRef.current.find((item) => item.id === contactId);
      if (!localIdentity || !contact) {
        throw new Error('This contact is no longer available.');
      }
      const message: ChatMessage = {
        id: content.id,
        contactId,
        direction: 'outgoing',
        content,
        createdAt: content.createdAt,
        status: 'queued',
      };
      const outboxItem = upsertOutboxItem(
        localIdentity,
        contact,
        { kind: 'message', message: content },
        content.id,
        content.createdAt,
      );
      await saveMessage(message);
      await saveOutboxItem(outboxItem);
      setMessages((current) => mergeMessage(current, message));
      await managerRef.current?.send(contactId, outboxItem.envelope);
    },
    [],
  );

  const sendText = useCallback(
    async (contactId: string, text: string) => {
      const clean = text.trim();
      if (!clean) return;
      if (clean.length > 4000) throw new Error('Messages are limited to 4,000 characters.');
      await sendContent(contactId, {
        id: randomId(),
        kind: 'text',
        text: clean,
        createdAt: Date.now(),
      });
    },
    [sendContent],
  );

  const sendAttachment = useCallback(
    async (contactId: string, file: File, kind: 'image' | 'audio') => {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Attachments are limited to 5 MB so they fit reliably on mobile connections.');
      }
      const data = new Uint8Array(await file.arrayBuffer());
      await sendContent(contactId, {
        id: randomId(),
        kind,
        fileName: file.name || (kind === 'image' ? 'image' : 'voice-note'),
        mimeType: file.type || (kind === 'image' ? 'image/jpeg' : 'audio/webm'),
        data: encodeAttachment(data),
        createdAt: Date.now(),
      });
    },
    [sendContent],
  );

  const sendTyping = useCallback(
    async (contactId: string, active: boolean) => {
      await sendControl(contactId, { kind: 'typing', active });
    },
    [sendControl],
  );

  const markIncomingRead = useCallback(
    async (contactId: string) => {
      const rows = await getMessagesForContact(contactId);
      const unread = rows.filter(
        (message) => message.direction === 'incoming' && !message.readAt,
      );
      for (const message of unread) {
        const readAt = Date.now();
        const updated = await updateMessage(message.id, { readAt });
        if (updated) setMessages((current) => mergeMessage(current, updated));
        await sendControl(contactId, { kind: 'read', messageId: message.id });
      }
    },
    [sendControl],
  );

  const wipe = useCallback(async () => {
    await managerRef.current?.stop();
    managerRef.current = null;
    await wipeLocalData();
    setIdentity(null);
    setContacts([]);
    setMessages([]);
    setConnectionStatus({});
    setTyping({});
    setNetworkErrors({});
    setStorageError(null);
  }, []);

  const value = useMemo<MessengerContextValue>(
    () => ({
      ready,
      identity,
      contacts,
      messages,
      connectionStatus,
      typing,
      networkErrors,
      storageError,
      createIdentity,
      restoreIdentity,
      addContact,
      removeContact,
      sendText,
      sendAttachment,
      sendTyping,
      markIncomingRead,
      wipe,
    }),
    [
      ready,
      identity,
      contacts,
      messages,
      connectionStatus,
      typing,
      networkErrors,
      storageError,
      createIdentity,
      restoreIdentity,
      addContact,
      removeContact,
      sendText,
      sendAttachment,
      sendTyping,
      markIncomingRead,
      wipe,
    ],
  );

  return (
    <MessengerContext.Provider value={value}>
      {children}
    </MessengerContext.Provider>
  );
}

export function useMessenger(): MessengerContextValue {
  const context = useContext(MessengerContext);
  if (!context) throw new Error('useMessenger must be used inside MessengerProvider.');
  return context;
}

function encodeAttachment(bytes: Uint8Array): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? bytes[index + 1]! : 0;
    const third = hasThird ? bytes[index + 2]! : 0;
    output += alphabet[first >> 2];
    output += alphabet[((first & 3) << 4) | (second >> 4)];
    output += hasSecond ? alphabet[((second & 15) << 2) | (third >> 6)] : '=';
    output += hasThird ? alphabet[third & 63] : '=';
  }
  return output;
}
