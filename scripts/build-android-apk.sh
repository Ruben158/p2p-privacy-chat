#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/artifacts/p2p-messenger"

echo "==> Checking Java 17+ and Android SDK..."
if ! java -version >/dev/null 2>&1; then
  echo "Error: Java Runtime (JDK 17+) is not installed."
  exit 1
fi

if [ -z "${ANDROID_HOME:-}" ] && [ -d "$HOME/Library/Android/sdk" ]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  echo "Error: ANDROID_HOME is not set and ~/Library/Android/sdk was not found."
  exit 1
fi

cd "$ROOT_DIR"
echo "==> Installing workspace dependencies..."
pnpm install --frozen-lockfile

echo "==> Exporting Expo web build..."
pnpm --filter @workspace/p2p-messenger run build:web

if [ ! -d "$APP_DIR/android" ]; then
  echo "==> Adding Capacitor Android platform..."
  pnpm --filter @workspace/p2p-messenger run cap:add:android
fi

echo "==> Syncing Capacitor Android project and configuring WebRTC/notification permissions..."
cd "$APP_DIR"
pnpm run cap:sync:android

python3 - <<'PY'
from pathlib import Path

manifest = Path("android/app/src/main/AndroidManifest.xml")
contents = manifest.read_text()
marker = "    <application"
permissions = [
    '    <uses-permission android:name="android.permission.INTERNET" />',
    '    <uses-permission android:name="android.permission.CAMERA" />',
    '    <uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
    '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '    <uses-permission android:name="android.permission.VIBRATE" />',
    '    <uses-feature android:name="android.hardware.camera" android:required="false" />',
]
for line in permissions:
    if line not in contents:
        contents = contents.replace(marker, line + "\n" + marker, 1)
manifest.write_text(contents)
PY

echo "==> Building Android Debug APK..."
cd "$APP_DIR/android"
./gradlew --no-daemon assembleDebug

APK_SRC="$APP_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
APK_DEST="$ROOT_DIR/p2p-messenger-debug.apk"
cp "$APK_SRC" "$APK_DEST"
echo "==> APK ready at: $APK_DEST"
