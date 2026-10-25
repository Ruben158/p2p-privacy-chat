/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#E9F0EF',
    tint: '#39D98A',

    // Core surfaces
    background: '#081417',
    foreground: '#E9F0EF',

    // Cards / elevated surfaces
    card: '#102126',
    cardForeground: '#E9F0EF',

    // Primary action color (buttons, links, active states)
    primary: '#39D98A',
    primaryForeground: '#092019',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#193037',
    secondaryForeground: '#DCE8E6',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#14272C',
    mutedForeground: '#91A7A7',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#1D3B3D',
    accentForeground: '#C5F7DF',

    // Destructive actions (delete, error states)
    destructive: '#FF6B6B',
    destructiveForeground: '#2B1011',

    // Borders and input outlines
    border: '#20363A',
    input: '#294247',
  },

  dark: {
    text: '#E9F0EF',
    tint: '#39D98A',
    background: '#081417',
    foreground: '#E9F0EF',
    card: '#102126',
    cardForeground: '#E9F0EF',
    primary: '#39D98A',
    primaryForeground: '#092019',
    secondary: '#193037',
    secondaryForeground: '#DCE8E6',
    muted: '#14272C',
    mutedForeground: '#91A7A7',
    accent: '#1D3B3D',
    accentForeground: '#C5F7DF',
    destructive: '#FF6B6B',
    destructiveForeground: '#2B1011',
    border: '#20363A',
    input: '#294247',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 12,
};

export default colors;
