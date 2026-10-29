import React from 'react';
import { StyleSheet, View } from 'react-native';
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
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.themeMode === 'dark' ? 'light' : 'dark'} />
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
        <ErrorBoundary>
          <ThemeProvider>
            <MessengerProvider>
              <ThemedShell />
            </MessengerProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
