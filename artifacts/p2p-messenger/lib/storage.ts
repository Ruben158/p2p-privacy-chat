import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { Platform } from 'react-native';
import type {
  ChatMessage,
  Contact,
  LocalIdentity,
  LocalSnapshot,
  OutboxItem,
} from './types';

interface MessengerDatabase extends DBSchema {
  meta: {
    key: string;
    value: LocalIdentity;
  };
  contacts: {
    key: string;
    value: Contact;
  };
  messages: {
    key: string;
    value: ChatMessage;
    indexes: { 'by-contact': string };
  };
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: { 'by-contact': string };
  };
}

const databaseName = 'p2p-messenger-local-v1';
const nativePrefix = 'p2p-messenger:';
let databasePromise: Promise<IDBPDatabase<MessengerDatabase>> | null = null;

function isBrowser(): boolean {
  return Platform.OS === 'web' && typeof indexedDB !== 'undefined';
}

function getDatabase(): Promise<IDBPDatabase<MessengerDatabase>> {
  if (!isBrowser()) {
    throw new Error('IndexedDB is not available in this environment.');
  }
  databasePromise ??= openDB<MessengerDatabase>(databaseName, 1, {
    upgrade(database) {
      database.createObjectStore('meta');
      database.createObjectStore('contacts', { keyPath: 'id' });
      const messages = database.createObjectStore('messages', { keyPath: 'id' });
      messages.createIndex('by-contact', 'contactId');
      const outbox = database.createObjectStore('outbox', { keyPath: 'id' });
      outbox.createIndex('by-contact', 'contactId');
    },
  });
  return databasePromise;
}

async function nativeGet<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(`${nativePrefix}${key}`);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

async function nativeSet<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(`${nativePrefix}${key}`, JSON.stringify(value));
}

export async function loadSnapshot(): Promise<LocalSnapshot> {
  if (!isBrowser()) {
    const [identity, contacts, messages] = await Promise.all([
      nativeGet<LocalIdentity | null>('identity', null),
      nativeGet<Contact[]>('contacts', []),
      nativeGet<ChatMessage[]>('messages', []),
    ]);
    return { identity, contacts, messages };
  }
  const db = await getDatabase();
  const [identity, contacts, messages] = await Promise.all([
    db.get('meta', 'identity'),
    db.getAll('contacts'),
    db.getAll('messages'),
  ]);
  return {
    identity: identity ?? null,
    contacts,
    messages: messages.sort((a, b) => a.createdAt - b.createdAt),
  };
}

export async function saveIdentity(identity: LocalIdentity): Promise<void> {
  if (!isBrowser()) return nativeSet('identity', identity);
  await (await getDatabase()).put('meta', identity, 'identity');
}

export async function saveContact(contact: Contact): Promise<void> {
  if (!isBrowser()) {
    const contacts = await nativeGet<Contact[]>('contacts', []);
    await nativeSet('contacts', [
      ...contacts.filter((item) => item.id !== contact.id),
      contact,
    ]);
    return;
  }
  await (await getDatabase()).put('contacts', contact);
}

export async function deleteContact(contactId: string): Promise<void> {
  if (!isBrowser()) {
    const contacts = await nativeGet<Contact[]>('contacts', []);
    await nativeSet(
      'contacts',
      contacts.filter((contact) => contact.id !== contactId),
    );
    const messages = await nativeGet<ChatMessage[]>('messages', []);
    await nativeSet(
      'messages',
      messages.filter((message) => message.contactId !== contactId),
    );
    const outbox = await nativeGet<OutboxItem[]>('outbox', []);
    await nativeSet(
      'outbox',
      outbox.filter((item) => item.contactId !== contactId),
    );
    return;
  }
  const db = await getDatabase();
  const [messages, outbox] = await Promise.all([
    getMessagesForContact(contactId),
    getOutboxForContact(contactId),
  ]);
  const tx = db.transaction(['contacts', 'messages', 'outbox'], 'readwrite');
  await Promise.all([
    tx.objectStore('contacts').delete(contactId),
    ...messages.map((message) => tx.objectStore('messages').delete(message.id)),
    ...outbox.map((item) => tx.objectStore('outbox').delete(item.id)),
  ]);
  await tx.done;
}

export async function saveMessage(message: ChatMessage): Promise<void> {
  if (!isBrowser()) {
    const messages = await nativeGet<ChatMessage[]>('messages', []);
    await nativeSet('messages', [
      ...messages.filter((item) => item.id !== message.id),
      message,
    ]);
    return;
  }
  await (await getDatabase()).put('messages', message);
}

export async function getMessage(messageId: string): Promise<ChatMessage | undefined> {
  if (!isBrowser()) {
    const messages = await nativeGet<ChatMessage[]>('messages', []);
    return messages.find((message) => message.id === messageId);
  }
  return (await getDatabase()).get('messages', messageId);
}

export async function getMessagesForContact(contactId: string): Promise<ChatMessage[]> {
  if (!isBrowser()) {
    const messages = await nativeGet<ChatMessage[]>('messages', []);
    return messages
      .filter((message) => message.contactId === contactId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  const messages = await (await getDatabase())
    .getAllFromIndex('messages', 'by-contact', contactId);
  return messages.sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateMessage(
  messageId: string,
  changes: Partial<ChatMessage>,
): Promise<ChatMessage | undefined> {
  const current = await getMessage(messageId);
  if (!current) return undefined;
  const updated = { ...current, ...changes };
  await saveMessage(updated);
  return updated;
}

export async function saveOutboxItem(item: OutboxItem): Promise<void> {
  if (!isBrowser()) {
    const outbox = await nativeGet<OutboxItem[]>('outbox', []);
    await nativeSet('outbox', [
      ...outbox.filter((row) => row.id !== item.id),
      item,
    ]);
    return;
  }
  await (await getDatabase()).put('outbox', item);
}

export async function getOutboxForContact(contactId: string): Promise<OutboxItem[]> {
  if (!isBrowser()) {
    const outbox = await nativeGet<OutboxItem[]>('outbox', []);
    return outbox
      .filter((item) => item.contactId === contactId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  const items = await (await getDatabase())
    .getAllFromIndex('outbox', 'by-contact', contactId);
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getAllOutboxItems(): Promise<OutboxItem[]> {
  if (!isBrowser()) {
    const outbox = await nativeGet<OutboxItem[]>('outbox', []);
    return outbox.sort((a, b) => a.createdAt - b.createdAt);
  }
  const items = await (await getDatabase()).getAll('outbox');
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeOutboxItem(itemId: string): Promise<void> {
  if (!isBrowser()) {
    const outbox = await nativeGet<OutboxItem[]>('outbox', []);
    await nativeSet(
      'outbox',
      outbox.filter((item) => item.id !== itemId),
    );
    return;
  }
  await (await getDatabase()).delete('outbox', itemId);
}

export async function wipeLocalData(): Promise<void> {
  if (!isBrowser()) {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(nativePrefix)));
    return;
  }
  databasePromise = null;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Could not erase local data.'));
    request.onblocked = () => reject(new Error('Close other open app tabs before wiping data.'));
  });
}
