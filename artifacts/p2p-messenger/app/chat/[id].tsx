import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AudioControl from '@/components/AudioControl';
import { useColors } from '@/hooks/useColors';
import { useMessenger } from '@/context/MessengerContext';
import type { ChatMessage, Contact } from '@/lib/types';

function timeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contactId = Array.isArray(id) ? id[0] : id;
  const {
    identity,
    contacts,
    messages,
    connectionStatus,
    typing,
    networkErrors,
    sendText,
    sendAttachment,
    sendTyping,
    markIncomingRead,
  } = useMessenger();
  const contact = contacts.find((item) => item.id === contactId);
  const chatMessages = useMemo(
    () => messages.filter((message) => message.contactId === contactId),
    [messages, contactId],
  );
  const [draft, setDraft] = useState('');
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingSent, setTypingSent] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sendTypingRef = useRef(sendTyping);

  useEffect(() => {
    sendTypingRef.current = sendTyping;
  }, [sendTyping]);

  useEffect(() => {
    if (contactId) void markIncomingRead(contactId);
  }, [contactId, chatMessages.length, markIncomingRead]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (contactId && typingSent) void sendTypingRef.current(contactId, false);
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [contactId, typingSent]);

  const status = contactId ? connectionStatus[contactId] ?? 'searching' : 'offline';
  const statusLabel =
    status === 'connected'
      ? 'Direct P2P connected · encrypted'
      : status === 'offline'
        ? 'Peer offline · queued on this device'
        : 'Searching DHT / signaling…';

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!contactId) return;
    if (value.trim() && !typingSent) {
      setTypingSent(true);
      void sendTyping(contactId, true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setTypingSent(false);
      void sendTyping(contactId, false);
    }, 1000);
  };

  const handleSend = async () => {
    if (!contactId || !draft.trim() || sending) return;
    const message = draft;
    setDraft('');
    setSending(true);
    setTypingSent(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    void sendTyping(contactId, false);
    try {
      await sendText(contactId, message);
    } catch (error) {
      Alert.alert('Message not sent', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSending(false);
    }
  };

  const handleImage = async () => {
    if (!contactId) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.82,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      let file = asset.file;
      if (!file) {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        file = new File([blob], asset.fileName ?? 'image.jpg', {
          type: asset.mimeType ?? blob.type ?? 'image/jpeg',
        });
      }
      await sendAttachment(contactId, file, 'image');
    } catch (error) {
      Alert.alert('Photo not sent', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const handleVoiceNote = async () => {
    if (!contactId) return;
    if (Platform.OS !== 'web') {
      Alert.alert('Voice notes', 'Record voice notes in the Capacitor Android app or browser version.');
      return;
    }
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('This device browser does not support audio recording.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderStreamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        recorderStreamRef.current = null;
        setRecording(false);
        if (!blob.size) return;
        const file = new File([blob], `voice-note-${Date.now()}.webm`, {
          type: blob.type || 'audio/webm',
        });
        void sendAttachment(contactId, file, 'audio').catch((error: unknown) => {
          Alert.alert('Voice note not sent', error instanceof Error ? error.message : 'Try again.');
        });
      };
      recorder.start();
      setRecording(true);
    } catch (error) {
      Alert.alert('Microphone unavailable', error instanceof Error ? error.message : 'Allow microphone access and try again.');
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = item.direction === 'outgoing';
    const bubbleColor = mine ? colors.accent : colors.card;
    return (
      <View style={[styles.messageLine, mine ? styles.messageMine : styles.messageTheirs]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleColor,
              borderBottomRightRadius: mine ? 5 : 18,
              borderBottomLeftRadius: mine ? 18 : 5,
            },
          ]}
        >
          {item.content.kind === 'image' && item.content.data ? (
            <Image
              source={{
                uri: `data:${item.content.mimeType ?? 'image/jpeg'};base64,${item.content.data}`,
              }}
              style={styles.attachmentImage}
              resizeMode="cover"
              accessibilityLabel="Shared image"
            />
          ) : null}
          {item.content.kind === 'audio' && item.content.data ? (
            <AudioControl
              data={item.content.data}
              mimeType={item.content.mimeType ?? 'audio/webm'}
            />
          ) : null}
          {item.content.text ? (
            <Text style={[styles.messageText, { color: colors.foreground }]}>
              {item.content.text}
            </Text>
          ) : null}
          <View style={styles.messageMeta}>
            <Text style={[styles.messageTime, { color: colors.mutedForeground }]}>
              {timeLabel(item.createdAt)}
            </Text>
            {mine ? (
              <Text
                accessibilityLabel={
                  item.status === 'queued'
                    ? 'Queued locally'
                    : item.status === 'read'
                      ? 'Read'
                      : 'Delivered directly'
                }
                style={[
                  styles.messageTick,
                  {
                    color:
                      item.status === 'queued'
                        ? colors.mutedForeground
                        : colors.primary,
                  },
                ]}
              >
                {item.status === 'queued' ? '✓' : '✓✓'}
              </Text>
            ) : item.readAt ? (
              <MaterialCommunityIcons name="eye-check-outline" size={12} color={colors.primary} />
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  if (!contact) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>This contact is not available on this device.</Text>
        <Pressable onPress={() => router.back()} style={{ padding: 15 }}>
          <Text style={{ color: colors.primary }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={[styles.chatHeader, { paddingTop: Math.max(insets.top, 12), borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back to chats"
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.accentForeground }]}>
            {contact.displayName.slice(0, 1).toUpperCase()}
          </Text>
          <View
            style={[
              styles.dot,
              { backgroundColor: status === 'connected' ? colors.primary : colors.mutedForeground, borderColor: colors.background },
            ]}
          />
        </View>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={[styles.contactName, { color: colors.foreground }]}>
            {contact.displayName}
          </Text>
          <View style={styles.statusLine}>
            <View style={[styles.statusDot, { backgroundColor: status === 'connected' ? colors.primary : status === 'offline' ? colors.mutedForeground : '#F4B95F' }]} />
            <Text numberOfLines={1} style={[styles.connectionText, { color: status === 'connected' ? colors.primary : colors.mutedForeground }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Verify security number"
          onPress={() => router.push({ pathname: '/chat/verify/[id]', params: { id: contact.id } })}
          style={styles.verifyButton}
        >
          <MaterialCommunityIcons name="shield-check-outline" size={21} color={colors.primary} />
        </Pressable>
      </View>

      {networkErrors[contact.id] && status !== 'connected' ? (
        <View style={[styles.networkWarning, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.warningText, { color: colors.mutedForeground }]}>
            Signaling is still being attempted. A direct path depends on both peers’ network settings.
          </Text>
        </View>
      ) : null}

      <FlatList
        inverted
        data={[...chatMessages].reverse()}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[
          styles.messageList,
          chatMessages.length === 0 && styles.emptyMessageList,
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={[styles.lockIcon, { backgroundColor: colors.card }]}>
              <MaterialCommunityIcons name="lock-outline" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>A private chat with {contact.displayName}</Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
              Messages are encrypted for this contact. Check the safety number together before sharing sensitive details.
            </Text>
          </View>
        }
        ListHeaderComponent={
          typing[contact.id] ? (
            <Text style={[styles.typing, { color: colors.mutedForeground }]}>{contact.displayName} is typing…</Text>
          ) : null
        }
      />

      <View
        style={[
          styles.composerWrap,
          {
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 8),
          },
        ]}
      >
        {status === 'offline' ? (
          <View style={styles.queueNote}>
            <MaterialCommunityIcons name="cloud-off-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.queueText, { color: colors.mutedForeground }]}>
              Sent messages wait securely on this device
            </Text>
          </View>
        ) : null}
        <View style={styles.composerRow}>
          <Pressable onPress={() => void handleImage()} accessibilityLabel="Attach photo" style={styles.composerIcon}>
            <Feather name="image" size={19} color={colors.mutedForeground} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={handleDraftChange}
            placeholder="Message"
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={4000}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            accessibilityLabel="Message"
          />
          {draft.trim() ? (
            <Pressable
              onPress={() => void handleSend()}
              disabled={sending}
              accessibilityLabel="Send message"
              style={[styles.sendButton, { backgroundColor: colors.primary, opacity: sending ? 0.6 : 1 }]}
            >
              {sending ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Feather name="arrow-up" size={20} color={colors.primaryForeground} />
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void handleVoiceNote()}
              accessibilityLabel={recording ? 'Stop voice note' : 'Record voice note'}
              style={[styles.sendButton, { backgroundColor: recording ? colors.destructive : colors.primary }]}
            >
              <Feather name={recording ? 'square' : 'mic'} size={17} color={recording ? colors.destructiveForeground : colors.primaryForeground} />
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatHeader: { minHeight: 68, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { width: 32, height: 40, justifyContent: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, position: 'absolute', right: -1, bottom: -1 },
  headerCopy: { flex: 1, gap: 4 },
  contactName: { fontSize: 15, fontWeight: '800' },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.1 },
  verifyButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  networkWarning: { marginHorizontal: 14, marginTop: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', gap: 7, alignItems: 'center' },
  warningText: { flex: 1, fontSize: 10, lineHeight: 15 },
  messageList: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 13, paddingTop: 12, paddingBottom: 16 },
  emptyMessageList: { flex: 1 },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 36, transform: [{ scaleY: -1 }] },
  lockIcon: { width: 54, height: 54, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 17, textAlign: 'center', fontWeight: '800' },
  emptyCopy: { marginTop: 8, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  typing: { alignSelf: 'flex-start', fontSize: 11, paddingHorizontal: 8, paddingBottom: 9, transform: [{ scaleY: -1 }] },
  messageLine: { flexDirection: 'row', marginVertical: 4 },
  messageMine: { justifyContent: 'flex-end' },
  messageTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '84%', minWidth: 86, borderRadius: 18, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 6 },
  attachmentImage: { width: 230, height: 190, borderRadius: 12, marginBottom: 4, backgroundColor: '#0A171A' },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageMeta: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 5, marginTop: 3 },
  messageTime: { fontSize: 9 },
  messageTick: { fontSize: 12, fontWeight: '900', letterSpacing: -2 },
  composerWrap: { borderTopWidth: 1, paddingHorizontal: 11, paddingTop: 8 },
  queueNote: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 8, paddingBottom: 7 },
  queueText: { fontSize: 10 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  composerIcon: { width: 37, height: 45, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, maxHeight: 130, minHeight: 44, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 10, fontSize: 14, textAlignVertical: 'center' },
  sendButton: { width: 43, height: 43, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
