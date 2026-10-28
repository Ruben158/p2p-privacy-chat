import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useMessenger } from '@/context/MessengerContext';

interface ConnectionBannerProps {
  contactId?: string;
  compact?: boolean;
}

export default function ConnectionBanner({
  contactId,
  compact = false,
}: ConnectionBannerProps) {
  const colors = useColors();
  const {
    contacts,
    connectionStatus,
    nodeStatus,
    reconnecting,
    pendingOutboxCount,
    messages,
    reconnectAll,
    reconnectContact,
  } = useMessenger();

  const connectedPeersCount = contacts.filter(
    (c) => connectionStatus[c.id] === 'connected',
  ).length;

  const contact = contactId
    ? contacts.find((c) => c.id === contactId)
    : undefined;
  const peerStatus = contactId
    ? connectionStatus[contactId] ?? 'searching'
    : undefined;

  const contactQueuedCount = contactId
    ? messages.filter(
        (m) =>
          m.contactId === contactId &&
          m.direction === 'outgoing' &&
          m.status === 'queued',
      ).length
    : pendingOutboxCount;

  let dotColor = colors.primary;
  let badgeBg = 'rgba(16, 185, 129, 0.14)';
  let badgeBorder = 'rgba(16, 185, 129, 0.35)';
  let statusPillText = 'CONNECTED';
  let title = '';
  let subtitle = '';

  if (nodeStatus === 'offline') {
    dotColor = colors.destructive;
    badgeBg = 'rgba(239, 68, 68, 0.14)';
    badgeBorder = 'rgba(239, 68, 68, 0.35)';
    statusPillText = 'OFFLINE';
    title = 'Device Offline · Not Connected';
    subtitle = 'No network link — tap Sync to reconnect when back online';
  } else if (contactId && contact) {
    if (peerStatus === 'connected') {
      dotColor = colors.primary;
      badgeBg = 'rgba(16, 185, 129, 0.14)';
      badgeBorder = 'rgba(16, 185, 129, 0.35)';
      statusPillText = 'CONNECTED';
      title = `Connected directly to ${contact.displayName}`;
      subtitle =
        contactQueuedCount > 0
          ? `Flushing ${contactQueuedCount} queued message${contactQueuedCount === 1 ? '' : 's'}…`
          : 'Live end-to-end encrypted P2P tunnel active';
    } else {
      dotColor = '#F59E0B';
      badgeBg = 'rgba(245, 158, 11, 0.13)';
      badgeBorder = 'rgba(245, 158, 11, 0.35)';
      statusPillText = 'WAITING';
      title = `Not Connected to ${contact.displayName} Yet`;
      subtitle =
        contactQueuedCount > 0
          ? `${contactQueuedCount} message${contactQueuedCount === 1 ? '' : 's'} queued · Tap Sync if both apps are open`
          : 'Your app is online & listening — tap Sync to force handshake';
    }
  } else {
    if (contacts.length === 0) {
      dotColor = colors.primary;
      statusPillText = 'ONLINE';
      title = 'Device Online · P2P Node Ready';
      subtitle = 'Add a contact via QR code or invite link to start chatting';
    } else if (connectedPeersCount > 0) {
      dotColor = colors.primary;
      statusPillText = 'CONNECTED';
      title = `Connected · ${connectedPeersCount} of ${contacts.length} peer${contacts.length === 1 ? '' : 's'} live`;
      subtitle =
        pendingOutboxCount > 0
          ? `Delivering ${pendingOutboxCount} queued message${pendingOutboxCount === 1 ? '' : 's'}…`
          : 'Direct P2P WebRTC tunnel active & receiving messages';
    } else {
      dotColor = '#F59E0B';
      badgeBg = 'rgba(245, 158, 11, 0.13)';
      badgeBorder = 'rgba(245, 158, 11, 0.35)';
      statusPillText = 'SEARCHING';
      title = `Device Online · 0 of ${contacts.length} peers connected`;
      subtitle =
        pendingOutboxCount > 0
          ? `${pendingOutboxCount} message${pendingOutboxCount === 1 ? '' : 's'} queued · Tap Sync when your friend opens the app`
          : 'Listening for peers — tap Sync if your friend has the app open';
    }
  }

  const handleSync = () => {
    if (contactId) {
      void reconnectContact(contactId);
    } else {
      void reconnectAll();
    }
  };

  return (
    <View
      style={[
        styles.banner,
        compact && styles.bannerCompact,
        {
          backgroundColor: badgeBg,
          borderColor: badgeBorder,
        },
      ]}
    >
      <View style={styles.left}>
        <View style={[styles.dotOuter, { borderColor: dotColor }]}>
          <View style={[styles.dotInner, { backgroundColor: dotColor }]} />
        </View>
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <View
              style={[
                styles.stateBadge,
                { backgroundColor: dotColor },
              ]}
            >
              <Text style={styles.stateBadgeText}>{statusPillText}</Text>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: colors.foreground }]}
            >
              {title}
            </Text>
            {contactQueuedCount > 0 ? (
              <View
                style={[
                  styles.queueBadge,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={11}
                  color="#F59E0B"
                />
                <Text style={styles.queueBadgeText}>{contactQueuedCount}</Text>
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: colors.mutedForeground }]}
          >
            {subtitle}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={handleSync}
        disabled={reconnecting}
        accessibilityRole="button"
        accessibilityLabel="Sync P2P connection"
        style={({ pressed }) => [
          styles.syncButton,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed || reconnecting ? 0.7 : 1,
          },
        ]}
      >
        {reconnecting ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <Feather name="refresh-cw" size={12} color={colors.primary} />
            <Text style={[styles.syncText, { color: colors.primary }]}>Sync</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bannerCompact: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 13,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stateBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  stateBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#061012',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  queueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
  },
  queueBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },
  syncButton: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  syncText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
