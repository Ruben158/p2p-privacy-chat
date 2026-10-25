import React from 'react';
import QRCode from 'react-native-qrcode-svg';
import { useColors } from '@/hooks/useColors';

export default function InviteQr({ value, size = 220 }: { value: string; size?: number }) {
  const colors = useColors();
  return (
    <QRCode
      value={value}
      size={size}
      color={colors.foreground}
      backgroundColor={colors.card}
      ecl="H"
    />
  );
}
