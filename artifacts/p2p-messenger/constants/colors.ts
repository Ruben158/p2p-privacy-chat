export type ThemeId = 'emerald' | 'sakura' | 'amber' | 'sage';
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
  { id: 'sakura', name: 'Sakura Rose', subtitle: 'Blossom pink', swatch: '#EC487F' },
  { id: 'amber', name: 'Sunset Amber', subtitle: 'Warm tangerine', swatch: '#F26430' },
  { id: 'sage', name: 'Forest Sage', subtitle: 'Botanical green', swatch: '#2D6A4F' },
  { id: 'emerald', name: 'Mint Emerald', subtitle: 'DirectChat jade', swatch: '#10B981' },
];

export const THEMES: Record<ThemeId, { light: ColorPalette; dark: ColorPalette }> = {
  sakura: {
    light: {
      text: '#1F1216',
      tint: '#EC487F',
      background: '#FFF5F7',
      foreground: '#1F1216',
      card: '#FFFFFF',
      cardForeground: '#1F1216',
      primary: '#EC487F',
      primaryForeground: '#FFFFFF',
      secondary: '#FCE7F0',
      secondaryForeground: '#4A1525',
      muted: '#F9E2EC',
      mutedForeground: '#8C6773',
      accent: '#FADCE6',
      accentForeground: '#4A1525',
      destructive: '#E11D48',
      destructiveForeground: '#FFFFFF',
      border: '#F3CEDB',
      input: '#FFFFFF',
    },
    dark: {
      text: '#FDF2F6',
      tint: '#F4729B',
      background: '#0F0A0C',
      foreground: '#FDF2F6',
      card: '#1C1317',
      cardForeground: '#FDF2F6',
      primary: '#F4729B',
      primaryForeground: '#260812',
      secondary: '#281B21',
      secondaryForeground: '#FCE7F0',
      muted: '#22161B',
      mutedForeground: '#A67F8D',
      accent: '#3B1D29',
      accentForeground: '#FCE7F0',
      destructive: '#FB7185',
      destructiveForeground: '#2A0810',
      border: '#332028',
      input: '#24171D',
    },
  },
  amber: {
    light: {
      text: '#1C1613',
      tint: '#F26430',
      background: '#FAF6F0',
      foreground: '#1C1613',
      card: '#FFFFFF',
      cardForeground: '#1C1613',
      primary: '#F26430',
      primaryForeground: '#FFFFFF',
      secondary: '#F2ECE4',
      secondaryForeground: '#3D291E',
      muted: '#EFEAE2',
      mutedForeground: '#7C7067',
      accent: '#FDE6D8',
      accentForeground: '#7C2D12',
      destructive: '#DC2626',
      destructiveForeground: '#FFFFFF',
      border: '#E6DEC8',
      input: '#FFFFFF',
    },
    dark: {
      text: '#FAF5F0',
      tint: '#F59E0B',
      background: '#12100E',
      foreground: '#FAF5F0',
      card: '#1C1917',
      cardForeground: '#FAF5F0',
      primary: '#F59E0B',
      primaryForeground: '#1F1204',
      secondary: '#292421',
      secondaryForeground: '#F5EBE1',
      muted: '#24201D',
      mutedForeground: '#9E9287',
      accent: '#3B2510',
      accentForeground: '#FEF3C7',
      destructive: '#F87171',
      destructiveForeground: '#2A0E10',
      border: '#302A25',
      input: '#26211E',
    },
  },
  sage: {
    light: {
      text: '#111C15',
      tint: '#1B4D2E',
      background: '#F4F9F5',
      foreground: '#111C15',
      card: '#FFFFFF',
      cardForeground: '#111C15',
      primary: '#1B4D2E',
      primaryForeground: '#FFFFFF',
      secondary: '#E6F0E9',
      secondaryForeground: '#143621',
      muted: '#EBF3ED',
      mutedForeground: '#5C7464',
      accent: '#DCFCE7',
      accentForeground: '#14532D',
      destructive: '#DC2626',
      destructiveForeground: '#FFFFFF',
      border: '#D5E4DA',
      input: '#FFFFFF',
    },
    dark: {
      text: '#F0F7F2',
      tint: '#74C69D',
      background: '#0A0F0C',
      foreground: '#F0F7F2',
      card: '#131B16',
      cardForeground: '#F0F7F2',
      primary: '#74C69D',
      primaryForeground: '#081C12',
      secondary: '#1B2720',
      secondaryForeground: '#D8F3DC',
      muted: '#17211B',
      mutedForeground: '#7C9483',
      accent: '#1E3528',
      accentForeground: '#D8F3DC',
      destructive: '#F87171',
      destructiveForeground: '#2A0E10',
      border: '#233329',
      input: '#1A261F',
    },
  },
  emerald: {
    light: {
      text: '#0F1715',
      tint: '#10B981',
      background: '#F2FBF7',
      foreground: '#0F1715',
      card: '#FFFFFF',
      cardForeground: '#0F1715',
      primary: '#10B981',
      primaryForeground: '#FFFFFF',
      secondary: '#E6F4EE',
      secondaryForeground: '#064E3B',
      muted: '#EAF5F0',
      mutedForeground: '#5B7068',
      accent: '#D1FAE5',
      accentForeground: '#064E3B',
      destructive: '#EF4444',
      destructiveForeground: '#FFFFFF',
      border: '#D0E8DD',
      input: '#FFFFFF',
    },
    dark: {
      text: '#ECF4F1',
      tint: '#10B981',
      background: '#070E10',
      foreground: '#ECF4F1',
      card: '#0E1A1D',
      cardForeground: '#ECF4F1',
      primary: '#10B981',
      primaryForeground: '#042318',
      secondary: '#15262B',
      secondaryForeground: '#DAE8E4',
      muted: '#112024',
      mutedForeground: '#859E9B',
      accent: '#14332C',
      accentForeground: '#D1FAE5',
      destructive: '#F87171',
      destructiveForeground: '#2A0E10',
      border: '#1C3035',
      input: '#223A40',
    },
  },
};

const colors = {
  light: THEMES.emerald.light,
  dark: THEMES.emerald.dark,
  radius: 14,
};

export default colors;
