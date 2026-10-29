import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon } from 'react-native-svg';

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function Feather({ name, size = 20, color = '#10B981', style }: IconProps) {
  const strokeProps = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  switch (name) {
    case 'arrow-left':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Line x1="19" y1="12" x2="5" y2="12" {...strokeProps} />
          <Polyline points="12 19 5 12 12 5" {...strokeProps} />
        </Svg>
      );
    case 'arrow-up':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Line x1="12" y1="19" x2="12" y2="5" {...strokeProps} />
          <Polyline points="5 12 12 5 19 12" {...strokeProps} />
        </Svg>
      );
    case 'arrow-up-right':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Line x1="7" y1="17" x2="17" y2="7" {...strokeProps} />
          <Polyline points="7 7 17 7 17 17" {...strokeProps} />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Polyline points="20 6 9 17 4 12" {...strokeProps} />
        </Svg>
      );
    case 'copy':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Rect x="9" y="9" width="13" height="13" rx="2" ry="2" {...strokeProps} />
          <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...strokeProps} />
        </Svg>
      );
    case 'phone':
    case 'phone-call':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" {...strokeProps} />
        </Svg>
      );
    case 'phone-off':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" {...strokeProps} />
          <Line x1="23" y1="1" x2="1" y2="23" {...strokeProps} />
        </Svg>
      );
    case 'video':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Polygon points="23 7 16 12 23 17 23 7" {...strokeProps} />
          <Rect x="1" y="5" width="15" height="14" rx="2" ry="2" {...strokeProps} />
        </Svg>
      );
    case 'video-off':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" {...strokeProps} />
          <Line x1="1" y1="1" x2="23" y2="23" {...strokeProps} />
        </Svg>
      );
    case 'image':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" {...strokeProps} />
          <Circle cx="8.5" cy="8.5" r="1.5" {...strokeProps} />
          <Polyline points="21 15 16 10 5 21" {...strokeProps} />
        </Svg>
      );
    case 'mic':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" {...strokeProps} />
          <Path d="M19 10v2a7 7 0 0 1-14 0v-2" {...strokeProps} />
          <Line x1="12" y1="19" x2="12" y2="23" {...strokeProps} />
          <Line x1="8" y1="23" x2="16" y2="23" {...strokeProps} />
        </Svg>
      );
    case 'mic-off':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Line x1="1" y1="1" x2="23" y2="23" {...strokeProps} />
          <Path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" {...strokeProps} />
          <Path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" {...strokeProps} />
          <Line x1="12" y1="19" x2="12" y2="23" {...strokeProps} />
          <Line x1="8" y1="23" x2="16" y2="23" {...strokeProps} />
        </Svg>
      );
    case 'square':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Rect x="4" y="4" width="16" height="16" rx="2" ry="2" {...strokeProps} fill={color} />
        </Svg>
      );
    case 'bell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...strokeProps} />
          <Path d="M13.73 21a2 2 0 0 1-3.46 0" {...strokeProps} />
        </Svg>
      );
    case 'volume-2':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" {...strokeProps} />
          <Path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" {...strokeProps} />
        </Svg>
      );
    case 'message-square':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...strokeProps} />
        </Svg>
      );
    case 'message-circle':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" {...strokeProps} />
        </Svg>
      );
    case 'download':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...strokeProps} />
          <Polyline points="7 10 12 15 17 10" {...strokeProps} />
          <Line x1="12" y1="15" x2="12" y2="3" {...strokeProps} />
        </Svg>
      );
    case 'upload':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" {...strokeProps} />
          <Polyline points="17 8 12 3 7 8" {...strokeProps} />
          <Line x1="12" y1="3" x2="12" y2="15" {...strokeProps} />
        </Svg>
      );
    case 'chevron-right':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Polyline points="9 18 15 12 9 6" {...strokeProps} />
        </Svg>
      );
    case 'trash-2':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Polyline points="3 6 5 6 21 6" {...strokeProps} />
          <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...strokeProps} />
          <Line x1="10" y1="11" x2="10" y2="17" {...strokeProps} />
          <Line x1="14" y1="11" x2="14" y2="17" {...strokeProps} />
        </Svg>
      );
    case 'x':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Line x1="18" y1="6" x2="6" y2="18" {...strokeProps} />
          <Line x1="6" y1="6" x2="18" y2="18" {...strokeProps} />
        </Svg>
      );
    case 'search':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Circle cx="11" cy="11" r="8" {...strokeProps} />
          <Line x1="21" y1="21" x2="16.65" y2="16.65" {...strokeProps} />
        </Svg>
      );
    case 'plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Line x1="12" y1="5" x2="12" y2="19" {...strokeProps} />
          <Line x1="5" y1="12" x2="19" y2="12" {...strokeProps} />
        </Svg>
      );
    case 'users':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...strokeProps} />
          <Circle cx="9" cy="7" r="4" {...strokeProps} />
          <Path d="M23 21v-2a4 4 0 0 0-3-3.87" {...strokeProps} />
          <Path d="M16 3.13a4 4 0 0 1 0 7.75" {...strokeProps} />
        </Svg>
      );
    case 'user-plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...strokeProps} />
          <Circle cx="8.5" cy="7" r="4" {...strokeProps} />
          <Line x1="20" y1="8" x2="20" y2="14" {...strokeProps} />
          <Line x1="23" y1="11" x2="17" y2="11" {...strokeProps} />
        </Svg>
      );
    case 'user-minus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...strokeProps} />
          <Circle cx="8.5" cy="7" r="4" {...strokeProps} />
          <Line x1="23" y1="11" x2="17" y2="11" {...strokeProps} />
        </Svg>
      );
    case 'shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...strokeProps} />
        </Svg>
      );
    case 'refresh-cw':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Polyline points="23 4 23 10 17 10" {...strokeProps} />
          <Polyline points="1 20 1 14 7 14" {...strokeProps} />
          <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" {...strokeProps} />
        </Svg>
      );
    case 'link':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" {...strokeProps} />
          <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" {...strokeProps} />
        </Svg>
      );
    case 'alert-circle':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Circle cx="12" cy="12" r="10" {...strokeProps} />
          <Line x1="12" y1="8" x2="12" y2="12" {...strokeProps} />
          <Line x1="12" y1="16" x2="12.01" y2="16" {...strokeProps} />
        </Svg>
      );
    case 'sun':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Circle cx="12" cy="12" r="5" {...strokeProps} />
          <Line x1="12" y1="1" x2="12" y2="3" {...strokeProps} />
          <Line x1="12" y1="21" x2="12" y2="23" {...strokeProps} />
          <Line x1="4.22" y1="4.22" x2="5.64" y2="5.64" {...strokeProps} />
          <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" {...strokeProps} />
          <Line x1="1" y1="12" x2="3" y2="12" {...strokeProps} />
          <Line x1="21" y1="12" x2="23" y2="12" {...strokeProps} />
          <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" {...strokeProps} />
          <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" {...strokeProps} />
        </Svg>
      );
    case 'moon':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" {...strokeProps} />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Circle cx="12" cy="12" r="8" {...strokeProps} />
        </Svg>
      );
  }
}

