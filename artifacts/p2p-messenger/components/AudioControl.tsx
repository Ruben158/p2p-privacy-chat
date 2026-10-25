import React from 'react';
import { Linking, Pressable, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function AudioControl({
  data,
  mimeType,
}: {
  data: string;
  mimeType: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => void Linking.openURL(`data:${mimeType};base64,${data}`)}
      style={{ paddingVertical: 10 }}
    >
      <Text style={{ color: colors.primary, fontWeight: '700' }}>Play voice note</Text>
    </Pressable>
  );
}
