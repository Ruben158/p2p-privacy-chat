import nacl from 'tweetnacl';
import {
  bytesToText,
  decodeBase64,
  encodeBase64,
  textToBytes,
  toBase64Url,
} from './encoding';
import type {
  Contact,
  EncryptedEnvelope,
  LocalIdentity,
  PublicIdentity,
  SecurePayload,
} from './types';

const subtle = () => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure cryptography is unavailable in this browser context.');
  }
  return globalThis.crypto.subtle;
};

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function hasMatchingKeyPairs(identity: LocalIdentity): boolean {
  try {
    const signing = nacl.sign.keyPair.fromSecretKey(
      decodeBase64(identity.signSecret),
    );
    const encryption = nacl.box.keyPair.fromSecretKey(
      decodeBase64(identity.boxSecret),
    );
    return (
      signing.secretKey.length === 64 &&
      encryption.secretKey.length === 32 &&
      encodeBase64(signing.publicKey) === identity.signPublic &&
      encodeBase64(encryption.publicKey) === identity.boxPublic &&
      identity.displayName.trim().length > 0
    );
  } catch {
    return false;
  }
}

export function randomId(): string {
  return toBase64Url(nacl.randomBytes(16));
}

export function createLocalIdentity(displayName: string): LocalIdentity {
  const signing = nacl.sign.keyPair();
  const encryption = nacl.box.keyPair();
  return {
    signPublic: encodeBase64(signing.publicKey),
    signSecret: encodeBase64(signing.secretKey),
    boxPublic: encodeBase64(encryption.publicKey),
    boxSecret: encodeBase64(encryption.secretKey),
    displayName: displayName.trim().slice(0, 48),
    createdAt: Date.now(),
  };
}

function signedBytes(envelope: Omit<EncryptedEnvelope, 'signature'>): Uint8Array {
  return textToBytes(
    [
      `p2p-messenger:${envelope.version}`,
      envelope.sender,
      envelope.recipient,
      envelope.nonce,
      envelope.ciphertext,
    ].join('\n'),
  );
}

export function sealPayload(
  identity: LocalIdentity,
  contact: Contact,
  payload: SecurePayload,
): EncryptedEnvelope {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(
    textToBytes(JSON.stringify(payload)),
    nonce,
    decodeBase64(contact.boxPublic),
    decodeBase64(identity.boxSecret),
  );
  const unsigned = {
    version: 1 as const,
    sender: identity.signPublic,
    recipient: contact.signPublic,
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(encrypted),
  };
  return {
    ...unsigned,
    signature: encodeBase64(
      nacl.sign.detached(signedBytes(unsigned), decodeBase64(identity.signSecret)),
    ),
  };
}

