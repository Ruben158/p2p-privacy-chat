import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@/components/AppIcons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useMessenger } from '@/context/MessengerContext';
import { fingerprintForPair } from '@/lib/crypto';

export default function VerifySecurityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contactId = Array.isArray(id) ? id[0] : id;
  const { identity, contacts } = useMessenger();
  const contact = contacts.find((item) => item.id === contactId);
  const [fingerprint, setFingerprint] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!identity || !contact) return;
    void fingerprintForPair(identity, contact).then(setFingerprint);
  }, [identity, contact]);

  const copy = async () => {
    await Clipboard.setStringAsync(fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1700);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14), borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}>
          <Feather name="arrow-left" size={21} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Verify security</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.icon, { backgroundColor: colors.accent }]}>
          <MaterialCommunityIcons name="shield-key-outline" size={31} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Security number</Text>
        <Text style={[styles.copy, { color: colors.mutedForeground }]}>
          Compare this number with {contact?.displayName ?? 'your contact'} in person or over another trusted channel. It is derived from both public signing keys.
        </Text>

        <View style={[styles.numberCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {fingerprint ? (
            <Text selectable style={[styles.number, { color: colors.foreground }]}>
              {fingerprint}
            </Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
          <Pressable
            onPress={() => void copy()}
            disabled={!fingerprint}
            style={[styles.copyButton, { backgroundColor: colors.secondary }]}
          >
            <Feather name={copied ? 'check' : 'copy'} size={16} color={colors.primary} />
            <Text style={[styles.copyButtonText, { color: colors.foreground }]}>
              {copied ? 'Copied' : 'Copy number'}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
            If either person replaces their identity keys, this number changes. A matching number helps detect an invite that was altered in transit.
          </Text>
        </View>
        <Pressable onPress={() => router.back()} style={[styles.done, { backgroundColor: colors.primary }]}>
          <Text style={[styles.doneText, { color: colors.primaryForeground }]}>Back to chat</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 58, paddingHorizontal: 14, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '800' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 34 },
  icon: { width: 70, height: 70, borderRadius: 25, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 19 },
  title: { textAlign: 'center', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  copy: { textAlign: 'center', fontSize: 13, lineHeight: 20, marginTop: 10, marginBottom: 24 },
  numberCard: { borderWidth: 1, borderRadius: 20, padding: 18, alignItems: 'center', gap: 17 },
  number: { textAlign: 'center', fontFamily: 'monospace', fontSize: 20, lineHeight: 33, letterSpacing: 1.4, fontWeight: '700' },
  copyButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 13 },
  copyButtonText: { fontSize: 12, fontWeight: '700' },
  notice: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 17 },
  done: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 19 },
  doneText: { fontSize: 14, fontWeight: '800' },
});
