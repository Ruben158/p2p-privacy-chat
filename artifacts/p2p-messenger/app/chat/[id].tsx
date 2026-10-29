import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Feather, MaterialCommunityIcons } from '@/components/AppIcons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AudioControl from '@/components/AudioControl';
import ConnectionBanner from '@/components/ConnectionBanner';
import { useColors } from '@/hooks/useColors';
import { useMessenger } from '@/context/MessengerContext';
import type { ChatMessage } from '@/lib/types';

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
    contacts,
    messages,
    connectionStatus,
    typing,
    sendText,
    sendAttachment,
    sendTyping,
    markIncomingRead,
    setActiveChatContact,
    startCall,
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
    setActiveChatContact(contactId ?? null);
    return () => {
      setActiveChatContact(null);
    };
  }, [contactId, setActiveChatContact]);

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

  const status = contactId
    ? connectionStatus[contactId] ?? 'searching'
    : 'offline';
  const isConnected = status === 'connected';

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
      Alert.alert(
        'Message not sent',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setSending(false);
    }
  };

  const handleStartCall = async (mode: 'voice' | 'video') => {
    if (!contactId) return;
    try {
      await startCall(contactId, mode);
    } catch (error) {
      Alert.alert(
        'Call could not start',
        error instanceof Error ? error.message : 'Please try again.',
      );
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
      Alert.alert(
        'Photo not sent',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  };

  const handleVoiceNote = async () => {
    if (!contactId) return;
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Voice notes',
        'Record voice notes in the Capacitor Android app or browser version.',
      );
      return;
    }
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === 'undefined'
      ) {
        throw new Error(
          'This device browser does not support audio recording.',
        );
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
        void sendAttachment(contactId, file, 'audio').catch(
          (error: unknown) => {
            Alert.alert(
              'Voice note not sent',
              error instanceof Error ? error.message : 'Try again.',
            );
          },
        );
      };
      recorder.start();
      setRecording(true);
    } catch (error) {
      Alert.alert(
        'Microphone unavailable',
        error instanceof Error
          ? error.message
          : 'Allow microphone access and try again.',
      );
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = item.direction === 'outgoing';
    const bubbleColor = mine ? colors.accent : colors.card;
    const bubbleBorder = mine ? colors.primary : colors.border;

    return (
      <View
        style={[
          styles.messageLine,
          mine ? styles.messageMine : styles.messageTheirs,
        ]}
      >
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleColor,
              borderColor: bubbleBorder,
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
            <Text
              style={[styles.messageTime, { color: colors.mutedForeground }]}
            >
              {timeLabel(item.createdAt)}
            </Text>
            {mine ? (
              <View style={styles.statusChip}>
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
                          ? '#F59E0B'
                          : colors.primary,
                    },
                  ]}
                >
                  {item.status === 'queued'
                    ? '✓ Queued'
                    : item.status === 'read'
                      ? '✓✓ Read'
                      : '✓✓ Delivered'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  if (!contact) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>
          This contact is not available on this device.
        </Text>
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
      <View
        style={[
          styles.chatHeader,
          {
            paddingTop: Math.max(insets.top, 12) + 4,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back to chats"
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={21} color={colors.foreground} />
        </Pressable>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.accentForeground }]}>
            {contact.displayName.slice(0, 1).toUpperCase()}
          </Text>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: isConnected
                  ? colors.primary
                  : status === 'searching'
                    ? '#F59E0B'
                    : colors.mutedForeground,
                borderColor: colors.background,
              },
            ]}
          />
        </View>
        <View style={styles.headerCopy}>
          <Text
            numberOfLines={1}
            style={[styles.contactName, { color: colors.foreground }]}
          >
            {contact.displayName}
          </Text>
          <View style={styles.statusLine}>
            <MaterialCommunityIcons
              name="shield-lock"
              size={11}
              color={colors.primary}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.connectionText,
                {
                  color: isConnected ? colors.primary : colors.mutedForeground,
                },
              ]}
            >
              {isConnected
                ? 'E2EE · Direct P2P Tunnel'
                : 'E2EE · Waiting for Peer'}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityLabel="Start voice call"
          disabled={!isConnected}
          onPress={() => void handleStartCall('voice')}
          style={[
            styles.headerActionBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: isConnected ? 1 : 0.42,
            },
          ]}
        >
          <Feather name="phone-call" size={16} color={colors.primary} />
        </Pressable>
        <Pressable
          accessibilityLabel="Start video call"
          disabled={!isConnected}
          onPress={() => void handleStartCall('video')}
          style={[
            styles.headerActionBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: isConnected ? 1 : 0.42,
            },
          ]}
        >
          <Feather name="video" size={17} color={colors.primary} />
        </Pressable>
        <Pressable
          accessibilityLabel="Verify security number"
          onPress={() =>
            router.push({
              pathname: '/chat/verify/[id]',
              params: { id: contact.id },
            })
          }
          style={[
            styles.headerActionBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={18}
            color={colors.primary}
          />
        </Pressable>
      </View>

      <ConnectionBanner contactId={contact.id} compact />

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
            <View
              style={[
                styles.lockIcon,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <MaterialCommunityIcons
                name="lock-check-outline"
                size={24}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              End-to-End Encrypted with {contact.displayName}
            </Text>
            <Text
              style={[styles.emptyCopy, { color: colors.mutedForeground }]}
            >
              Messages are encrypted on your device using X25519 + Ed25519 keys.
              If {contact.displayName} is offline, messages queue locally and
              deliver automatically the moment both apps are open.
            </Text>
          </View>
        }
        
      />

      {typing[contact.id] ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.background }}>
          <View style={[styles.typingPill, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }]}>
            <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, opacity: 0.65 }} />
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, opacity: 0.35 }} />
            </View>
            <Text style={[styles.typingText, { color: colors.foreground }]}>
              {contact.displayName} is typing…
            </Text>
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.composerWrap,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(
              insets.bottom,
              Platform.OS === 'web' ? 24 : 10,
            ),
          },
        ]}
      >
        <View style={styles.composerRow}>
          <Pressable
            onPress={() => void handleImage()}
            accessibilityLabel="Attach photo"
            style={[
              styles.composerIcon,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="image" size={18} color={colors.mutedForeground} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={handleDraftChange}
            placeholder={
              isConnected
                ? 'Encrypted message…'
                : 'Message (will send when connected)…'
            }
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={4000}
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            accessibilityLabel="Message"
          />
          {draft.trim() ? (
            <Pressable
              onPress={() => void handleSend()}
              disabled={sending}
              accessibilityLabel="Send message"
              style={[
                styles.sendButton,
                {
                  backgroundColor: colors.primary,
                  opacity: sending ? 0.6 : 1,
                },
              ]}
            >
              {sending ? (
                <ActivityIndicator
                  color={colors.primaryForeground}
                  size="small"
                />
              ) : (
                <Feather
                  name="arrow-up"
                  size={20}
                  color={colors.primaryForeground}
                />
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void handleVoiceNote()}
              accessibilityLabel={
                recording ? 'Stop voice note' : 'Record voice note'
              }
              style={[
                styles.sendButton,
                {
                  backgroundColor: recording
                    ? colors.destructive
                    : colors.secondary,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Feather
                name={recording ? 'square' : 'mic'}
                size={17}
                color={
                  recording ? colors.destructiveForeground : colors.primary
                }
              />
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
  chatHeader: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  backButton: {
    width: 34,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800' },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    position: 'absolute',
    right: -1,
    bottom: -1,
  },
  headerCopy: { flex: 1, gap: 2 },
  contactName: { fontSize: 15, fontWeight: '800' },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  connectionText: { fontSize: 10, fontWeight: '700' },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 16,
  },
  emptyMessageList: { flex: 1 },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    transform: [{ scaleY: -1 }],
  },
  lockIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, textAlign: 'center', fontWeight: '800' },
  emptyCopy: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  typingPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
    transform: [{ scaleY: -1 }],
  },
  typingText: { fontSize: 11, fontWeight: '700' },
  messageLine: { flexDirection: 'row', marginVertical: 4 },
  messageMine: { justifyContent: 'flex-end' },
  messageTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    minWidth: 96,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 7,
  },
  attachmentImage: {
    width: 230,
    height: 190,
    borderRadius: 12,
    marginBottom: 5,
    backgroundColor: colors.card,
  },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  messageTime: { fontSize: 9.5 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageTick: { fontSize: 9.5, fontWeight: '800' },
  composerWrap: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 130,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
