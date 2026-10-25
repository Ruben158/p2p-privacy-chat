import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { decryptIdentityBackup } from '@/lib/crypto';
import { useMessenger } from '@/context/MessengerContext';

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { ready, identity, createIdentity, restoreIdentity, storageError } = useMessenger();
  const [name, setName] = useState('');
  const [backupText, setBackupText] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && identity) router.replace('/(tabs)');
  }, [ready, identity]);

  const create = async () => {
    if (name.trim().length < 2) {
      setError('Choose a name with at least two characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createIdentity(name);
      router.replace('/(tabs)');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Identity could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const importBackup = async () => {
    if (!backupText.trim() || !passphrase) {
      setError('Add the encrypted backup and its passphrase.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const restored = await decryptIdentityBackup(backupText, passphrase);
      await restoreIdentity(restored);
      router.replace('/(tabs)');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The backup could not be restored.');
    } finally {
      setBusy(false);
    }
  };

  if (!ready || identity) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
      style={[styles.flex, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 67 : 28) + 28,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 24) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
            accessibilityLabel="P2P Messenger"
          />
          <View>
            <Text style={[styles.wordmark, { color: colors.foreground }]}>P2P</Text>
            <Text style={[styles.wordmarkSub, { color: colors.primary }]}>MESSENGER</Text>
          </View>
        </View>
        <Text style={[styles.headline, { color: colors.foreground }]}>
          Your messages.{'\n'}Your keys. Your device.
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          No phone number. No central account. Create a local identity, then connect directly with people you trust.
        </Text>

        {!importOpen ? (
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>DISPLAY NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="How friends will see you"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
              maxLength={48}
              style={[
                styles.input,
                { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
              ]}
              returnKeyType="done"
              onSubmitEditing={() => void create()}
            />
            <Pressable
              onPress={() => void create()}
              disabled={busy}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary, opacity: busy || pressed ? 0.72 : 1 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                  Create local identity
                </Text>
              )}
            </Pressable>
            <Pressable onPress={() => { setImportOpen(true); setError(null); }} style={styles.textAction}>
              <Text style={[styles.actionText, { color: colors.primary }]}>Restore an identity backup</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>ENCRYPTED BACKUP</Text>
            <TextInput
              value={backupText}
              onChangeText={setBackupText}
              placeholder="Paste backup JSON"
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoCapitalize="none"
              style={[
                styles.input,
                styles.backupField,
                { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
              ]}
            />
            <TextInput
              value={passphrase}
              onChangeText={setPassphrase}
              placeholder="Backup passphrase"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              style={[
                styles.input,
                { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
              ]}
            />
            <Pressable
              onPress={() => void importBackup()}
              disabled={busy}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary, opacity: busy || pressed ? 0.72 : 1 },
              ]}
            >
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                {busy ? 'Restoring…' : 'Restore identity'}
              </Text>
            </Pressable>
            <Pressable onPress={() => { setImportOpen(false); setError(null); }} style={styles.textAction}>
              <Text style={[styles.actionText, { color: colors.primary }]}>Back to new identity</Text>
            </Pressable>
          </View>
        )}

        {(error || storageError) && (
          <Text style={[styles.error, { color: colors.destructive }]}>
            {error ?? storageError}
          </Text>
        )}
        <View style={[styles.privacyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.privacyTitle, { color: colors.foreground }]}>Private by design</Text>
          <Text style={[styles.privacyCopy, { color: colors.mutedForeground }]}>
            Your identity and message history stay on this device. Public signaling helps peers find each other; message content is encrypted for the recipient.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 34 },
  logo: { width: 48, height: 48, borderRadius: 14 },
  wordmark: { fontSize: 18, fontWeight: '800', letterSpacing: 1.4 },
  wordmarkSub: { fontSize: 9, fontWeight: '800', letterSpacing: 2.4, marginTop: 2 },
  headline: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1.2 },
  body: { fontSize: 15, lineHeight: 23, marginTop: 14, marginBottom: 28 },
  form: { gap: 13 },
  label: { fontSize: 10, letterSpacing: 1.8, fontWeight: '800', marginBottom: -4 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontSize: 15 },
  backupField: { minHeight: 140, paddingTop: 14, textAlignVertical: 'top' },
  primaryButton: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { fontWeight: '800', fontSize: 15 },
  textAction: { alignSelf: 'center', padding: 12 },
  actionText: { fontSize: 14, fontWeight: '700' },
  error: { marginTop: 14, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  privacyCard: { borderWidth: 1, borderRadius: 18, padding: 17, marginTop: 28 },
  privacyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  privacyCopy: { fontSize: 12, lineHeight: 19 },
});
