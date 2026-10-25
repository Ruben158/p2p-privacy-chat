import React, { useEffect, useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function QrScanner({
  onScan,
  onClose,
}: {
  onScan(value: string): void;
  onClose(): void;
}) {
  const colors = useColors();
  const id = `qr-reader-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    let scanner: import('html5-qrcode').Html5Qrcode | null = null;
    let active = true;
    void import('html5-qrcode').then(async ({ Html5Qrcode }) => {
      if (!active) return;
      scanner = new Html5Qrcode(id, { verbose: false });
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (!active) return;
            active = false;
            onScan(decoded);
            void scanner?.stop().catch(() => undefined);
          },
          () => undefined,
        );
      } catch {
        onClose();
      }
    });
    return () => {
      active = false;
      if (scanner?.isScanning) {
        void scanner.stop().then(() => scanner?.clear()).catch(() => undefined);
      }
    };
  }, [id, onClose, onScan]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.help, { color: colors.mutedForeground }]}>
        Point the back camera at a P2P Messenger invite QR.
      </Text>
      {React.createElement('div', {
        id,
        style: {
          width: '100%',
          minHeight: 300,
          background: colors.card,
          borderRadius: 18,
          overflow: 'hidden',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  help: { fontSize: 13, lineHeight: 19 },
});
