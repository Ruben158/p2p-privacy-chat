import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ActiveCall } from '@/lib/types';

export default function CallMedia({
  call,
  backgroundColor,
}: {
  call: ActiveCall;
  backgroundColor: string;
}) {
  const remoteRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = remoteRef.current;
    if (!element) return;
    element.srcObject = call.remoteStream;
    if (call.remoteStream) void element.play().catch(() => undefined);
  }, [call.remoteStream, call.mode]);

  useEffect(() => {
    const element = localRef.current;
    if (!element) return;
    element.srcObject = call.localStream;
    if (call.localStream) void element.play().catch(() => undefined);
  }, [call.localStream, call.mode, call.cameraEnabled]);

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      {call.remoteStream
        ? call.mode === 'video'
          ? React.createElement('video', {
              ref: (element: HTMLVideoElement | null) => {
                remoteRef.current = element;
              },
              autoPlay: true,
              playsInline: true,
              style: { ...styles.remoteMedia, backgroundColor },
            })
          : React.createElement('audio', {
              ref: (element: HTMLAudioElement | null) => {
                remoteRef.current = element;
              },
              autoPlay: true,
              style: styles.hiddenAudio,
            })
        : null}
      {call.mode === 'video' && call.localStream
        ? React.createElement('video', {
            ref: (element: HTMLVideoElement | null) => {
              localRef.current = element;
            },
            autoPlay: true,
            muted: true,
            playsInline: true,
              style: { ...styles.localMedia, backgroundColor },
          })
        : null}
    </View>
  );
}

const styles: Record<string, React.CSSProperties> = {
  remoteMedia: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  localMedia: {
    position: 'absolute',
    top: 20,
    right: 18,
    width: 104,
    height: 148,
    objectFit: 'cover',
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.2)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
  },
  hiddenAudio: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: 'none',
  },
};
