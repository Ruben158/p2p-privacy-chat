import React from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export default function TabLayout() {
  const colors = useColors();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const isIOS = Platform.OS === 'ios';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2 },
        tabBarStyle: {
          position: 'absolute',
          height: isWeb ? 84 : 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: isWeb ? 34 : Math.max(insets.bottom, 8),
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          ...(isIOS && scheme === 'dark' ? { shadowOpacity: 0 } : {}),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color }) => <Feather name="users" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Privacy',
          tabBarIcon: ({ color }) => <Feather name="shield" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
