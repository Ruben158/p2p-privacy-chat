export interface PublicIdentity {
  signPublic: string;
  boxPublic: string;
  displayName: string;
}

export interface LocalIdentity extends PublicIdentity {
  signSecret: string;
  boxSecret: string;
  createdAt: number;
}

export interface Contact extends PublicIdentity {
  id: string;
  addedAt: number;
}

export interface MessageContent {
  id: string;
  kind: 'text' | 'image' | 'audio';
  text?: string;
  fileName?: string;
  mimeType?: string;
  data?: string;
  createdAt: number;
}

export interface EncryptedEnvelope {
  version: 1;
  sender: string;
  recipient: string;
  nonce: string;
  ciphertext: string;
  signature: string;
}

export type SecurePayload =
  | { kind: 'hello' }
  | { kind: 'message'; message: MessageContent }
  | { kind: 'ack'; messageId: string }
  | { kind: 'read'; messageId: string }
  | { kind: 'typing'; active: boolean };

export interface ChatMessage {
  id: string;
  contactId: string;
  direction: 'incoming' | 'outgoing';
  content: MessageContent;
  createdAt: number;
  status: 'queued' | 'delivered' | 'read';
  readAt?: number;
}

export interface OutboxItem {
  id: string;
  contactId: string;
  envelope: EncryptedEnvelope;
  createdAt: number;
}

export interface LocalSnapshot {
  identity: LocalIdentity | null;
  contacts: Contact[];
  messages: ChatMessage[];
}

export type ConnectionStatus = 'searching' | 'connected' | 'offline';
