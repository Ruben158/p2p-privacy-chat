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

export type CallMode = 'voice' | 'video';
export type CallPhase = 'incoming' | 'outgoing' | 'connecting' | 'connected';

export interface IceCandidatePayload {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export type CallSignal =
  | { kind: 'call-offer'; callId: string; mode: CallMode; sdp: string }
  | { kind: 'call-answer'; callId: string; sdp: string }
  | { kind: 'call-candidate'; callId: string; candidate: IceCandidatePayload }
  | { kind: 'call-reject' | 'call-end'; callId: string };

export interface ActiveCall {
  contactId: string;
  callId: string;
  mode: CallMode;
  phase: CallPhase;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraEnabled: boolean;
}

export type SecurePayload =
  | { kind: 'hello' }
  | { kind: 'message'; message: MessageContent }
  | { kind: 'ack'; messageId: string }
  | { kind: 'read'; messageId: string }
  | { kind: 'typing'; active: boolean }
  | CallSignal;

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
