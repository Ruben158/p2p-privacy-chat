import React, { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function QrScanner({
  onScan,
  onClose,
}: {
  onScan(value: string): void;
  onClose(): void;
}) {
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);
  if (!permission) {
    return <View style={styles.center}><Text style={{ color: colors.foreground }}>Opening camera…</Text></View>;
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={[styles.permissionText, { color: colors.foreground }]}>
          Camera access is needed to scan an invite QR code.
        </Text>
        <Pressable onPress={() => void requestPermission()} style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.primaryForeground, fontWeight: '700' }}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.scanner}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled) return;
          setHandled(true);
          onScan(data);
        }}
      />
      <Pressable
        onPress={onClose}
        style={[styles.close, { backgroundColor: colors.card }]}
      >
        <Text style={{ color: colors.foreground, fontWeight: '700' }}>Close scanner</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scanner: { height: 370, overflow: 'hidden', borderRadius: 22 },
  center: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  permissionText: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
  button: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  close: { position: 'absolute', bottom: 14, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 99 },
});
