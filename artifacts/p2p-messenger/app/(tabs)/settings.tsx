import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConnectionBanner from '@/components/ConnectionBanner';
import InviteQr from '@/components/InviteQr';
import { useColors } from '@/hooks/useColors';
import { useMessenger } from '@/context/MessengerContext';
import { decryptIdentityBackup, encryptIdentityBackup } from '@/lib/crypto';
import { makeInvite } from '@/lib/encoding';
import { playNotificationChime } from '@/lib/notifications';

type BackupMode = 'export' | 'import' | null;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    identity,
    contacts,
    connectionStatus,
    nodeStatus,
    reconnecting,
    preferences,
    notificationPermission,
    updatePreferences,
    requestNotifications,
    reconnectAll,
    restoreIdentity,
    wipe,
  } = useMessenger();

  const [backupMode, setBackupMode] = useState<BackupMode>(null);
  const [passphrase, setPassphrase] = useState('');
  const [backupText, setBackupText] = useState('');
  const [resultText, setResultText] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const invite = identity ? makeInvite(identity) : '';
  const connectedCount = contacts.filter(
    (c) => connectionStatus[c.id] === 'connected',
  ).length;

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
      setResultText(
        'Encrypted backup ready. Store it somewhere safe; it cannot be opened without the passphrase.',
      );
    } catch (error) {
      setResultText(
        error instanceof Error ? error.message : 'Backup could not be created.',
      );
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
      setResultText(
        error instanceof Error ? error.message : 'Backup could not be restored.',
      );
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

  const handleToggleNotifications = async (nextValue: boolean) => {
    if (nextValue && notificationPermission !== 'granted') {
      const granted = await requestNotifications();
      if (!granted && notificationPermission === 'denied') {
        Alert.alert(
          'Notifications blocked',
          'Allow notification permission in your browser or Android App Info settings to receive background alerts.',
        );
      }
    }
    await updatePreferences({ notificationsEnabled: nextValue });
  };

  const handleToggleSound = async (nextValue: boolean) => {
    await updatePreferences({ soundEnabled: nextValue });
    if (nextValue) {
      playNotificationChime('message');
    }
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
            NODE & PRIVACY CONTROLS
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Settings
          </Text>
        </View>
        <View style={[styles.shield, { backgroundColor: colors.accent }]}>
          <MaterialCommunityIcons
            name="shield-lock-outline"
            size={20}
            color={colors.primary}
          />
        </View>
      </View>

      <ConnectionBanner />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: Math.max(insets.bottom, 34) + 96,
        }}
        showsVerticalScrollIndicator={false}
      >
        {identity ? (
          <View
            style={[
              styles.identityCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.identityTitleRow}>
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text
                  style={[styles.avatarLetter, { color: colors.accentForeground }]}
                >
                  {identity.displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.identityName}>
                <View style={styles.nameBadgeRow}>
                  <Text style={[styles.name, { color: colors.foreground }]}>
                    {identity.displayName}
                  </Text>
                  <View
                    style={[
                      styles.nodeBadge,
                      { backgroundColor: 'rgba(16, 185, 129, 0.14)' },
                    ]}
                  >
                    <Text style={[styles.nodeBadgeText, { color: colors.primary }]}>
                      LOCAL NODE
                    </Text>
                  </View>
                </View>
                <Text style={[styles.local, { color: colors.mutedForeground }]}>
                  Ed25519 + X25519 identity · Zero server account
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.keyBox,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.keyHeaderRow}>
                <Text style={[styles.keyLabel, { color: colors.mutedForeground }]}>
                  PUBLIC SIGNING KEY
                </Text>
                <Pressable
                  onPress={() => void copy(identity.signPublic, 'peer')}
                  style={styles.copyInlineBtn}
                >
                  <Feather
                    name={copied === 'peer' ? 'check' : 'copy'}
                    size={12}
                    color={colors.primary}
                  />
                  <Text style={[styles.copyInlineText, { color: colors.primary }]}>
                    {copied === 'peer' ? 'Copied' : 'Copy key'}
                  </Text>
                </Pressable>
              </View>
              <Text
                selectable
                numberOfLines={1}
                style={[styles.keyText, { color: colors.foreground }]}
              >
                {identity.signPublic}
              </Text>
            </View>

            <View style={styles.identityActionsRow}>
              <Pressable
                onPress={() => void copy(invite, 'invite')}
                style={[
                  styles.identityActionBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Feather
                  name={copied === 'invite' ? 'check' : 'link'}
                  size={15}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.identityActionText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  {copied === 'invite' ? 'Invite Copied' : 'Copy Invite Link'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowQr((prev) => !prev)}
                style={[
                  styles.identityActionBtn,
                  {
                    backgroundColor: colors.secondary,
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
                  style={[
                    styles.identityActionText,
                    { color: colors.foreground },
                  ]}
                >
                  {showQr ? 'Hide QR' : 'Show QR Code'}
                </Text>
              </Pressable>
            </View>

            {showQr ? (
              <View style={[styles.qrBlock, { borderColor: colors.border }]}>
                <InviteQr value={invite} size={186} />
                <Text style={[styles.qrCopy, { color: colors.mutedForeground }]}>
                  Have a trusted contact scan this QR code to add your public
                  keys directly.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.section, { color: colors.mutedForeground }]}>
          NOTIFICATIONS & CHAT PREFERENCES
        </Text>
        <View
          style={[
            styles.groupCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.switchRow}>
            <View style={[styles.rowIcon, { backgroundColor: colors.accent }]}>
              <Feather name="bell" size={17} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                Message & Call Notifications
              </Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {notificationPermission === 'granted'
                  ? 'System & in-app alerts active'
                  : notificationPermission === 'denied'
                    ? 'In-app alerts active · Browser/OS permission blocked'
                    : 'Show alerts when new messages or calls arrive'}
              </Text>
            </View>
            <Switch
              value={preferences.notificationsEnabled}
              onValueChange={(val) => void handleToggleNotifications(val)}
              trackColor={{ false: colors.secondary, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.switchRow}>
            <View style={[styles.rowIcon, { backgroundColor: colors.accent }]}>
              <Feather name="volume-2" size={17} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                Sound & Vibration
              </Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Play chime & vibrate on incoming messages and calls
              </Text>
            </View>
            <Switch
              value={preferences.soundEnabled}
              onValueChange={(val) => void handleToggleSound(val)}
              trackColor={{ false: colors.secondary, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.switchRow}>
            <View style={[styles.rowIcon, { backgroundColor: colors.accent }]}>
              <MaterialCommunityIcons
                name="check-all"
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                Read Receipts
              </Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Let contacts know when you have opened their messages
              </Text>
            </View>
            <Switch
              value={preferences.readReceiptsEnabled}
              onValueChange={(val) =>
                void updatePreferences({ readReceiptsEnabled: val })
              }
              trackColor={{ false: colors.secondary, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.switchRow}>
            <View style={[styles.rowIcon, { backgroundColor: colors.accent }]}>
              <Feather name="message-square" size={17} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                Typing Indicators
              </Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Share live typing status over active P2P tunnels
              </Text>
            </View>
            <Switch
              value={preferences.typingIndicatorsEnabled}
              onValueChange={(val) =>
                void updatePreferences({ typingIndicatorsEnabled: val })
              }
              trackColor={{ false: colors.secondary, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <Text style={[styles.section, { color: colors.mutedForeground }]}>
          P2P MESH & SIGNALING STATUS
        </Text>
        <View
          style={[
            styles.groupCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.switchRow}>
            <View style={[styles.rowIcon, { backgroundColor: colors.accent }]}>
              <MaterialCommunityIcons
                name="transit-connection-variant"
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                Nostr + WebTorrent Discovery
              </Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {nodeStatus === 'offline'
                  ? 'Device offline — waiting for network'
                  : `${connectedCount} of ${contacts.length} peer${contacts.length === 1 ? '' : 's'} connected · 5s keepalive active`}
              </Text>
            </View>
            <Pressable
              onPress={() => void reconnectAll()}
              disabled={reconnecting}
              style={[
                styles.resyncBtn,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              {reconnecting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.resyncBtnText, { color: colors.primary }]}>
                  Resync
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.mutedForeground }]}>
          IDENTITY & KEY BACKUP
        </Text>
        <Pressable
          onPress={() => openBackup('export')}
          style={[
            styles.row,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.accent }]}>
            <Feather name="download" size={17} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>
              Export identity backup
            </Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              Encrypt your private keys with a passphrase
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => openBackup('import')}
          style={[
            styles.row,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              marginTop: 9,
            },
          ]}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.accent }]}>
            <Feather name="upload" size={17} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>
              Import identity backup
            </Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              Restore an existing peer identity onto this device
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>

        <Text
          style={[
            styles.section,
            { color: colors.destructive, marginTop: 22 },
          ]}
        >
          DANGER ZONE
        </Text>
        <Pressable
          onPress={confirmWipe}
          style={[
            styles.wipeRow,
            { backgroundColor: colors.card, borderColor: colors.destructive },
          ]}
        >
          <View style={[styles.rowIcon, { backgroundColor: '#381E22' }]}>
            <Feather name="trash-2" size={17} color={colors.destructive} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.destructive }]}>
              Wipe local device data
            </Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              Permanently erase keys, contacts, history, and queued outbox
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.destructive} />
        </Pressable>
        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          P2P Messenger · End-to-End Encrypted · Local-First
        </Text>
      </ScrollView>

      <Modal
        visible={backupMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setBackupMode(null)}
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
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {backupMode === 'export'
                    ? 'Export identity backup'
                    : 'Import identity backup'}
                </Text>
                <Text
                  style={[
                    styles.rowSub,
                    { color: colors.mutedForeground, marginTop: 5 },
                  ]}
                >
                  {backupMode === 'export'
                    ? 'Your private keys are encrypted before export.'
                    : 'Restoring replaces the current local identity.'}
                </Text>
              </View>
              <Pressable
                onPress={() => setBackupMode(null)}
                accessibilityLabel="Close backup"
              >
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
                style={[
                  styles.backupInput,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              />
            ) : null}
            <TextInput
              value={passphrase}
              onChangeText={setPassphrase}
              placeholder="Backup passphrase (10+ characters)"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              style={[
                styles.passInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            />
            {backupMode === 'export' ? (
              <>
                <Pressable
                  onPress={() => void createBackup()}
                  disabled={busy || passphrase.length < 10}
                  style={[
                    styles.modalAction,
                    {
                      backgroundColor: colors.primary,
                      opacity: busy || passphrase.length < 10 ? 0.55 : 1,
                    },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <Text
                      style={[
                        styles.modalActionText,
                        { color: colors.primaryForeground },
                      ]}
                    >
                      Create encrypted backup
                    </Text>
                  )}
                </Pressable>
                {backupText ? (
                  <>
                    <TextInput
                      value={backupText}
                      editable={false}
                      multiline
                      style={[
                        styles.backupOutput,
                        {
                          color: colors.mutedForeground,
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                    <Pressable
                      onPress={() => void copy(backupText, 'backup')}
                      style={[
                        styles.modalAction,
                        { backgroundColor: colors.secondary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalActionText,
                          { color: colors.foreground },
                        ]}
                      >
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
                style={[
                  styles.modalAction,
                  {
                    backgroundColor: colors.primary,
                    opacity:
                      busy || !backupText.trim() || !passphrase ? 0.55 : 1,
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text
                    style={[
                      styles.modalActionText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    Restore identity
                  </Text>
                )}
              </Pressable>
            )}
            {resultText ? (
              <Text
                style={[
                  styles.result,
                  {
                    color:
                      resultText.includes('could not') ||
                      resultText.includes('Check')
                        ? colors.destructive
                        : colors.primary,
                  },
                ]}
              >
                {resultText}
              </Text>
            ) : null}
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
  shield: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 13,
  },
  identityTitleRow: {
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
  avatarLetter: { fontSize: 19, fontWeight: '800' },
  identityName: { flex: 1, gap: 4 },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: { fontSize: 16, fontWeight: '800' },
  nodeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nodeBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  local: { fontSize: 11.5 },
  keyBox: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
  },
  keyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  keyLabel: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  copyInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyInlineText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  keyText: {
    fontSize: 11.5,
    fontFamily: 'monospace',
  },
  identityActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  identityActionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  identityActionText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  qrBlock: {
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 15,
    gap: 10,
  },
  qrCopy: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  section: {
    fontSize: 10,
    letterSpacing: 1.3,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  switchRow: {
    minHeight: 68,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  row: {
    borderWidth: 1,
    borderRadius: 17,
    minHeight: 66,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 13.5, fontWeight: '700' },
  rowSub: { fontSize: 11, lineHeight: 15 },
  resyncBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  resyncBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 63 },
  wipeRow: {
    borderWidth: 1,
    borderRadius: 17,
    minHeight: 66,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  version: { textAlign: 'center', fontSize: 10.5, marginTop: 20 },
  modalShade: { flex: 1, justifyContent: 'flex-end' },
  modal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 21,
    paddingTop: 23,
    gap: 12,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  passInput: {
    height: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  backupInput: {
    height: 125,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingTop: 12,
    textAlignVertical: 'top',
    fontSize: 11,
  },
  backupOutput: {
    height: 110,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 10,
  },
  modalAction: {
    minHeight: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  modalActionText: { fontSize: 13, fontWeight: '800' },
  result: { fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 1 },
});
