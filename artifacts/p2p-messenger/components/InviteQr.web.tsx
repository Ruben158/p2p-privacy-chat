import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useColors } from '@/hooks/useColors';

export default function InviteQr({ value, size = 220 }: { value: string; size?: number }) {
  const colors = useColors();
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="H"
      bgColor={colors.card}
      fgColor={colors.foreground}
      includeMargin
    />
  );
}
