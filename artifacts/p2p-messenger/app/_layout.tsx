import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MessengerProvider } from '@/context/MessengerContext';
import { ThemeProvider, useColors } from '@/hooks/useColors';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import CallOverlay from '@/components/CallOverlay';
import NotificationToast from '@/components/NotificationToast';

function ThemedShell() {
  const colors = useColors();

  useEffect(() => {
    const isLight = colors.themeMode === 'light';
    if (typeof window !== 'undefined') {
      try {
        document.documentElement.style.backgroundColor = colors.background;
        document.body.style.backgroundColor = colors.background;
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'theme-color');
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', colors.background);
      } catch {}

      const nativeBridge = (window as any).AndroidNative;
      if (nativeBridge && typeof nativeBridge.setSystemBars === 'function') {
        try {
          nativeBridge.setSystemBars(colors.background, colors.card, isLight);
        } catch {}
      }
    }
  }, [colors.background, colors.card, colors.themeMode]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        style={colors.themeMode === 'dark' ? 'light' : 'dark'}
      />
      <Slot />
      <NotificationToast />
      <CallOverlay />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <MessengerProvider>
              <ThemedShell />
            </MessengerProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
