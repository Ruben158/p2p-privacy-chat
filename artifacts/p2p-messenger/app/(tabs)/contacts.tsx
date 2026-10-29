import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@/components/AppIcons';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConnectionBanner from '@/components/ConnectionBanner';
import InviteQr from '@/components/InviteQr';
import QrScanner from '@/components/QrScanner';
import { useColors } from '@/hooks/useColors';
import { useMessenger } from '@/context/MessengerContext';
import { makeInvite, parseInvite } from '@/lib/encoding';
import type { Contact } from '@/lib/types';

function avatarText(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ContactsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    identity,
    contacts,
    connectionStatus,
    addContact,
    removeContact,
    reconnectContact,
  } = useMessenger();
  const [modalOpen, setModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [myQrOpen, setMyQrOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [invite, setInvite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const myInvite = identity ? makeInvite(identity) : '';

  const filtered = useMemo(
    () =>
      contacts.filter((contact) =>
        contact.displayName
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
      ),
    [contacts, search],
  );

  const addFromText = useCallback(
    async (value: string) => {
      setError(null);
      try {
        const parsed = parseInvite(value);
        const contact = await addContact(parsed);
        setInvite('');
        setScannerOpen(false);
        setModalOpen(false);
        router.push({ pathname: '/chat/[id]', params: { id: contact.id } });
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'This invite could not be added.',
        );
      }
    },
    [addContact],
  );

  const handleScan = useCallback(
    (value: string) => void addFromText(value),
    [addFromText],
  );
  const closeScanner = useCallback(() => setScannerOpen(false), []);

  const copyMyInvite = async () => {
    try {
      await Clipboard.setStringAsync(myInvite);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1800);
    } catch {
      Alert.alert(
        'Copy unavailable',
        'You can scan the QR code directly from this screen.',
      );
    }
  };

  const confirmRemove = (contact: Contact) => {
    Alert.alert(
      'Remove contact?',
      `${contact.displayName} and the chat history on this device will be removed.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void removeContact(contact.id),
        },
      ],
    );
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const status = connectionStatus[item.id] ?? 'searching';
    const isConnected = status === 'connected';
    return (
      <View
        style={[
          styles.contactCard,
          {
            backgroundColor: colors.card,
            borderColor: isConnected
              ? 'rgba(16, 185, 129, 0.25)'
              : colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() =>
            router.push({ pathname: '/chat/[id]', params: { id: item.id } })
          }
          style={styles.contactMain}
        >
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={[styles.avatarText, { color: colors.accentForeground }]}>
              {avatarText(item.displayName)}
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
          <View style={styles.copy}>
            <View style={styles.nameRow}>
              <Text
                numberOfLines={1}
                style={[styles.name, { color: colors.foreground }]}
              >
                {item.displayName}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isConnected
                      ? 'rgba(16, 185, 129, 0.14)'
                      : 'rgba(245, 158, 11, 0.12)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: isConnected ? colors.primary : '#F59E0B' },
                  ]}
                >
                  {isConnected ? 'DIRECT P2P' : 'LISTENING'}
                </Text>
              </View>
            </View>
            <Text style={[styles.status, { color: colors.mutedForeground }]}>
              {isConnected
                ? 'Encrypted tunnel active · Tap to message'
                : 'Key ID · ' + item.signPublic.slice(0, 12) + '…'}
            </Text>
          </View>
        </Pressable>

        {!isConnected ? (
          <Pressable
            accessibilityLabel={`Ping ${item.displayName}`}
            onPress={() => void reconnectContact(item.id)}
            style={[
              styles.actionIconBtn,
              { backgroundColor: colors.secondary },
            ]}
          >
            <Feather name="refresh-cw" size={14} color={colors.primary} />
          </Pressable>
        ) : null}

        <Pressable
          accessibilityLabel={`Remove ${item.displayName}`}
          onPress={() => confirmRemove(item)}
          style={styles.removeButton}
        >
          <Feather name="user-minus" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16) + 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            VERIFIED PEER DIRECTORY
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Contacts
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Show my invite QR code"
            onPress={() => setMyQrOpen(true)}
            style={[
              styles.qrButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <MaterialCommunityIcons
              name="qrcode"
              size={20}
              color={colors.primary}
            />
          </Pressable>
          <Pressable
            accessibilityLabel="Add a contact"
            onPress={() => {
              setError(null);
              setModalOpen(true);
            }}
            style={[styles.addButton, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={20} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </View>

      <ConnectionBanner />

      <View
        style={[
          styles.search,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search trusted peers…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderContact}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Math.max(insets.bottom, 34) + 92 },
          filtered.length === 0 && styles.emptyList,
        ]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <MaterialCommunityIcons
                name="account-multiple-outline"
                size={32}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {search ? 'No contacts found' : 'Your trusted circle starts here'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Add someone with their invite link or scan the QR code they share
              with you. Both peers should add each other so the encrypted tunnel
              authenticates both ways.
            </Text>
            {!search ? (
              <View style={styles.emptyButtonsRow}>
                <Pressable
                  onPress={() => setModalOpen(true)}
                  style={[
                    styles.emptyAction,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Feather
                    name="user-plus"
                    size={15}
                    color={colors.primaryForeground}
                  />
                  <Text
                    style={{
                      color: colors.primaryForeground,
                      fontWeight: '800',
                      fontSize: 13,
                    }}
                  >
                    Add Contact
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMyQrOpen(true)}
                  style={[
                    styles.emptyAction,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="qrcode"
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: '800',
                      fontSize: 13,
                    }}
                  >
                    My Invite QR
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
      />

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setModalOpen(false);
          setScannerOpen(false);
        }}
      >
        <View
          style={[styles.modalShade, { backgroundColor: 'rgba(0,0,0,0.75)' }]}
        >
          <View
            style={[
              styles.modal,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 20) + 18,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {scannerOpen ? 'Scan invite QR' : 'Add a contact'}
                </Text>
                <Text
                  style={[styles.modalSub, { color: colors.mutedForeground }]}
                >
                  {scannerOpen
                    ? 'Scan a contact’s P2P invite.'
                    : 'Exchange invites both ways so both devices authenticate.'}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setModalOpen(false);
                  setScannerOpen(false);
                }}
                accessibilityLabel="Close"
              >
                <Feather name="x" size={21} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {scannerOpen ? (
              <QrScanner onScan={handleScan} onClose={closeScanner} />
            ) : (
              <>
                <Pressable
                  onPress={() => setScannerOpen(true)}
                  style={[
                    styles.scanButton,
                    {
                      backgroundColor: colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="qrcode-scan"
                    size={20}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.scanText, { color: colors.foreground }]}
                  >
                    Scan a QR invite
                  </Text>
                  <Feather
                    name="arrow-up-right"
                    size={16}
                    color={colors.mutedForeground}
                  />
                </Pressable>
                <View style={styles.orRow}>
                  <View
                    style={[styles.rule, { backgroundColor: colors.border }]}
                  />
                  <Text
                    style={[styles.orText, { color: colors.mutedForeground }]}
                  >
                    OR PASTE INVITE LINK
                  </Text>
                  <View
                    style={[styles.rule, { backgroundColor: colors.border }]}
                  />
                </View>
                <TextInput
                  value={invite}
                  onChangeText={(value) => {
                    setInvite(value);
                    setError(null);
                  }}
                  placeholder="p2pmsg://invite/…"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  style={[
                    styles.inviteInput,
                    {
                      color: colors.foreground,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                  accessibilityLabel="Paste a P2P invite"
                />
                <Text style={[styles.tip, { color: colors.mutedForeground }]}>
                  Make sure your friend also scans your QR or pastes your invite
                  link so both devices recognize each other’s keys.
                </Text>
                <Pressable
                  onPress={() => void addFromText(invite)}
                  disabled={!invite.trim()}
                  style={[
                    styles.submit,
                    {
                      backgroundColor: colors.primary,
                      opacity: invite.trim() ? 1 : 0.45,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.submitText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    Add and open chat
                  </Text>
                </Pressable>
              </>
            )}
            {error ? (
              <Text style={[styles.error, { color: colors.destructive }]}>
                {error}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={myQrOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMyQrOpen(false)}
      >
        <View
          style={[styles.modalShade, { backgroundColor: 'rgba(0,0,0,0.75)' }]}
        >
          <View
            style={[
              styles.modal,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 20) + 18,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Your invite QR
                </Text>
                <Text
                  style={[styles.modalSub, { color: colors.mutedForeground }]}
                >
                  Let your friend scan this to add you.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close invite QR"
                onPress={() => setMyQrOpen(false)}
              >
                <Feather name="x" size={21} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <View style={styles.myQrBody}>
              <InviteQr value={myInvite} size={210} />
              <Text style={[styles.qrName, { color: colors.foreground }]}>
                {identity?.displayName ?? 'P2P Messenger'}
              </Text>
              <Text style={[styles.tip, { color: colors.mutedForeground }]}>
                Contains your signed public keys. Your private keys never leave
                this device.
              </Text>
              <Pressable
                onPress={() => void copyMyInvite()}
                style={[styles.submit, { backgroundColor: colors.primary }]}
              >
                <Text
                  style={[
                    styles.submitText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  {inviteCopied ? 'Invite link copied ✓' : 'Copy invite link'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 13,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 1,
  },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qrButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, paddingVertical: 0, fontSize: 13.5 },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 9 },
  emptyList: { flexGrow: 1 },
  contactCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 17,
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
  copy: { flex: 1, gap: 5 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  name: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  status: { fontSize: 11.5 },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 44,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 15 },
  emptyText: {
    textAlign: 'center',
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 8,
  },
  emptyButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  emptyAction: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  modalShade: { flex: 1, justifyContent: 'flex-end' },
  modal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    gap: 14,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  modalTitle: { fontSize: 21, fontWeight: '800' },
  modalSub: { fontSize: 12, marginTop: 5 },
  scanButton: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scanText: { flex: 1, fontWeight: '700', fontSize: 14 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  inviteInput: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
    fontSize: 12,
  },
  tip: { fontSize: 11, lineHeight: 17, marginTop: -4, textAlign: 'center' },
  submit: {
    minHeight: 51,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  submitText: { fontSize: 14, fontWeight: '800' },
  myQrBody: { alignItems: 'center', gap: 12, paddingTop: 5 },
  qrName: { fontSize: 17, fontWeight: '800' },
  error: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
