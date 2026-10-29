import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@/components/AppIcons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useMessenger } from '@/context/MessengerContext';

export default function NotificationToast() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { inAppBanner, dismissInAppBanner } = useMessenger();

  if (!inAppBanner) return null;

  const handleOpen = () => {
    const targetId = inAppBanner.contactId;
    dismissInAppBanner();
    router.push({ pathname: '/chat/[id]', params: { id: targetId } });
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          top: Math.max(insets.top, 12) + 8,
        },
      ]}
    >
      <Pressable
        onPress={handleOpen}
        style={[
          styles.toast,
          {
            backgroundColor: colors.card,
            borderColor: colors.primary,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
          <MaterialCommunityIcons
            name="message-lock"
            size={18}
            color={colors.primary}
          />
        </View>
        <View style={styles.copy}>
          <View style={styles.topRow}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: colors.foreground }]}
            >
              {inAppBanner.title}
            </Text>
            <Text style={[styles.badge, { color: colors.primary }]}>
              ENCRYPTED · NOW
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.body, { color: colors.mutedForeground }]}
          >
            {inAppBanner.body}
          </Text>
        </View>
        <Pressable
          onPress={dismissInAppBanner}
          hitSlop={10}
          accessibilityLabel="Dismiss notification"
          style={styles.closeBtn}
        >
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 950,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  badge: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  body: {
    fontSize: 12,
    fontWeight: '500',
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
