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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const { identity, contacts, connectionStatus, addContact, removeContact } = useMessenger();
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
        contact.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
      ),
    [contacts, search],
  );

  const addFromText = useCallback(
    async (value: string) => {
      setError(null);
      try {
        const identity = parseInvite(value);
        const contact = await addContact(identity);
        setInvite('');
        setScannerOpen(false);
        setModalOpen(false);
        router.push({ pathname: '/chat/[id]', params: { id: contact.id } });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'This invite could not be added.');
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
      Alert.alert('Copy unavailable', 'You can scan the QR code directly from this screen.');
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

  const renderContact = ({ item }: { item: Contact }) => (
    <View style={[styles.contactRow, { borderBottomColor: colors.border }]}>
      <Pressable
        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
        style={styles.contactMain}
      >
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.accentForeground }]}>
            {avatarText(item.displayName)}
          </Text>
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
            {item.displayName}
          </Text>
          <Text style={[styles.status, { color: colors.mutedForeground }]}>
            {connectionStatus[item.id] === 'connected'
              ? 'Direct connection ready'
              : 'Peer ID · ' + item.signPublic.slice(0, 9) + '…'}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={`Remove ${item.displayName}`}
        onPress={() => confirmRemove(item)}
        style={styles.removeButton}
      >
        <Feather name="user-minus" size={17} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 18) + 10,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR TRUSTED CIRCLE</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Contacts</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Show my invite QR code"
            onPress={() => setMyQrOpen(true)}
            style={styles.qrButton}
          >
            <MaterialCommunityIcons name="qrcode" size={22} color={colors.primary} />
          </Pressable>
          <Pressable
            accessibilityLabel="Add a contact"
            onPress={() => { setError(null); setModalOpen(true); }}
            style={[styles.addButton, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={20} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Find a contact"
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
          { paddingBottom: Math.max(insets.bottom, 34) + 90 },
          filtered.length === 0 && styles.emptyList,
        ]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-multiple-outline" size={34} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {search ? 'No contacts found' : 'Your circle starts here'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Add someone with their invite link or scan the QR code they share with you.
            </Text>
            {!search ? (
              <Pressable onPress={() => setModalOpen(true)} style={[styles.emptyAction, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Add your first contact</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => { setModalOpen(false); setScannerOpen(false); }}
      >
        <View style={[styles.modalShade, { backgroundColor: 'rgba(0,0,0,0.72)' }]}>
          <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 20) + 18 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {scannerOpen ? 'Scan invite QR' : 'Add a contact'}
                </Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                  {scannerOpen ? 'Scan a contact’s P2P invite.' : 'Only add keys shared by someone you trust.'}
                </Text>
              </View>
              <Pressable onPress={() => { setModalOpen(false); setScannerOpen(false); }} accessibilityLabel="Close">
                <Feather name="x" size={21} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {scannerOpen ? (
              <QrScanner onScan={handleScan} onClose={closeScanner} />
            ) : (
              <>
                <Pressable
                  onPress={() => setScannerOpen(true)}
                  style={[styles.scanButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                >
                  <MaterialCommunityIcons name="qrcode-scan" size={20} color={colors.primary} />
                  <Text style={[styles.scanText, { color: colors.foreground }]}>Scan a QR invite</Text>
                  <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
                </Pressable>
                <View style={styles.orRow}>
                  <View style={[styles.rule, { backgroundColor: colors.border }]} />
                  <Text style={[styles.orText, { color: colors.mutedForeground }]}>OR PASTE INVITE</Text>
                  <View style={[styles.rule, { backgroundColor: colors.border }]} />
                </View>
                <TextInput
                  value={invite}
                  onChangeText={(value) => { setInvite(value); setError(null); }}
                  placeholder="p2pmsg://invite/…"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  style={[styles.inviteInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  accessibilityLabel="Paste a P2P invite"
                />
                <Text style={[styles.tip, { color: colors.mutedForeground }]}>
                  Invite links include the public signing and encryption keys. A short peer ID by itself is not enough to start an encrypted chat.
                </Text>
                <Pressable
                  onPress={() => void addFromText(invite)}
                  disabled={!invite.trim()}
                  style={[styles.submit, { backgroundColor: colors.primary, opacity: invite.trim() ? 1 : 0.45 }]}
                >
                  <Text style={[styles.submitText, { color: colors.primaryForeground }]}>Add and open chat</Text>
                </Pressable>
              </>
            )}
            {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={myQrOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMyQrOpen(false)}
      >
        <View style={[styles.modalShade, { backgroundColor: 'rgba(0,0,0,0.72)' }]}>
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
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Your invite QR</Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                  Let a friend scan this to add you.
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
                The invite contains your signed public keys. Your private keys are never shared.
              </Text>
              <Pressable
                onPress={() => void copyMyInvite()}
                style={[styles.submit, { backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.submitText, { color: colors.foreground }]}>
                  {inviteCopied ? 'Invite link copied' : 'Copy invite link'}
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
  header: { paddingHorizontal: 22, paddingBottom: 15, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.7, marginBottom: 3 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  addButton: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qrButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 20, marginTop: 17, height: 46, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  searchInput: { flex: 1, paddingVertical: 0, fontSize: 14 },
  list: { paddingHorizontal: 20 },
  emptyList: { flexGrow: 1 },
  contactRow: { minHeight: 82, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center' },
  contactMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12 },
  avatar: { width: 50, height: 50, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  copy: { flex: 1, gap: 5 },
  name: { fontSize: 15, fontWeight: '700' },
  status: { fontSize: 11 },
  removeButton: { width: 40, height: 46, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  emptyTitle: { fontSize: 19, fontWeight: '800', marginTop: 14 },
  emptyText: { textAlign: 'center', fontSize: 13, lineHeight: 20, marginTop: 8 },
  emptyAction: { paddingHorizontal: 17, paddingVertical: 13, borderRadius: 14, marginTop: 20 },
  modalShade: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: 22, paddingTop: 24, gap: 14, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 },
  modalTitle: { fontSize: 21, fontWeight: '800' },
  modalSub: { fontSize: 12, marginTop: 5 },
  scanButton: { height: 54, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  scanText: { flex: 1, fontWeight: '700', fontSize: 14 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  inviteInput: { minHeight: 88, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, textAlignVertical: 'top', fontSize: 12 },
  tip: { fontSize: 11, lineHeight: 17, marginTop: -5 },
  submit: { minHeight: 51, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 14, fontWeight: '800' },
  myQrBody: { alignItems: 'center', gap: 12, paddingTop: 5 },
  qrName: { fontSize: 17, fontWeight: '800' },
  error: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