export function MaterialCommunityIcons({ name, size = 20, color = '#10B981', style }: IconProps) {
  const strokeProps = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  switch (name) {
    case 'shield-lock':
    case 'shield-lock-outline':
    case 'shield-key-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...strokeProps} />
          <Rect x="9" y="11" width="6" height="5" rx="1" {...strokeProps} />
          <Path d="M10 11V9a2 2 0 1 1 4 0v2" {...strokeProps} />
        </Svg>
      );
    case 'shield-check':
    case 'shield-check-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...strokeProps} />
          <Polyline points="9 12 11 14 15 10" {...strokeProps} />
        </Svg>
      );
    case 'lock-outline':
    case 'lock-check-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Rect x="5" y="11" width="14" height="10" rx="2" {...strokeProps} />
          <Path d="M8 11V7a4 4 0 0 1 8 0v4" {...strokeProps} />
        </Svg>
      );
    case 'qrcode':
    case 'qrcode-scan':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Rect x="3" y="3" width="7" height="7" rx="1" {...strokeProps} />
          <Rect x="14" y="3" width="7" height="7" rx="1" {...strokeProps} />
          <Rect x="3" y="14" width="7" height="7" rx="1" {...strokeProps} />
          <Rect x="14" y="14" width="3" height="3" {...strokeProps} />
          <Line x1="19" y1="14" x2="21" y2="14" {...strokeProps} />
          <Line x1="14" y1="19" x2="17" y2="19" {...strokeProps} />
          <Line x1="20" y1="18" x2="20" y2="21" {...strokeProps} />
        </Svg>
      );
    case 'check-all':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Polyline points="18 6 7 17 2 12" {...strokeProps} />
          <Polyline points="22 10 13.5 18.5 11 16" {...strokeProps} />
        </Svg>
      );
    case 'transit-connection-variant':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Circle cx="6" cy="6" r="3" {...strokeProps} />
          <Circle cx="18" cy="18" r="3" {...strokeProps} />
          <Path d="M8.5 8.5l7 7" {...strokeProps} />
          <Circle cx="18" cy="6" r="2" {...strokeProps} />
          <Circle cx="6" cy="18" r="2" {...strokeProps} />
        </Svg>
      );
    case 'message-lock':
    case 'message-lock-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...strokeProps} />
          <Rect x="10" y="9" width="4" height="3" rx="0.5" {...strokeProps} />
        </Svg>
      );
    case 'account-multiple-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...strokeProps} />
          <Circle cx="9" cy="7" r="4" {...strokeProps} />
          <Path d="M23 21v-2a4 4 0 0 0-3-3.87" {...strokeProps} />
          <Path d="M16 3.13a4 4 0 0 1 0 7.75" {...strokeProps} />
        </Svg>
      );
    case 'information-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Circle cx="12" cy="12" r="10" {...strokeProps} />
          <Line x1="12" y1="16" x2="12" y2="12" {...strokeProps} />
          <Line x1="12" y1="8" x2="12.01" y2="8" {...strokeProps} />
        </Svg>
      );
    case 'clock-outline':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Circle cx="12" cy="12" r="10" {...strokeProps} />
          <Polyline points="12 6 12 12 16 14" {...strokeProps} />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
          <Circle cx="12" cy="12" r="8" {...strokeProps} />
        </Svg>
      );
  }
}
