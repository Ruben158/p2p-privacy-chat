import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MessengerProvider } from '@/context/MessengerContext';
import InAppBanner from '@/components/InAppBanner';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <MessengerProvider>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Slot />
          <InAppBanner />
        </View>
      </MessengerProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#061012',
  },
});
