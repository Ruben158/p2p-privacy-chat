import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { AppPreferences } from './types';

const PREFS_STORAGE_KEY = 'p2p-messenger:preferences:v1';

export const DEFAULT_PREFERENCES: AppPreferences = {
  notificationsEnabled: true,
  soundEnabled: true,
  readReceiptsEnabled: true,
  typingIndicatorsEnabled: true,
};

export function loadPreferences(): AppPreferences {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppPreferences>;
        return {
          notificationsEnabled:
            parsed.notificationsEnabled ?? DEFAULT_PREFERENCES.notificationsEnabled,
          soundEnabled: parsed.soundEnabled ?? DEFAULT_PREFERENCES.soundEnabled,
          readReceiptsEnabled:
            parsed.readReceiptsEnabled ?? DEFAULT_PREFERENCES.readReceiptsEnabled,
          typingIndicatorsEnabled:
            parsed.typingIndicatorsEnabled ?? DEFAULT_PREFERENCES.typingIndicatorsEnabled,
        };
      }
    } catch {
      // Ignore storage errors
    }
  }
  return DEFAULT_PREFERENCES;
}

export function savePreferences(prefs: AppPreferences): void {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage errors
    }
  }
}

export function getNotificationPermissionState():
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported' {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return 'granted';
  }
  if (!('Notification' in window)) {
    // Capacitor Android WebView uses in-app + audio/vibration notifications
    return 'granted';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return true;
  }
  getAudioContext();
  if (!('Notification' in window)) {
    return true;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return true;
  }
}

let sharedAudioContext: AudioContext | null = null;
let audioUnlockAttached = false;

function ensureAudioUnlockListener(): void {
  if (audioUnlockAttached || Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  audioUnlockAttached = true;
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => undefined);
    }
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  ensureAudioUnlockListener();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new AudioCtx();
    } catch {
      return null;
    }
  }
  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume().catch(() => undefined);
  }
  return sharedAudioContext;
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  ensureAudioUnlockListener();
}

export function playNotificationChime(kind: 'message' | 'call' = 'message'): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'call' ? [200, 100, 200, 100, 280] : [120, 60, 140]);
    }
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = kind === 'call' ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);
      gain.gain.setValueAtTime(0.001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.11 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.27);
    });
  } catch {
    // Ignore audio playback errors if user hasn't interacted with the page yet
  }
}

export async function dispatchSystemNotification(options: {
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
}): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    await requestNotificationPermission();
  }
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(options.title, {
          body: options.body,
          tag: options.tag ?? 'p2p-messenger',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        });
        return;
      }
    }
  } catch {
    // Fallback to standard Notification constructor
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      tag: options.tag ?? 'p2p-messenger',
      icon: '/favicon.ico',
    });
    if (options.onClick) {
      notification.onclick = () => {
        window.focus?.();
        options.onClick?.();
        notification.close();
      };
    }
  } catch {
    // Ignore on browsers that disallow direct Notification constructor
  }
}
