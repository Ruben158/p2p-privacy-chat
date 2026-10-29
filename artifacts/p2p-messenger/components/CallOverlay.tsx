import React, { useEffect } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@/components/AppIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CallMedia from '@/components/CallMedia';
import { useColors } from '@/hooks/useColors';
import { useMessenger } from '@/context/MessengerContext';

export default function CallOverlay() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    activeCall,
    callError,
    contacts,
    acceptCall,
    declineCall,
    endCall,
    toggleCallMicrophone,
    toggleCallCamera,
    clearCallError,
  } = useMessenger();

  useEffect(() => {
    if (!callError) return;
    Alert.alert('Call ended', callError);
    clearCallError();
  }, [callError, clearCallError]);

  if (!activeCall) return null;
  const contact = contacts.find((item) => item.id === activeCall.contactId);
  const name = contact?.displayName ?? 'Contact';
  const incoming = activeCall.phase === 'incoming';
  const connected = activeCall.phase === 'connected';
  const status = incoming
    ? `Incoming ${activeCall.mode} call`
    : activeCall.phase === 'outgoing'
      ? `Calling ${name}…`
      : connected
        ? 'Direct encrypted call'
        : 'Connecting call…';

  const showError = (title: string, error: unknown) => {
    Alert.alert(title, error instanceof Error ? error.message : 'Please try again.');
  };

  return (
    <View
      style={[
        styles.overlay,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 20,
          paddingBottom: Math.max(insets.bottom, 20) + 18,
        },
      ]}
      accessibilityViewIsModal
    >
      <CallMedia call={activeCall} backgroundColor={colors.background} />
      <View style={styles.topInfo}>
        <Text style={[styles.status, { color: colors.primary }]}>{status}</Text>
        <Text style={[styles.encryption, { color: colors.foreground }]}>
          Peer-to-peer · WebRTC encrypted media
        </Text>
      </View>

      {!activeCall.remoteStream ? (
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={[styles.avatarText, { color: colors.accentForeground }]}>
              {name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.foreground }]}>{name}</Text>
          <Text style={[styles.mode, { color: colors.mutedForeground }]}>
            {activeCall.mode === 'video' ? 'Video call' : 'Voice call'}
          </Text>
        </View>
      ) : null}

      <View style={styles.controls}>
        {incoming ? (
          <>
            <Control
              label="Decline call"
              icon="phone-off"
              color={colors.destructive}
              onPress={() => void declineCall().catch((error) => showError('Call error', error))}
            />
            <Control
              label="Accept call"
              icon="phone"
              color={colors.primary}
              onPress={() => void acceptCall().catch((error) => showError('Call could not start', error))}
            />
          </>
        ) : connected ? (
          <>
            <Control
              label={activeCall.muted ? 'Unmute microphone' : 'Mute microphone'}
              icon={activeCall.muted ? 'mic-off' : 'mic'}
              color={colors.secondary}
              onPress={toggleCallMicrophone}
            />
            {activeCall.mode === 'video' ? (
              <Control
                label={activeCall.cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                icon={activeCall.cameraEnabled ? 'video' : 'video-off'}
                color={colors.secondary}
                onPress={toggleCallCamera}
              />
            ) : null}
            <Control
              label="End call"
              icon="phone-off"
              color={colors.destructive}
              onPress={() => void endCall().catch((error) => showError('Call error', error))}
            />
          </>
        ) : (
          <Control
            label="Cancel call"
            icon="phone-off"
            color={colors.destructive}
            onPress={() => void endCall().catch((error) => showError('Call error', error))}
          />
        )}
      </View>
    </View>
  );
}

function Control({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: string;
  color: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.control, { backgroundColor: color }]}
    >
      <Feather name={icon} size={22} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    zIndex: 1000,
    elevation: 30,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topInfo: { alignItems: 'center', zIndex: 1, gap: 5 },
  status: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  encryption: { fontSize: 11, fontWeight: '600', opacity: 0.85 },
  identity: { alignItems: 'center', gap: 7, zIndex: 1 },
  avatar: { width: 112, height: 112, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 48, fontWeight: '800' },
  name: { fontSize: 25, fontWeight: '800' },
  mode: { fontSize: 13, fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, zIndex: 2 },
  control: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
});
