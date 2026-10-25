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
import { useColors } from '@/hooks/useColors';
import { useMessenger } from '@/context/MessengerContext';
import type { Contact } from '@/lib/types';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function previewText(content: { kind: string; text?: string }): string {
  if (content.kind === 'image') return 'Photo';
  if (content.kind === 'audio') return 'Voice note';
  return content.text ?? 'Encrypted message';
}

export default function ChatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { contacts, messages, connectionStatus, identity } = useMessenger();
  const [search, setSearch] = useState('');
  const latestByContact = useMemo(() => {
    const latest = new Map<string, (typeof messages)[number]>();
    for (const message of messages) latest.set(message.contactId, message);
    return latest;
  }, [messages]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return [...contacts]
      .filter((contact) => contact.displayName.toLocaleLowerCase().includes(query))
      .sort((left, right) => {
        const leftTime = latestByContact.get(left.id)?.createdAt ?? left.addedAt;
        const rightTime = latestByContact.get(right.id)?.createdAt ?? right.addedAt;
        return rightTime - leftTime;
      });
  }, [contacts, latestByContact, search]);
  const safeTop = Math.max(insets.top, 18);

  const openContact = (contact: Contact) => {
    router.push({ pathname: '/chat/[id]', params: { id: contact.id } });
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const latest = latestByContact.get(item.id);
    const status = connectionStatus[item.id] ?? 'searching';
    return (
      <Pressable
        onPress={() => openContact(item)}
        style={({ pressed }) => [
          styles.contactRow,
          { borderBottomColor: colors.border, opacity: pressed ? 0.72 : 1 },
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
                backgroundColor:
                  status === 'connected' ? colors.primary : colors.mutedForeground,
                borderColor: colors.background,
              },
            ]}
          />
        </View>
        <View style={styles.contactCopy}>
          <View style={styles.nameLine}>
            <Text
              numberOfLines={1}
              style={[styles.contactName, { color: colors.foreground }]}
            >
              {item.displayName}
            </Text>
            {latest ? (
              <Text style={[styles.time, { color: colors.mutedForeground }]}>
                {new Date(latest.createdAt).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
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
                        ? colors.mutedForeground
                        : colors.primary,
                  },
                ]}
              >
                {latest.status === 'queued' ? '✓' : '✓✓'}
              </Text>
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.preview, { color: colors.mutedForeground }]}
            >
              {latest
                ? previewText(latest.content)
                : status === 'connected'
                  ? 'Direct connection ready'
                  : 'Tap to start a private chat'}
            </Text>
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
          { paddingTop: safeTop + 10, borderBottomColor: colors.border },
        ]}
      >
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            PRIVATE BY DEFAULT
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Chats</Text>
        </View>
        <Pressable
          accessibilityLabel="Add contact"
          onPress={() => router.push('/(tabs)/contacts')}
          style={[styles.headerButton, { backgroundColor: colors.secondary }]}
        >
          <Feather name="user-plus" size={19} color={colors.foreground} />
        </Pressable>
      </View>

      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={17} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations"
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
            <Feather name="x" size={17} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          YOUR CONVERSATIONS
        </Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {filtered.length}
        </Text>
      </View>

      <FlatList
        data={filtered}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Math.max(insets.bottom, 34) + 90 },
          filtered.length === 0 && styles.emptyList,
        ]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
              <MaterialCommunityIcons
                name="message-lock-outline"
                size={30}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {search ? 'No matches' : 'Start with someone you trust'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
              {search
                ? 'Try another name.'
                : 'Share your invite or scan a friend’s QR. Messages travel directly between devices.'}
            </Text>
            {!search ? (
              <Pressable
                onPress={() => router.push('/(tabs)/contacts')}
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              >
                <Text
                  style={[
                    styles.emptyButtonText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Add a contact
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
          name="shield-check-outline"
          size={16}
          color={colors.primary}
        />
        <Text style={[styles.footnoteText, { color: colors.mutedForeground }]}>
          {identity?.displayName ?? 'Your device'} · no central message storage
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    paddingHorizontal: 22,
    paddingBottom: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.7, marginBottom: 3 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginTop: 17,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  sectionRow: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionLabel: { fontSize: 10, letterSpacing: 1.4, fontWeight: '800' },
  count: { fontSize: 11, fontWeight: '700' },
  list: { paddingHorizontal: 18 },
  emptyList: { flexGrow: 1 },
  contactRow: {
    minHeight: 82,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800' },
  presenceDot: {
    width: 12,
    height: 12,
    borderWidth: 2,
    borderRadius: 7,
    position: 'absolute',
    right: -1,
    bottom: -1,
  },
  contactCopy: { flex: 1, gap: 7 },
  nameLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  contactName: { flex: 1, fontSize: 15, fontWeight: '700' },
  time: { fontSize: 10 },
  previewLine: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  preview: { flex: 1, fontSize: 12 },
  tick: { fontSize: 12, fontWeight: '800' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingVertical: 50,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  emptyCopy: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 9,
  },
  emptyButton: { marginTop: 20, paddingHorizontal: 19, paddingVertical: 13, borderRadius: 14 },
  emptyButtonText: { fontSize: 13, fontWeight: '800' },
  footnote: {
    position: 'absolute',
    bottom: 92,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 99,
    borderWidth: 1,
  },
  footnoteText: { fontSize: 10, fontWeight: '600' },
});
