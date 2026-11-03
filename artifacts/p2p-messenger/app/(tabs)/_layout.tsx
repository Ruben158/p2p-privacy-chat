import React, { useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { Feather } from '@/components/AppIcons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useMessenger } from '@/context/MessengerContext';

export default function TabLayout() {
  const colors = useColors();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { messages } = useMessenger();
  const isWeb = Platform.OS === 'web';
  const isIOS = Platform.OS === 'ios';

  const unreadCount = useMemo(
    () =>
      messages.filter((m) => m.direction === 'incoming' && !m.readAt).length,
    [messages],
  );

  const bottomPad = isWeb ? Math.max(insets.bottom, 12) : Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 15,
          fontWeight: '700',
          marginTop: 2,
          marginBottom: 2,
          letterSpacing: 0.2,
        },
        tabBarStyle: {
          position: 'absolute',
          height: isWeb ? 66 + bottomPad : 60 + bottomPad,
          paddingTop: 6,
          paddingBottom: bottomPad,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
          ...(isIOS && scheme === 'dark' ? { shadowOpacity: 0 } : {}),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: colors.primaryForeground,
            fontSize: 10,
            fontWeight: '800',
          },
          tabBarIcon: ({ color }) => (
            <Feather name="message-circle" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color }) => (
            <Feather name="users" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <Feather name="shield" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
