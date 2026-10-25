import nacl from 'tweetnacl';
import type { Contact, LocalIdentity, PublicIdentity } from './types';

const alphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function encodeBase64(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? bytes[index + 1]! : 0;
    const third = hasThird ? bytes[index + 2]! : 0;
    output += alphabet[first >> 2];
    output += alphabet[((first & 3) << 4) | (second >> 4)];
    output += hasSecond
      ? alphabet[((second & 15) << 2) | (third >> 6)]
      : '=';
    output += hasThird ? alphabet[third & 63] : '=';
  }
  return output;
}

export function decodeBase64(value: string): Uint8Array {
  const clean = value.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const output: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of clean) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('This does not look like a valid invite.');
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 255);
    }
  }
  return new Uint8Array(output);
}

export function toBase64Url(bytes: Uint8Array): string {
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  return decodeBase64(value);
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function makeInvite(identity: LocalIdentity): string {
  const claims = {
    type: 'p2p-messenger-invite',
    version: 1,
    signPublic: identity.signPublic,
    boxPublic: identity.boxPublic,
    displayName: identity.displayName,
  };
  const signature = encodeBase64(
    nacl.sign.detached(
      textToBytes(
        [
          claims.type,
          String(claims.version),
          claims.signPublic,
          claims.boxPublic,
          claims.displayName,
        ].join('\n'),
      ),
      decodeBase64(identity.signSecret),
    ),
  );
  const payload = { ...claims, signature };
  return `p2pmsg://invite/${toBase64Url(textToBytes(JSON.stringify(payload)))}`;
}

export function parseInvite(value: string): PublicIdentity {
  let candidate = value.trim();
  if (candidate.length > 5000) {
    throw new Error('That invite is too long to be valid.');
  }
  if (candidate.startsWith('p2pmsg://invite/')) {
    candidate = bytesToText(
      fromBase64Url(candidate.slice('p2pmsg://invite/'.length)),
    );
  } else if (!candidate.startsWith('{')) {
    try {
      candidate = bytesToText(fromBase64Url(candidate));
    } catch {
      throw new Error('Paste a full P2P invite link, not a short peer ID.');
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error('That invite could not be read. Ask your contact to share it again.');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('signPublic' in parsed) ||
    !('boxPublic' in parsed) ||
    !('displayName' in parsed) ||
    !('signature' in parsed)
  ) {
    throw new Error('The invite is missing its encryption keys.');
  }

  const record = parsed as Record<string, unknown>;
  if (
    typeof record.signPublic !== 'string' ||
    typeof record.boxPublic !== 'string' ||
    typeof record.displayName !== 'string' ||
    record.type !== 'p2p-messenger-invite' ||
    record.version !== 1 ||
    typeof record.signature !== 'string' ||
    fromBase64Url(record.signPublic).length !== 32 ||
    fromBase64Url(record.boxPublic).length !== 32
  ) {
    throw new Error('The invite contains invalid public keys.');
  }

  const signatureIsValid = nacl.sign.detached.verify(
    textToBytes(
      [
        'p2p-messenger-invite',
        '1',
        record.signPublic,
        record.boxPublic,
        record.displayName,
      ].join('\n'),
    ),
    fromBase64Url(record.signature),
    fromBase64Url(record.signPublic),
  );
  if (!signatureIsValid) {
    throw new Error('The invite’s key signature is invalid. Ask your contact to share a fresh invite.');
  }

  return {
    signPublic: record.signPublic,
    boxPublic: record.boxPublic,
    displayName: record.displayName.trim().slice(0, 48) || 'New contact',
  };
}

export function contactFromInvite(identity: PublicIdentity): Contact {
  return {
    ...identity,
    id: identity.signPublic,
    addedAt: Date.now(),
  };
}
