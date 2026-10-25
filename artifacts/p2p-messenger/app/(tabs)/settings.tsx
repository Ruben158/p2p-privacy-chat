import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InviteQr from '@/components/InviteQr';
import { useColors } from '@/hooks/useColors';
import { useMessenger } from '@/context/MessengerContext';
import { decryptIdentityBackup, encryptIdentityBackup } from '@/lib/crypto';
import { makeInvite } from '@/lib/encoding';

type BackupMode = 'export' | 'import' | null;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { identity, restoreIdentity, wipe } = useMessenger();
  const [backupMode, setBackupMode] = useState<BackupMode>(null);
  const [passphrase, setPassphrase] = useState('');
  const [backupText, setBackupText] = useState('');
  const [resultText, setResultText] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const invite = identity ? makeInvite(identity) : '';

  const copy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1800);
  };

  const openBackup = (mode: Exclude<BackupMode, null>) => {
    setBackupMode(mode);
    setPassphrase('');
    setBackupText('');
    setResultText('');
  };

  const createBackup = async () => {
    if (!identity) return;
    setBusy(true);
    setResultText('');
    try {
      const encrypted = await encryptIdentityBackup(identity, passphrase);
      setBackupText(encrypted);
      setResultText('Encrypted backup ready. Store it somewhere safe; it cannot be opened without the passphrase.');
    } catch (error) {
      setResultText(error instanceof Error ? error.message : 'Backup could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const importBackup = async () => {
    setBusy(true);
    setResultText('');
    try {
      const restored = await decryptIdentityBackup(backupText, passphrase);
      await restoreIdentity(restored);
      setResultText(`Identity restored as ${restored.displayName}.`);
    } catch (error) {
      setResultText(error instanceof Error ? error.message : 'Backup could not be restored.');
    } finally {
      setBusy(false);
    }
  };

  const confirmWipe = () => {
    Alert.alert(
      'Wipe local data?',
      'This permanently removes your identity keys, contacts, chat history, and queued messages from this device. It cannot be undone without an exported identity backup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe this device',
          style: 'destructive',
          onPress: () => {
            void wipe().catch((error: unknown) =>
              Alert.alert(
                'Could not wipe data',
                error instanceof Error
                  ? error.message
                  : 'Close other open app tabs, then try again.',
              ),
            );
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) + 10, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>ON THIS DEVICE</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Privacy</Text>
        </View>
        <View style={[styles.shield, { backgroundColor: colors.accent }]}>
          <MaterialCommunityIcons name="shield-lock-outline" size={21} color={colors.primary} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 17, paddingBottom: Math.max(insets.bottom, 34) + 92 }}
        showsVerticalScrollIndicator={false}
      >
        {identity ? (
          <View style={[styles.identityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.identityTitleRow}>
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={[styles.avatarLetter, { color: colors.accentForeground }]}>
                  {identity.displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.identityName}>
                <Text style={[styles.name, { color: colors.foreground }]}>{identity.displayName}</Text>
                <Text style={[styles.local, { color: colors.mutedForeground }]}>Local identity · no account</Text>
              </View>
              <Pressable
                onPress={() => void copy(identity.signPublic, 'peer')}
                accessibilityLabel="Copy public peer key"
                style={[styles.copyIcon, { backgroundColor: colors.secondary }]}
              >
                <Feather name={copied === 'peer' ? 'check' : 'copy'} size={16} color={colors.foreground} />
              </Pressable>
            </View>
            <Text style={[styles.keyLabel, { color: colors.mutedForeground }]}>PUBLIC PEER KEY</Text>
            <Text selectable numberOfLines={2} style={[styles.keyText, { color: colors.foreground }]}>
              {identity.signPublic}
            </Text>
            <View style={[styles.qrBlock, { borderColor: colors.border }]}>
              <InviteQr value={invite} size={186} />
              <Text style={[styles.qrTitle, { color: colors.foreground }]}>Your contact invite</Text>
              <Text style={[styles.qrCopy, { color: colors.mutedForeground }]}>
                Let someone scan this QR to add you.
              </Text>
              <Pressable
                onPress={() => void copy(invite, 'invite')}
                style={[styles.copyInvite, { backgroundColor: colors.secondary }]}
              >
                <Feather name={copied === 'invite' ? 'check' : 'link'} size={15} color={colors.primary} />
                <Text style={[styles.copyInviteText, { color: colors.foreground }]}>
                  {copied === 'invite' ? 'Invite copied' : 'Copy invite link'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={[styles.section, { color: colors.mutedForeground }]}>IDENTITY & BACKUP</Text>
        <Pressable
          onPress={() => openBackup('export')}
          style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.accent }]}>
            <Feather name="download" size={17} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Export identity backup</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Encrypt your keys with a passphrase</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => openBackup('import')}
          style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 9 }]}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.accent }]}>
            <Feather name="upload" size={17} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>Import identity backup</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Restore your existing peer identity</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>

        <Text style={[styles.section, { color: colors.mutedForeground, marginTop: 24 }]}>HOW PRIVACY WORKS</Text>
        <View style={[styles.privacyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.privacyRow}>
            <MaterialCommunityIcons name="lock-check-outline" size={19} color={colors.primary} />
            <Text style={[styles.privacyText, { color: colors.foreground }]}>
              Messages are encrypted to your contact’s public key and signed by your local identity.
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.privacyRow}>
            <MaterialCommunityIcons name="transit-connection-variant" size={19} color={colors.primary} />
            <Text style={[styles.privacyText, { color: colors.foreground }]}>
              Nostr relays and BitTorrent trackers help devices find one another; they do not store chat history.
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.privacyRow}>
            <MaterialCommunityIcons name="cloud-off-outline" size={19} color={colors.primary} />
            <Text style={[styles.privacyText, { color: colors.foreground }]}>
              If a peer is offline, your encrypted outbox stays on this device. It sends when a direct link returns.
            </Text>
          </View>
        </View>
        <Text style={[styles.warning, { color: colors.mutedForeground }]}>
          Signaling services can observe connection metadata. Network restrictions may prevent a direct connection; this app does not use a central message relay.
        </Text>

        <Text style={[styles.section, { color: colors.destructive, marginTop: 24 }]}>DANGER ZONE</Text>
        <Pressable
          onPress={confirmWipe}
          style={[styles.wipeRow, { backgroundColor: colors.card, borderColor: colors.destructive }]}
        >
          <View style={[styles.rowIcon, { backgroundColor: '#381E22' }]}>
            <Feather name="trash-2" size={17} color={colors.destructive} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.destructive }]}>Wipe local data</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Erase keys, contacts, history and outbox</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.destructive} />
        </Pressable>
        <Text style={[styles.version, { color: colors.mutedForeground }]}>P2P Messenger · open source · local-first</Text>
      </ScrollView>

      <Modal
        visible={backupMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setBackupMode(null)}
      >
        <View style={[styles.modalShade, { backgroundColor: 'rgba(0,0,0,0.72)' }]}>
          <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {backupMode === 'export' ? 'Export identity backup' : 'Import identity backup'}
                </Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground, marginTop: 5 }]}>
                  {backupMode === 'export' ? 'Your private keys are encrypted before export.' : 'Restoring replaces the current local identity.'}
                </Text>
              </View>
              <Pressable onPress={() => setBackupMode(null)} accessibilityLabel="Close backup">
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {backupMode === 'import' ? (
              <TextInput
                value={backupText}
                onChangeText={setBackupText}
                placeholder="Paste encrypted backup JSON"
                placeholderTextColor={colors.mutedForeground}
                multiline
                autoCapitalize="none"
                style={[styles.backupInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              />
            ) : null}
            <TextInput
              value={passphrase}
              onChangeText={setPassphrase}
              placeholder="Backup passphrase (10+ characters)"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              style={[styles.passInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            />
            {backupMode === 'export' ? (
              <>
                <Pressable
                  onPress={() => void createBackup()}
                  disabled={busy || passphrase.length < 10}
                  style={[styles.modalAction, { backgroundColor: colors.primary, opacity: busy || passphrase.length < 10 ? 0.55 : 1 }]}
                >
                  {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.modalActionText, { color: colors.primaryForeground }]}>Create encrypted backup</Text>}
                </Pressable>
                {backupText ? (
                  <>
                    <TextInput
                      value={backupText}
                      editable={false}
                      multiline
                      style={[styles.backupOutput, { color: colors.mutedForeground, backgroundColor: colors.background, borderColor: colors.border }]}
                    />
                    <Pressable
                      onPress={() => void copy(backupText, 'backup')}
                      style={[styles.modalAction, { backgroundColor: colors.secondary }]}
                    >
                      <Text style={[styles.modalActionText, { color: colors.foreground }]}>
                        {copied === 'backup' ? 'Backup copied' : 'Copy backup'}
                      </Text>
                    </Pressable>
                  </>
                ) : null}
              </>
            ) : (
              <Pressable
                onPress={() => void importBackup()}
                disabled={busy || !backupText.trim() || !passphrase}
                style={[styles.modalAction, { backgroundColor: colors.primary, opacity: busy || !backupText.trim() || !passphrase ? 0.55 : 1 }]}
              >
                {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.modalActionText, { color: colors.primaryForeground }]}>Restore identity</Text>}
              </Pressable>
            )}
            {resultText ? <Text style={[styles.result, { color: resultText.includes('could not') || resultText.includes('Check') ? colors.destructive : colors.primary }]}>{resultText}</Text> : null}
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
  shield: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  identityCard: { borderWidth: 1, borderRadius: 22, padding: 17 },
  identityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '800' },
  identityName: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontWeight: '800' },
  local: { fontSize: 11 },
  copyIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  keyLabel: { fontSize: 9, letterSpacing: 1.4, fontWeight: '800', marginTop: 17, marginBottom: 5 },
  keyText: { fontSize: 11, lineHeight: 17, fontFamily: 'monospace' },
  qrBlock: { alignItems: 'center', borderTopWidth: 1, marginTop: 17, paddingTop: 17 },
  qrTitle: { marginTop: 13, fontSize: 14, fontWeight: '800' },
  qrCopy: { marginTop: 4, fontSize: 11 },
  copyInvite: { marginTop: 13, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
  copyInviteText: { fontSize: 12, fontWeight: '700' },
  section: { fontSize: 10, letterSpacing: 1.4, fontWeight: '800', marginTop: 23, marginBottom: 9 },
  row: { borderWidth: 1, borderRadius: 17, minHeight: 70, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 13, fontWeight: '700' },
  rowSub: { fontSize: 10, lineHeight: 15 },
  privacyCard: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14 },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 14 },
  privacyText: { flex: 1, fontSize: 11, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth },
  warning: { fontSize: 10, lineHeight: 16, marginTop: 10, paddingHorizontal: 3 },
  wipeRow: { borderWidth: 1, borderRadius: 17, minHeight: 70, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  version: { textAlign: 'center', fontSize: 10, marginTop: 22 },
  modalShade: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: 21, paddingTop: 23, gap: 12, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 5 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  passInput: { height: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 13 },
  backupInput: { height: 125, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, paddingTop: 12, textAlignVertical: 'top', fontSize: 11 },
  backupOutput: { height: 110, borderWidth: 1, borderRadius: 14, padding: 12, textAlignVertical: 'top', fontSize: 10 },
  modalAction: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  modalActionText: { fontSize: 13, fontWeight: '800' },
  result: { fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 1 },
});
