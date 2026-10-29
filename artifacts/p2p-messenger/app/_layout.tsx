import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { MessengerProvider } from '@/context/MessengerContext';
import InAppBanner from '@/components/InAppBanner';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Feather.font,
    ...MaterialCommunityIcons.font,
  });

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
