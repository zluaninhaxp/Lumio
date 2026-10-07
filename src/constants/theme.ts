import { Platform, type ViewStyle } from 'react-native';

const PAGE_BACKGROUND = '#F3FFF9';
// Existing cool off-white, reserved for internal page backgrounds.
const APP_BACKGROUND = '#F8FCFA';

export const Colors = {
  // Paleta principal
  bg: PAGE_BACKGROUND,
  appBackground: APP_BACKGROUND,
  bgCard: '#FFFFFF',
  primary: '#111111',
  accent: '#00A878',
  accentLight: '#E6F7F1',
  accentSoft: '#F0FAF6',
  accentGlow: '#DDF4EC',
  danger: '#E05555',
  dangerLight: '#FFF0F0',
  textSecondary: '#6B6B6B',
  textMuted: '#AAAAAA',
  border: '#DDEBE4',

  // Bolhas de chat
  bubbleUser: '#202B38',
  bubbleBot: '#FFFFFF',
  chatBackground: APP_BACKGROUND,
  mintBackground: PAGE_BACKGROUND,
  bottomSurface: '#E6F7F1',
  ink: '#202B38',
  composerDivider: '#DCECE6',
  composerPlaceholder: '#818C9C',
  accentDisabled: '#A9D9CA',

  // Status
  success: '#00A878',
  warning: '#F59E0B',
} as const;

// Neutral content elevation. boxShadow runs on both platforms with the
// project's New Architecture (Android outset shadows require Android 9+).
// Surface roles: neutral controls, white content, then overlays. Brand fills
// remain explicit state overrides, never the default outline or shadow.
export const SurfaceColors = {
  control: Colors.bgCard,
  card: Colors.bgCard,
  overlay: Colors.bgCard,
  disabled: '#ECEFF1',
  subtleBorder: '#E1E5E8',
  controlBorder: '#C9D0D4',
  focusBorder: Colors.accent,
  errorBorder: Colors.danger,
  backdrop: 'rgba(32,43,56,0.40)',
} as const;

export const SurfaceElevation = {
  control: 'none',
  list: '0 1px 4px -2px rgba(32,43,56,0.08), 0 1px 1px rgba(32,43,56,0.03)',
  card: '0 1px 4px -2px rgba(32,43,56,0.08), 0 1px 1px rgba(32,43,56,0.03)',
  message: '0 4px 8px -2px rgba(32,43,56,0.16), 0 1px 2px rgba(32,43,56,0.07)',
  overlay: '0 10px 24px -4px rgba(32,43,56,0.20), 0 2px 6px rgba(32,43,56,0.09)',
  floating: '0 5px 12px -2px rgba(32,43,56,0.22)',
  userMessage: '0 3px 8px rgba(32,43,56,0.16)',
} as const;

// RN 0.81 outset boxShadow works with New Architecture on Android 9+.
// Older supported Android versions use native elevation instead, never both.
function surfaceElevation(role: keyof typeof SurfaceElevation): { boxShadow?: string; elevation?: number } {
  if (Platform.OS === 'android' && Number(Platform.Version) < 28) {
    const levels = { control: 0, list: 1, card: 1, message: 2, overlay: 8, floating: 6, userMessage: 2 };
    return { elevation: levels[role] };
  }
  return { boxShadow: SurfaceElevation[role] };
}

export const SurfaceStyles = {
  control: { backgroundColor: SurfaceColors.control, borderWidth: 1, borderColor: SurfaceColors.controlBorder, ...surfaceElevation('control') },
  filter: { backgroundColor: SurfaceColors.card, borderWidth: 1, borderColor: SurfaceColors.controlBorder, ...surfaceElevation('control') },
  tonal: { backgroundColor: SurfaceColors.control },
  card: { backgroundColor: SurfaceColors.card, borderWidth: 1, borderColor: SurfaceColors.subtleBorder, ...surfaceElevation('card') },
  // Grouped navigation and read-only rows use depth rather than an outline.
  list: { backgroundColor: SurfaceColors.card, ...surfaceElevation('list') },
  message: { backgroundColor: Colors.bubbleBot, ...surfaceElevation('message') },
  overlay: { backgroundColor: SurfaceColors.overlay, borderWidth: 1, borderColor: SurfaceColors.subtleBorder, ...surfaceElevation('overlay') },
  floating: { ...surfaceElevation('floating') },
  userMessage: { ...surfaceElevation('userMessage') },
  controlFocus: { borderColor: SurfaceColors.focusBorder },
  controlError: { borderColor: SurfaceColors.errorBorder },
  controlDisabled: { backgroundColor: SurfaceColors.disabled, borderColor: SurfaceColors.subtleBorder },
  actionDisabled: { backgroundColor: Colors.accentDisabled, ...surfaceElevation('control') },
  backdrop: { backgroundColor: SurfaceColors.backdrop },
} satisfies Record<string, ViewStyle>;

export const Typography = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  heavy: 'PlusJakartaSans_800ExtraBold',
} as const;

// Exact visual values of the approved onboarding confirmation.
export const DialogTokens = {
  backdrop: 'rgba(18, 39, 32, 0.42)',
  icon: '#07856D',
  secondary: '#087E68',
  message: '#62736E',
  radius: 28,
  maxWidth: 360,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
} as const;
