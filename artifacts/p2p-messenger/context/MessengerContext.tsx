import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DirectCallManager } from '@/lib/call-manager';
import { createLocalIdentity, openEnvelope, randomId, sealPayload } from '@/lib/crypto';
import { contactFromInvite } from '@/lib/encoding';
import {
  DEFAULT_PREFERENCES,
  dispatchSystemNotification,
  getNotificationPermissionState,
  loadPreferences,
  playNotificationChime,
  requestNotificationPermission,
  savePreferences,
} from '@/lib/notifications';
import {
  deleteContact as removeSavedContact,
  getAllOutboxItems,
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
  ActiveCall,
  AppPreferences,
  CallMode,
  CallSignal,
  ChatMessage,
  ConnectionStatus,
  Contact,
  EncryptedEnvelope,
  InAppNotification,
  LocalIdentity,
  LocalSnapshot,
  MessageContent,
  NodeStatus,
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
  nodeStatus: NodeStatus;
  reconnecting: boolean;
  pendingOutboxCount: number;
  typing: Record<string, boolean>;
  networkErrors: Record<string, string>;
  storageError: string | null;
  activeCall: ActiveCall | null;
  callError: string | null;
  preferences: AppPreferences;
  notificationPermission: 'granted' | 'denied' | 'default' | 'unsupported';
  inAppBanner: InAppNotification | null;
  setActiveChatContact(contactId: string | null): void;
  dismissInAppBanner(): void;
  updatePreferences(changes: Partial<AppPreferences>): Promise<void>;
  requestNotifications(): Promise<boolean>;
  reconnectAll(): Promise<void>;
  reconnectContact(contactId: string): Promise<void>;
  createIdentity(displayName: string): Promise<void>;
  restoreIdentity(identity: LocalIdentity): Promise<void>;
  addContact(identity: PublicIdentity): Promise<Contact>;
  removeContact(contactId: string): Promise<void>;
  sendText(contactId: string, text: string): Promise<void>;
  sendAttachment(contactId: string, file: File, kind: 'image' | 'audio'): Promise<void>;
  sendTyping(contactId: string, active: boolean): Promise<void>;
  markIncomingRead(contactId: string): Promise<void>;
  startCall(contactId: string, mode: CallMode): Promise<void>;
  acceptCall(): Promise<void>;
  declineCall(): Promise<void>;
  endCall(): Promise<void>;
  toggleCallMicrophone(): void;
  toggleCallCamera(): void;
  clearCallError(): void;
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

function previewForNotification(content: MessageContent): string {
  if (content.kind === 'image') return 'Sent a photo';
  if (content.kind === 'audio') return 'Sent a voice note';
  return content.text ?? 'New encrypted message';
}

export function MessengerProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    Record<string, ConnectionStatus>
  >({});
  const [nodeStatus, setNodeStatus] = useState<NodeStatus>('connecting');
  const [reconnecting, setReconnecting] = useState(false);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [networkErrors, setNetworkErrors] = useState<Record<string, string>>({});
  const [storageError, setStorageError] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>(() =>
    loadPreferences(),
  );
  const [notificationPermission, setNotificationPermission] = useState<
    'granted' | 'denied' | 'default' | 'unsupported'
  >(() => getNotificationPermissionState());
  const [inAppBanner, setInAppBanner] = useState<InAppNotification | null>(null);

  const managerRef = useRef<P2PManager | null>(null);
  const identityRef = useRef<LocalIdentity | null>(null);
  const contactsRef = useRef<Contact[]>([]);
  const preferencesRef = useRef<AppPreferences>(DEFAULT_PREFERENCES);
  const activeChatContactRef = useRef<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const packetHandlerRef = useRef<
    (contactId: string, packet: EncryptedEnvelope) => Promise<void>
  >(async () => undefined);
  const controlSenderRef = useRef<
    (contactId: string, payload: SecurePayload) => Promise<void>
  >(async () => undefined);
  const flushOutboxRef = useRef<(contactId: string) => Promise<void>>(
    async () => undefined,
  );
  const callManagerRef = useRef<DirectCallManager | null>(null);
  const flushingRef = useRef(new Set<string>());

  const refreshOutboxCount = useCallback(async () => {
    try {
      const all = await getAllOutboxItems();
      setPendingOutboxCount(all.length);
    } catch {
      // Ignore storage read errors
    }
  }, []);

  const showBanner = useCallback((notification: InAppNotification) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setInAppBanner(notification);
    bannerTimerRef.current = setTimeout(() => {
      setInAppBanner((current) =>
        current?.id === notification.id ? null : current,
      );
    }, 4800);
  }, []);

  const dismissInAppBanner = useCallback(() => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setInAppBanner(null);
  }, []);

  const setActiveChatContact = useCallback((contactId: string | null) => {
    activeChatContactRef.current = contactId;
    if (contactId) {
      setInAppBanner((current) =>
        current?.contactId === contactId ? null : current,
      );
    }
  }, []);

  if (callManagerRef.current === null) {
    callManagerRef.current = new DirectCallManager(
      async (contactId, signal) => {
        const localIdentity = identityRef.current;
        const contact = contactsRef.current.find((item) => item.id === contactId);
        if (!localIdentity || !contact || !managerRef.current) {
          throw new Error('The direct chat connection is no longer available.');
        }
        const sent = await managerRef.current.send(
          contactId,
          sealPayload(localIdentity, contact, signal),
        );
        if (!sent) throw new Error('The direct chat connection was lost. Try again.');
      },
      (call) => {
        setActiveCall(call);
        if (call?.phase === 'incoming') {
          const contact = contactsRef.current.find(
            (item) => item.id === call.contactId,
          );
          const prefs = preferencesRef.current;
          if (prefs.soundEnabled) {
            playNotificationChime('call');
          }
          if (prefs.notificationsEnabled) {
            void dispatchSystemNotification({
              title: contact?.displayName ?? 'Incoming P2P Call',
              body: `Incoming encrypted ${call.mode} call`,
              tag: `call-${call.callId}`,
            });
          }
        }
      },
      (contactId, message) => {
        setCallError(message);
        setNetworkErrors((current) => ({ ...current, [contactId]: message }));
      },
    );
  }

  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    let cancelled = false;
    void loadSnapshot()
      .then(async (snapshot: LocalSnapshot) => {
        if (cancelled) return;
        setIdentity(snapshot.identity);
        setContacts(snapshot.contacts);
        setMessages(snapshot.messages);
        await refreshOutboxCount();
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
  }, [refreshOutboxCount]);

  const flushOutbox = useCallback(
    async (contactId: string) => {
      if (flushingRef.current.has(contactId)) return;
      flushingRef.current.add(contactId);
      try {
        const pending = await getOutboxForContact(contactId);
        for (const item of pending) {
          await managerRef.current?.send(contactId, item.envelope);
        }
      } finally {
        flushingRef.current.delete(contactId);
        await refreshOutboxCount();
      }
    },
    [refreshOutboxCount],
  );

  useEffect(() => {
    flushOutboxRef.current = flushOutbox;
  }, [flushOutbox]);

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
      setConnectionStatus((current) =>
        current[contactId] === 'connected'
          ? current
          : { ...current, [contactId]: 'connected' },
      );
      setNetworkErrors((current) => {
        if (!current[contactId]) return current;
        const next = { ...current };
        delete next[contactId];
        return next;
      });

      if (payload.kind === 'hello') {
        await sendControl(contactId, { kind: 'hello-ack' });
        await flushOutbox(contactId);
        return;
      }
      if (payload.kind === 'hello-ack') {
        await flushOutbox(contactId);
        return;
      }
      if (payload.kind === 'ping') {
        await sendControl(contactId, {
          kind: 'pong',
          timestamp: payload.timestamp,
        });
        await flushOutbox(contactId);
        return;
      }
      if (payload.kind === 'pong') {
        await flushOutbox(contactId);
        return;
      }
      if (payload.kind === 'typing') {
        setTyping((current) => ({ ...current, [contactId]: payload.active }));
        return;
      }
      if (payload.kind === 'ack') {
        const existing = await getMessage(payload.messageId);
        if (
          !existing ||
          existing.contactId !== contactId ||
          existing.direction !== 'outgoing'
        ) {
          await removeOutboxItem(payload.messageId);
          await refreshOutboxCount();
          return;
        }
        const nextStatus = existing.status === 'read' ? 'read' : 'delivered';
        const updated = await updateMessage(payload.messageId, {
          status: nextStatus,
        });
        await removeOutboxItem(payload.messageId);
        await refreshOutboxCount();
        if (updated) setMessages((current) => mergeMessage(current, updated));
        return;
      }
      if (payload.kind === 'read') {
        const existing = await getMessage(payload.messageId);
        if (
          !existing ||
          existing.contactId !== contactId ||
          existing.direction !== 'outgoing'
        ) {
          return;
        }
        const updated = await updateMessage(payload.messageId, {
          status: 'read',
        });
        await removeOutboxItem(payload.messageId);
        await refreshOutboxCount();
        if (updated) setMessages((current) => mergeMessage(current, updated));
        return;
      }
      if (
        payload.kind === 'call-offer' ||
        payload.kind === 'call-answer' ||
        payload.kind === 'call-candidate' ||
        payload.kind === 'call-reject' ||
        payload.kind === 'call-end'
      ) {
        await callManagerRef.current?.handleSignal(
          contactId,
          payload as CallSignal,
        );
        return;
      }

      if (payload.kind === 'message') {
        const existing = await getMessage(payload.message.id);
        if (existing && existing.contactId !== contactId) return;
        const isNewMessage = !existing;
        if (isNewMessage) {
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

          const prefs = preferencesRef.current;
          const isViewingThisChat =
            activeChatContactRef.current === contactId &&
            (typeof document === 'undefined' ||
              document.visibilityState === 'visible');

          if (prefs.soundEnabled) {
            playNotificationChime('message');
          }
          if (!isViewingThisChat) {
            const body = previewForNotification(payload.message);
            showBanner({
              id: payload.message.id,
              contactId,
              title: contact.displayName,
              body,
              createdAt: Date.now(),
            });
            if (prefs.notificationsEnabled) {
              void dispatchSystemNotification({
                title: contact.displayName,
                body,
                tag: `chat-${contactId}`,
              });
            }
          }
        }
        await sendControl(contactId, {
          kind: 'ack',
          messageId: payload.message.id,
        });
      }
    },
    [flushOutbox, refreshOutboxCount, sendControl, showBanner],
  );

  useEffect(() => {
    packetHandlerRef.current = handlePacket;
  }, [handlePacket]);

  useEffect(() => {
    if (!ready || !identity) return;
    const manager = new P2PManager(identity, {
      onPeerAvailable(contactId) {
        void controlSenderRef.current(contactId, { kind: 'hello' });
        void flushOutboxRef.current(contactId);
      },
      onHeartbeat(contactId, authenticated) {
        if (authenticated) {
          void controlSenderRef.current(contactId, {
            kind: 'ping',
            timestamp: Date.now(),
          });
        } else {
          void controlSenderRef.current(contactId, { kind: 'hello' });
        }
        void flushOutboxRef.current(contactId);
      },
      onPacket(contactId, packet) {
        return packetHandlerRef.current(contactId, packet);
      },
      onStatus(contactId, status) {
        setConnectionStatus((current) =>
          current[contactId] === status
            ? current
            : { ...current, [contactId]: status },
        );
      },
      onNodeStatus(status) {
        setNodeStatus(status);
      },
      onError(contactId, message) {
        setNetworkErrors((current) => ({ ...current, [contactId]: message }));
      },
    });
    managerRef.current = manager;
    for (const contact of contactsRef.current) {
      setConnectionStatus((current) => ({
        ...current,
        [contact.id]: current[contact.id] ?? 'searching',
      }));
    }
    void manager.start(contactsRef.current);
    return () => {
      if (managerRef.current === manager) managerRef.current = null;
      void manager.stop();
    };
  }, [ready, identity?.signPublic]);

  const contactsKey = contacts.map((contact) => contact.id).sort().join('|');
  useEffect(() => {
    if (!ready || !identity || !managerRef.current) return;
    void managerRef.current.syncContacts(contacts);
  }, [ready, identity?.signPublic, contactsKey, contacts]);

  const reconnectAll = useCallback(async () => {
    if (!managerRef.current) return;
    setReconnecting(true);
    try {
      await managerRef.current.reconnectAll();
      for (const contact of contactsRef.current) {
        await flushOutbox(contact.id);
      }
    } finally {
      setTimeout(() => setReconnecting(false), 600);
    }
  }, [flushOutbox]);

  const reconnectContact = useCallback(
    async (contactId: string) => {
      if (!managerRef.current) return;
      setReconnecting(true);
      try {
        await managerRef.current.nudgeContact(contactId);
        await flushOutbox(contactId);
      } finally {
        setTimeout(() => setReconnecting(false), 500);
      }
    },
    [flushOutbox],
  );

  const requestNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotificationPermission(getNotificationPermissionState());
    if (granted) {
      const next = { ...preferencesRef.current, notificationsEnabled: true };
      setPreferences(next);
      savePreferences(next);
    }
    return granted;
  }, []);

  const updatePreferences = useCallback(
    async (changes: Partial<AppPreferences>) => {
      if (changes.notificationsEnabled === true) {
        await requestNotificationPermission();
        setNotificationPermission(getNotificationPermissionState());
      }
      const next: AppPreferences = {
        ...preferencesRef.current,
        ...changes,
      };
      setPreferences(next);
      savePreferences(next);
    },
    [],
  );

  const createIdentity = useCallback(async (displayName: string) => {
    const nextIdentity = createLocalIdentity(displayName);
    await saveIdentity(nextIdentity);
    setIdentity(nextIdentity);
    void requestNotificationPermission().then(() => {
      setNotificationPermission(getNotificationPermissionState());
    });
  }, []);

  const restoreIdentity = useCallback(async (nextIdentity: LocalIdentity) => {
    await saveIdentity(nextIdentity);
    setIdentity(nextIdentity);
  }, []);

  const addContact = useCallback(async (publicIdentity: PublicIdentity) => {
    if (publicIdentity.signPublic === identityRef.current?.signPublic) {
      throw new Error('That is your own invite.');
    }
    const contact = contactFromInvite(publicIdentity);
    const existing = contactsRef.current.find((item) => item.id === contact.id);
    if (existing) {
      return existing;
    }
    await saveContact(contact);
    const nextContacts = [...contactsRef.current, contact];
    contactsRef.current = nextContacts;
    setContacts(nextContacts);
    setConnectionStatus((current) => ({
      ...current,
      [contact.id]: 'searching',
    }));
    await managerRef.current?.syncContacts(nextContacts);
    return contact;
  }, []);

  const removeContact = useCallback(
    async (contactId: string) => {
      await removeSavedContact(contactId);
      const nextContacts = contactsRef.current.filter(
        (contact) => contact.id !== contactId,
      );
      contactsRef.current = nextContacts;
      setContacts(nextContacts);
      setMessages((current) =>
        current.filter((message) => message.contactId !== contactId),
      );
      setConnectionStatus((current) => {
        const next = { ...current };
        delete next[contactId];
        return next;
      });
      await managerRef.current?.syncContacts(nextContacts);
      await refreshOutboxCount();
    },
    [refreshOutboxCount],
  );

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
      await refreshOutboxCount();
      setMessages((current) => mergeMessage(current, message));
      const sent = await managerRef.current?.send(
        contactId,
        outboxItem.envelope,
      );
      if (!sent) {
        void managerRef.current?.nudgeContact(contactId);
      }
    },
    [refreshOutboxCount],
  );

  const sendText = useCallback(
    async (contactId: string, text: string) => {
      const clean = text.trim();
      if (!clean) return;
      if (clean.length > 4000) {
        throw new Error('Messages are limited to 4,000 characters.');
      }
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
        throw new Error(
          'Attachments are limited to 5 MB so they fit reliably on mobile connections.',
        );
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
      if (!preferencesRef.current.typingIndicatorsEnabled) return;
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
        if (preferencesRef.current.readReceiptsEnabled) {
          await sendControl(contactId, { kind: 'read', messageId: message.id });
        }
      }
    },
    [sendControl],
  );

  const startCall = useCallback(
    async (contactId: string, mode: CallMode) => {
      setCallError(null);
      if (connectionStatus[contactId] !== 'connected') {
        throw new Error(
          'Wait for the encrypted direct connection before calling.',
        );
      }
      await callManagerRef.current?.start(contactId, mode);
    },
    [connectionStatus],
  );

  const acceptCall = useCallback(async () => {
    await callManagerRef.current?.accept();
  }, []);

  const declineCall = useCallback(async () => {
    await callManagerRef.current?.decline();
  }, []);

  const endCall = useCallback(async () => {
    await callManagerRef.current?.end();
  }, []);

  const toggleCallMicrophone = useCallback(() => {
    callManagerRef.current?.toggleMicrophone();
  }, []);

  const toggleCallCamera = useCallback(() => {
    callManagerRef.current?.toggleCamera();
  }, []);

  const clearCallError = useCallback(() => setCallError(null), []);

  const wipe = useCallback(async () => {
    callManagerRef.current?.dispose();
    await managerRef.current?.stop();
    managerRef.current = null;
    await wipeLocalData();
    setIdentity(null);
    setContacts([]);
    setMessages([]);
    setConnectionStatus({});
    setPendingOutboxCount(0);
    setTyping({});
    setNetworkErrors({});
    setStorageError(null);
    setCallError(null);
  }, []);

  const value = useMemo<MessengerContextValue>(
    () => ({
      ready,
      identity,
      contacts,
      messages,
      connectionStatus,
      nodeStatus,
      reconnecting,
      pendingOutboxCount,
      typing,
      networkErrors,
      storageError,
      activeCall,
      callError,
      preferences,
      notificationPermission,
      inAppBanner,
      setActiveChatContact,
      dismissInAppBanner,
      updatePreferences,
      requestNotifications,
      reconnectAll,
      reconnectContact,
      createIdentity,
      restoreIdentity,
      addContact,
      removeContact,
      sendText,
      sendAttachment,
      sendTyping,
      markIncomingRead,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      toggleCallMicrophone,
      toggleCallCamera,
      clearCallError,
      wipe,
    }),
    [
      ready,
      identity,
      contacts,
      messages,
      connectionStatus,
      nodeStatus,
      reconnecting,
      pendingOutboxCount,
      typing,
      networkErrors,
      storageError,
      activeCall,
      callError,
      preferences,
      notificationPermission,
      inAppBanner,
      setActiveChatContact,
      dismissInAppBanner,
      updatePreferences,
      requestNotifications,
      reconnectAll,
      reconnectContact,
      createIdentity,
      restoreIdentity,
      addContact,
      removeContact,
      sendText,
      sendAttachment,
      sendTyping,
      markIncomingRead,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      toggleCallMicrophone,
      toggleCallCamera,
      clearCallError,
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
  if (!context) {
    throw new Error('useMessenger must be used inside MessengerProvider.');
  }
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