export function openEnvelope(
  identity: LocalIdentity,
  contact: Contact,
  envelope: EncryptedEnvelope,
): SecurePayload | null {
  if (
    !envelope ||
    typeof envelope !== 'object' ||
    typeof envelope.signature !== 'string' ||
    typeof envelope.nonce !== 'string' ||
    typeof envelope.ciphertext !== 'string' ||
    envelope.signature.length > 100 ||
    envelope.nonce.length > 64 ||
    envelope.ciphertext.length > 10_000_000
  ) {
    return null;
  }
  if (
    envelope.version !== 1 ||
    envelope.sender !== contact.signPublic ||
    envelope.recipient !== identity.signPublic
  ) {
    return null;
  }
  try {
    const { signature, ...unsigned } = envelope;
    const signatureBytes = decodeBase64(signature);
    const nonceBytes = decodeBase64(envelope.nonce);
    const ciphertextBytes = decodeBase64(envelope.ciphertext);
    if (
      signatureBytes.length !== nacl.sign.signatureLength ||
      nonceBytes.length !== nacl.box.nonceLength ||
      ciphertextBytes.length === 0
    ) {
      return null;
    }
    const validSignature = nacl.sign.detached.verify(
      signedBytes(unsigned),
      signatureBytes,
      decodeBase64(contact.signPublic),
    );
    if (!validSignature) return null;

    const opened = nacl.box.open(
      ciphertextBytes,
      nonceBytes,
      decodeBase64(contact.boxPublic),
      decodeBase64(identity.boxSecret),
    );
    if (!opened) return null;
    const payload: unknown = JSON.parse(bytesToText(opened));
    return isSecurePayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

function isSecurePayload(value: unknown): value is SecurePayload {
  if (typeof value !== 'object' || value === null || !('kind' in value)) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  if (payload.kind === 'hello') return true;
  if (payload.kind === 'typing') return typeof payload.active === 'boolean';
  if (payload.kind === 'ack' || payload.kind === 'read') {
    return (
      typeof payload.messageId === 'string' &&
      payload.messageId.length > 0 &&
      payload.messageId.length <= 80
    );
  }
  if (payload.kind !== 'message' || typeof payload.message !== 'object' || payload.message === null) {
    return false;
  }
  const message = payload.message as Record<string, unknown>;
  if (
    typeof message.id !== 'string' ||
    message.id.length === 0 ||
    message.id.length > 80 ||
    !Number.isFinite(message.createdAt)
  ) {
    return false;
  }
  if (message.kind === 'text') {
    return typeof message.text === 'string' && message.text.length > 0 && message.text.length <= 4000;
  }
  if (message.kind !== 'image' && message.kind !== 'audio') return false;
  if (
    typeof message.data !== 'string' ||
    message.data.length === 0 ||
    message.data.length > 7_100_000 ||
    typeof message.mimeType !== 'string' ||
    typeof message.fileName !== 'string' ||
    message.fileName.length > 255
  ) {
    return false;
  }
  return message.kind === 'image'
    ? message.mimeType.startsWith('image/')
    : message.mimeType.startsWith('audio/');
}

export async function fingerprintForPair(
  firstIdentity: Pick<PublicIdentity, 'signPublic' | 'boxPublic'>,
  secondIdentity: Pick<PublicIdentity, 'signPublic' | 'boxPublic'>,
): Promise<string> {
  const pair = [firstIdentity, secondIdentity]
    .sort((left, right) => left.signPublic.localeCompare(right.signPublic))
    .map((member) => `${member.signPublic}:${member.boxPublic}`)
    .join('\n');
  const digest = new Uint8Array(
    await subtle().digest('SHA-256', asArrayBuffer(textToBytes(pair))),
  );
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return hex.match(/.{1,4}/g)?.join(' ') ?? hex;
}

export async function roomIdForPair(
  firstIdentity: Pick<PublicIdentity, 'signPublic' | 'boxPublic'>,
  secondIdentity: Pick<PublicIdentity, 'signPublic' | 'boxPublic'>,
): Promise<string> {
  const pair = [firstIdentity, secondIdentity]
    .sort((left, right) => left.signPublic.localeCompare(right.signPublic))
    .map((member) => `${member.signPublic}:${member.boxPublic}`)
    .join('\n');
  const digest = new Uint8Array(
    await subtle().digest(
      'SHA-256',
      asArrayBuffer(textToBytes(`p2p-messenger-room-v1:${pair}`)),
    ),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function encryptIdentityBackup(
  identity: LocalIdentity,
  passphrase: string,
): Promise<string> {
  if (passphrase.length < 10) {
    throw new Error('Use a backup passphrase with at least 10 characters.');
  }
  const salt = nacl.randomBytes(16);
  const iv = nacl.randomBytes(12);
  const baseKey = await subtle().importKey(
    'raw',
    asArrayBuffer(textToBytes(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await subtle().deriveKey(
    {
      name: 'PBKDF2',
      salt: asArrayBuffer(salt),
      iterations: 310_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const ciphertext = await subtle().encrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(iv) },
    key,
    asArrayBuffer(textToBytes(JSON.stringify(identity))),
  );
  return JSON.stringify({
    format: 'p2p-messenger-backup',
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: 310_000,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
  });
}

export async function decryptIdentityBackup(
  backupText: string,
  passphrase: string,
): Promise<LocalIdentity> {
  try {
    const parsed = JSON.parse(backupText) as Record<string, unknown>;
    if (
      parsed.format !== 'p2p-messenger-backup' ||
      parsed.version !== 1 ||
      typeof parsed.salt !== 'string' ||
      typeof parsed.iv !== 'string' ||
      typeof parsed.ciphertext !== 'string'
    ) {
      throw new Error('This is not a supported P2P Messenger backup.');
    }
    const baseKey = await subtle().importKey(
      'raw',
      asArrayBuffer(textToBytes(passphrase)),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const key = await subtle().deriveKey(
      {
        name: 'PBKDF2',
        salt: asArrayBuffer(decodeBase64(parsed.salt)),
        iterations: 310_000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plaintext = await subtle().decrypt(
      { name: 'AES-GCM', iv: asArrayBuffer(decodeBase64(parsed.iv)) },
      key,
      asArrayBuffer(decodeBase64(parsed.ciphertext)),
    );
    const identity = JSON.parse(bytesToText(new Uint8Array(plaintext))) as LocalIdentity;
    if (!hasMatchingKeyPairs(identity)) {
      throw new Error('The backup is missing identity keys.');
    }
    return identity;
  } catch (error) {
    if (error instanceof Error && error.message.includes('supported P2P')) {
      throw error;
    }
    throw new Error('Backup could not be opened. Check the passphrase and backup text.');
  }
}
