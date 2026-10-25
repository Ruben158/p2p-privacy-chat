# P2P Messenger

An open-source, local-first messenger prototype. There is no account service or
central chat database. Identities are generated on-device; chat messages are
signed, encrypted to the recipient, and sent over WebRTC data channels.

## Run locally

From the workspace root:

```sh
pnpm --filter @workspace/p2p-messenger dev
```

The web preview uses IndexedDB. The Android package is a Capacitor WebView built
from the Expo web export. The Android APK build runs on every push through
`.github/workflows/android-apk.yml` and publishes a debug APK as a GitHub
prerelease.

## Privacy and network limits

- Nostr relays and BitTorrent trackers are used only for public WebRTC
  signaling. They are not the message store, but can observe connection
  metadata.
- Message contents are signed and encrypted before they leave the device.
- Contacts, chat history, identity keys, and the outbox are stored locally.
  Local chat history and identity keys are **not encrypted at rest**; protect
  the device with its screen lock.
- Identity backups are encrypted with a passphrase. If that passphrase is lost,
  the backup cannot be restored.
- The outbox is held on the sender's device and flushes when a direct connection
  is available. It is not a server-side mailbox, so the sender must be online
  for delivery.
- No TURN relay is configured. Some restrictive networks may prevent a direct
  WebRTC connection.
- Images and voice notes are limited to 5 MB each to fit the direct transport.
- This project has not had an independent cryptographic audit.

The UI can run in Expo Go, but browser-based Trystero/WebRTC transport is
available in the web build and Capacitor APK, not in Expo Go's native runtime.
