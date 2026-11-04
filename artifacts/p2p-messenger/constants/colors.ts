export type ThemeId = 'startup' | 'classy' | 'calm' | 'sakura' | 'playful';
export type ThemeMode = 'light' | 'dark';

export interface ColorPalette {
  text: string;
  tint: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
}

export const THEME_OPTIONS: {
  id: ThemeId;
  name: string;
  subtitle: string;
  swatch: string;
}[] = [
  { id: 'startup', name: 'Tech Startup', subtitle: 'Midnight & Cyber Lime', swatch: '#C8F432' },
  { id: 'classy', name: 'Classy Coral', subtitle: 'Deep Navy & Cream', swatch: '#FF6B5B' },
  { id: 'calm', name: 'Calm Branded', subtitle: 'Forest & Electric Purple', swatch: '#B85CF6' },
  { id: 'sakura', name: 'Sakura Rose', subtitle: 'Warm Taupe & Blush', swatch: '#E6A7B2' },
  { id: 'playful', name: 'Minimal Playful', subtitle: 'Soft Gray & Peach', swatch: '#FBC4AB' },
];

export const THEMES: Record<ThemeId, { light: ColorPalette; dark: ColorPalette }> = {
  startup: {
    light: {
      text: '#0B0B0C',
      tint: '#C8F432',
      background: '#F7F8F5',
      foreground: '#0B0B0C',
      card: '#FFFFFF',
      cardForeground: '#0B0B0C',
      primary: '#C8F432',
      primaryForeground: '#0B0B0C',
      secondary: '#EFECE6',
      secondaryForeground: '#0B0B0C',
      muted: '#F2F3EE',
      mutedForeground: '#686A63',
      accent: '#ECF8C2',
      accentForeground: '#0B0B0C',
      destructive: '#EF4444',
      destructiveForeground: '#FFFFFF',
      border: '#E4E5DF',
      input: '#FFFFFF',
    },
    dark: {
      text: '#FFFFFF',
      tint: '#C8F432',
      background: '#0B0B0C',
      foreground: '#FFFFFF',
      card: '#151618',
      cardForeground: '#FFFFFF',
      primary: '#C8F432',
      primaryForeground: '#0B0B0C',
      secondary: '#1E2023',
      secondaryForeground: '#F3F4F6',
      muted: '#181A1C',
      mutedForeground: '#9CA3AF',
      accent: '#252D14',
      accentForeground: '#C8F432',
      destructive: '#F87171',
      destructiveForeground: '#1F0909',
      border: '#26282B',
      input: '#1C1E21',
    },
  },
  classy: {
    light: {
      text: '#14213D',
      tint: '#FF6B5B',
      background: '#F4EDE0',
      foreground: '#14213D',
      card: '#FAF6EE',
      cardForeground: '#14213D',
      primary: '#FF6B5B',
      primaryForeground: '#FFFFFF',
      secondary: '#EAE0CE',
      secondaryForeground: '#14213D',
      muted: '#EFE6D5',
      mutedForeground: '#5C667B',
      accent: '#FFE2DE',
      accentForeground: '#9E2A1C',
      destructive: '#DC2626',
      destructiveForeground: '#FFFFFF',
      border: '#DFD4C0',
      input: '#FFFFFF',
    },
    dark: {
      text: '#F4EDE0',
      tint: '#FF6B5B',
      background: '#14213D',
      foreground: '#F4EDE0',
      card: '#1D2D50',
      cardForeground: '#F4EDE0',
      primary: '#FF6B5B',
      primaryForeground: '#14213D',
      secondary: '#253861',
      secondaryForeground: '#F4EDE0',
      muted: '#1A2949',
      mutedForeground: '#9BA8C2',
      accent: '#3B2B3E',
      accentForeground: '#FF9E93',
      destructive: '#F87171',
      destructiveForeground: '#2A0E10',
      border: '#2C406E',
      input: '#22345A',
    },
  },
  calm: {
    light: {
      text: '#1F302B',
      tint: '#B85CF6',
      background: '#EBDCC4',
      foreground: '#1F302B',
      card: '#F7EFE2',
      cardForeground: '#1F302B',
      primary: '#B85CF6',
      primaryForeground: '#FFFFFF',
      secondary: '#DFCEB2',
      secondaryForeground: '#1F302B',
      muted: '#E5D5BA',
      mutedForeground: '#566862',
      accent: '#EFE1FC',
      accentForeground: '#5B1E8A',
      destructive: '#DC2626',
      destructiveForeground: '#FFFFFF',
      border: '#D4C2A4',
      input: '#FBF6EE',
    },
    dark: {
      text: '#EBDCC4',
      tint: '#B85CF6',
      background: '#1F302B',
      foreground: '#EBDCC4',
      card: '#283D37',
      cardForeground: '#EBDCC4',
      primary: '#B85CF6',
      primaryForeground: '#FFFFFF',
      secondary: '#314A43',
      secondaryForeground: '#EBDCC4',
      muted: '#243731',
      mutedForeground: '#A3B5AE',
      accent: '#392D4C',
      accentForeground: '#DCB4FE',
      destructive: '#F87171',
      destructiveForeground: '#2A0E10',
      border: '#38544C',
      input: '#2D443D',
    },
  },
  sakura: {
    light: {
      text: '#2B2320',
      tint: '#E6A7B2',
      background: '#FAF7F5',
      foreground: '#2B2320',
      card: '#FFFFFF',
      cardForeground: '#2B2320',
      primary: '#E6A7B2',
      primaryForeground: '#2B161A',
      secondary: '#EFEAE6',
      secondaryForeground: '#3D322E',
      muted: '#F3EFEA',
      mutedForeground: '#8A7F78',
      accent: '#F9E6EA',
      accentForeground: '#5E2A35',
      destructive: '#E11D48',
      destructiveForeground: '#FFFFFF',
      border: '#E6DFDA',
      input: '#FFFFFF',
    },
    dark: {
      text: '#FAF7F5',
      tint: '#E6A7B2',
      background: '#1A1514',
      foreground: '#FAF7F5',
      card: '#261F1D',
      cardForeground: '#FAF7F5',
      primary: '#E6A7B2',
      primaryForeground: '#261216',
      secondary: '#332A27',
      secondaryForeground: '#EFEAE6',
      muted: '#221C1A',
      mutedForeground: '#A89D96',
      accent: '#3D282C',
      accentForeground: '#F7D6DC',
      destructive: '#FB7185',
      destructiveForeground: '#2A0810',
      border: '#3B312E',
      input: '#2E2523',
    },
  },
  playful: {
    light: {
      text: '#18181B',
      tint: '#FBC4AB',
      background: '#FFFFFF',
      foreground: '#18181B',
      card: '#F8F9FA',
      cardForeground: '#18181B',
      primary: '#FBC4AB',
      primaryForeground: '#2E180E',
      secondary: '#E5E7EB',
      secondaryForeground: '#1F2937',
      muted: '#F3F4F6',
      mutedForeground: '#6B7280',
      accent: '#FDE8DF',
      accentForeground: '#7C2D12',
      destructive: '#EF4444',
      destructiveForeground: '#FFFFFF',
      border: '#E5E7EB',
      input: '#FFFFFF',
    },
    dark: {
      text: '#F9FAFB',
      tint: '#FBC4AB',
      background: '#121214',
      foreground: '#F9FAFB',
      card: '#1C1C1F',
      cardForeground: '#F9FAFB',
      primary: '#FBC4AB',
      primaryForeground: '#29140A',
      secondary: '#27272B',
      secondaryForeground: '#E5E7EB',
      muted: '#18181B',
      mutedForeground: '#9CA3AF',
      accent: '#38261E',
      accentForeground: '#FCD5C3',
      destructive: '#F87171',
      destructiveForeground: '#2A0E10',
      border: '#2E2E33',
      input: '#242428',
    },
  },
};

const colors = {
  light: THEMES.startup.light,
  dark: THEMES.startup.dark,
  radius: 14,
};

export default colors;
