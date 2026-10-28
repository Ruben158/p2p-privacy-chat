import React, { useMemo, useState } from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ConnectionBanner from '@/components/ConnectionBanner';
import { useColors } from '@/hooks/useColors';
import { useMessenger } from '@/context/MessengerContext';
import type { ChatMessage, Contact } from '@/lib/types';

type FilterKind = 'all' | 'online' | 'unread' | 'queued';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function previewText(content: { kind: string; text?: string }): string {
  if (content.kind === 'image') return '📷 Encrypted photo';
  if (content.kind === 'audio') return '🎙️ Encrypted voice note';
  return content.text ?? 'Encrypted message';
}

function formatChatTime(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const isToday =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { contacts, messages, connectionStatus, identity } = useMessenger();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKind>('all');

  const statsByContact = useMemo(() => {
    const latest = new Map<string, ChatMessage>();
    const unread = new Map<string, number>();
    const queued = new Map<string, number>();

    for (const message of messages) {
      latest.set(message.contactId, message);
      if (message.direction === 'incoming' && !message.readAt) {
        unread.set(message.contactId, (unread.get(message.contactId) ?? 0) + 1);
      }
      if (message.direction === 'outgoing' && message.status === 'queued') {
        queued.set(message.contactId, (queued.get(message.contactId) ?? 0) + 1);
      }
    }
    return { latest, unread, queued };
  }, [messages]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return [...contacts]
      .filter((contact) => {
        if (!contact.displayName.toLocaleLowerCase().includes(query)) {
          return false;
        }
        if (filter === 'online') {
          return connectionStatus[contact.id] === 'connected';
        }
        if (filter === 'unread') {
          return (statsByContact.unread.get(contact.id) ?? 0) > 0;
        }
        if (filter === 'queued') {
          return (statsByContact.queued.get(contact.id) ?? 0) > 0;
        }
        return true;
      })
      .sort((left, right) => {
        const leftTime =
          statsByContact.latest.get(left.id)?.createdAt ?? left.addedAt;
        const rightTime =
          statsByContact.latest.get(right.id)?.createdAt ?? right.addedAt;
        return rightTime - leftTime;
      });
  }, [contacts, connectionStatus, filter, search, statsByContact]);

  const safeTop = Math.max(insets.top, 16);

  const openContact = (contact: Contact) => {
    router.push({ pathname: '/chat/[id]', params: { id: contact.id } });
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const latest = statsByContact.latest.get(item.id);
    const unreadCount = statsByContact.unread.get(item.id) ?? 0;
    const queuedCount = statsByContact.queued.get(item.id) ?? 0;
    const status = connectionStatus[item.id] ?? 'searching';
    const isConnected = status === 'connected';

    return (
      <Pressable
        onPress={() => openContact(item)}
        style={({ pressed }) => [
          styles.contactCard,
          {
            backgroundColor: unreadCount > 0 ? '#112327' : colors.card,
            borderColor: isConnected
              ? 'rgba(16, 185, 129, 0.25)'
              : colors.border,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
        testID={`chat-${item.id}`}
      >
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.accentForeground }]}>
            {initials(item.displayName)}
          </Text>
          <View
            style={[
              styles.presenceDot,
              {
                backgroundColor: isConnected
                  ? colors.primary
                  : status === 'searching'
                    ? '#F59E0B'
                    : colors.mutedForeground,
                borderColor: colors.card,
              },
            ]}
          />
        </View>

        <View style={styles.contactCopy}>
          <View style={styles.nameLine}>
            <View style={styles.nameRow}>
              <Text
                numberOfLines={1}
                style={[styles.contactName, { color: colors.foreground }]}
              >
                {item.displayName}
              </Text>
              <View
                style={[
                  styles.peerBadge,
                  {
                    backgroundColor: isConnected
                      ? 'rgba(16, 185, 129, 0.14)'
                      : 'rgba(133, 158, 155, 0.12)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.peerBadgeText,
                    {
                      color: isConnected
                        ? colors.primary
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  {isConnected ? 'ONLINE' : 'STANDBY'}
                </Text>
              </View>
            </View>
            {latest ? (
              <Text
                style={[
                  styles.time,
                  {
                    color:
                      unreadCount > 0 ? colors.primary : colors.mutedForeground,
                    fontWeight: unreadCount > 0 ? '800' : '600',
                  },
                ]}
              >
                {formatChatTime(latest.createdAt)}
              </Text>
            ) : null}
          </View>

          <View style={styles.previewLine}>
            {latest?.direction === 'outgoing' ? (
              <Text
                style={[
                  styles.tick,
                  {
                    color:
                      latest.status === 'queued'
                        ? '#F59E0B'
                        : colors.primary,
                  },
                ]}
              >
                {latest.status === 'queued' ? '✓' : '✓✓'}
              </Text>
            ) : (
              <MaterialCommunityIcons
                name="lock-outline"
                size={12}
                color={colors.primary}
              />
            )}
            <Text
              numberOfLines={1}
              style={[
                styles.preview,
                {
                  color:
                    unreadCount > 0
                      ? colors.foreground
                      : colors.mutedForeground,
                  fontWeight: unreadCount > 0 ? '700' : '400',
                },
              ]}
            >
              {latest
                ? previewText(latest.content)
                : isConnected
                  ? 'Direct P2P tunnel connected · Say hello'
                  : 'Waiting for peer connection · Tap to message'}
            </Text>

            {unreadCount > 0 ? (
              <View
                style={[
                  styles.unreadBadge,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.unreadBadgeText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  {unreadCount}
                </Text>
              </View>
            ) : queuedCount > 0 ? (
              <View
                style={[
                  styles.queuedPill,
                  { borderColor: 'rgba(245, 158, 11, 0.35)' },
                ]}
              >
                <Text style={styles.queuedPillText}>{queuedCount} queued</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          { paddingTop: safeTop + 8, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.brandHeader}>
          <View style={[styles.brandBadge, { backgroundColor: colors.accent }]}>
            <MaterialCommunityIcons
              name="shield-check"
              size={18}
              color={colors.primary}
            />
          </View>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              END-TO-END ENCRYPTED · P2P
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Messages
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Add or scan contact"
            onPress={() => router.push('/(tabs)/contacts')}
            style={[
              styles.headerButton,
              { backgroundColor: colors.primary },
            ]}
          >
            <Feather
              name="user-plus"
              size={18}
              color={colors.primaryForeground}
            />
          </Pressable>
        </View>
      </View>

      <ConnectionBanner />

      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search encrypted chats…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
          accessibilityLabel="Search conversations"
        />
        {search ? (
          <Pressable
            onPress={() => setSearch('')}
            accessibilityLabel="Clear search"
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {(
          [
            { key: 'all', label: `All (${contacts.length})` },
            {
              key: 'online',
              label: `Online (${contacts.filter((c) => connectionStatus[c.id] === 'connected').length})`,
            },
            {
              key: 'unread',
              label: `Unread (${Array.from(statsByContact.unread.values()).reduce((a, b) => a + b, 0)})`,
            },
            {
              key: 'queued',
              label: `Queued (${Array.from(statsByContact.queued.values()).reduce((a, b) => a + b, 0)})`,
            },
          ] as Array<{ key: FilterKind; label: string }>
        ).map((pill) => {
          const active = filter === pill.key;
          return (
            <Pressable
              key={pill.key}
              onPress={() => setFilter(pill.key)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  {
                    color: active
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
                ]}
              >
                {pill.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Math.max(insets.bottom, 34) + 96 },
          filtered.length === 0 && styles.emptyList,
        ]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialCommunityIcons
                name="message-lock-outline"
                size={30}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {search || filter !== 'all'
                ? 'No matching conversations'
                : 'Start with someone you trust'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
              {search || filter !== 'all'
                ? 'Try clearing your search or switching the conversation filter above.'
                : 'Share your QR invite or scan a friend’s code. Messages travel directly device-to-device with zero servers.'}
            </Text>
            {!search && filter === 'all' ? (
              <Pressable
                onPress={() => router.push('/(tabs)/contacts')}
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              >
                <Feather name="plus" size={16} color={colors.primaryForeground} />
                <Text
                  style={[
                    styles.emptyButtonText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Add or Scan Contact
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <View
        style={[
          styles.footnote,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <MaterialCommunityIcons
          name="shield-lock-outline"
          size={14}
          color={colors.primary}
        />
        <Text style={[styles.footnoteText, { color: colors.mutedForeground }]}>
          {identity?.displayName ?? 'Local Node'} · Zero central storage · Ed25519 + X25519
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    paddingHorizontal: 18,
    paddingBottom: 13,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  brandBadge: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    marginHorizontal: 16,
    marginTop: 10,
  },
  searchInput: { flex: 1, fontSize: 13.5, paddingVertical: 0 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 8,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 9,
  },
  emptyList: { flexGrow: 1 },
  contactCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800' },
  presenceDot: {
    width: 13,
    height: 13,
    borderWidth: 2.5,
    borderRadius: 7,
    position: 'absolute',
    right: -2,
    bottom: -2,
  },
  contactCopy: { flex: 1, gap: 6 },
  nameLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
  },
  peerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  peerBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  time: { fontSize: 10.5 },
  previewLine: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  preview: { flex: 1, fontSize: 12.5 },
  tick: { fontSize: 12, fontWeight: '900', letterSpacing: -1 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  queuedPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  queuedPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#F59E0B',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 34,
    paddingVertical: 44,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyCopy: {
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  emptyButtonText: { fontSize: 13, fontWeight: '800' },
  footnote: {
    position: 'absolute',
    bottom: 88,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
  },
  footnoteText: { fontSize: 10, fontWeight: '700' },
});
