// constants/theme.ts
// Design system Workly — paleta negro puro + acento dorado, tipografía Plus Jakarta Sans.
// Reemplaza tu archivo actual src/constants/theme.ts manteniendo los nombres de exportación.

import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────
// PALETA — los nombres se conservan para no romper pantallas
// ─────────────────────────────────────────────────────────
export const lightColors = {
  // Marca
  primary: '#0A0A0A',   // Negro puro como acción principal en light
  primaryGlow: '#1A1A1A',
  accent: '#C8A24B',   // Dorado elegante (uso secundario)
  onPrimary: '#FFFFFF', // Texto/icono sobre fondo primario (blanco en light)

  // Superficies
  background: '#FAFAF7',   // Off-white cálido (no blanco quirúrgico)
  card: '#FFFFFF',
  inputBackground: '#F2F1EC',
  headerBg: '#FFFFFF',

  // Texto
  text: '#0A0A0A',
  textLight: '#66635C',
  white: '#FFFFFF',

  // Bordes
  border: '#E8E5DC',

  // Estados
  accept: '#1F7A4D',
  reject: '#B23A3A',
  warning: '#C8A24B',
};

export const darkColors = {
  // Marca — negro puro + dorado luminoso
  primary: '#E8C56C',   // Dorado vivo en dark = acento primario
  primaryGlow: '#F4D98A',
  accent: '#E8C56C',
  onPrimary: '#000000', // Texto/icono sobre fondo primario (negro en dark)

  // Superficies — NEGRO puro, sin tinte azul
  background: '#000000',
  card: '#0C0C0C',
  inputBackground: '#141414',
  headerBg: '#000000',

  // Texto
  text: '#F5F2EB',
  textLight: '#8A867E',
  white: '#FFFFFF',

  // Bordes (gris neutro, NO azul)
  border: '#1F1D1A',

  // Estados
  accept: '#3DBE7A',
  reject: '#FF6B6B',
  warning: '#E8C56C',
};

export type ThemeColors = typeof lightColors;

// ─────────────────────────────────────────────────────────
// TIPOGRAFÍA — Plus Jakarta Sans (toda la app)
// ─────────────────────────────────────────────────────────
export const FONTS = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

// Helper para aplicar la familia y unificar letterSpacing/line-heights.
export const type = {
  display: { fontFamily: FONTS.extrabold, fontSize: 32, letterSpacing: -0.6, lineHeight: 38 },
  h1: { fontFamily: FONTS.bold, fontSize: 26, letterSpacing: -0.4, lineHeight: 32 },
  h2: { fontFamily: FONTS.bold, fontSize: 20, letterSpacing: -0.2, lineHeight: 26 },
  h3: { fontFamily: FONTS.semibold, fontSize: 17, letterSpacing: -0.1, lineHeight: 22 },
  body: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22 },
  bodyMd: { fontFamily: FONTS.medium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: FONTS.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: FONTS.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  overline: { fontFamily: FONTS.bold, fontSize: 10, lineHeight: 12, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  button: { fontFamily: FONTS.bold, fontSize: 15, letterSpacing: 0.2 },
};

// ─────────────────────────────────────────────────────────
// SIZES — espaciado y radios (mantiene compatibilidad)
// ─────────────────────────────────────────────────────────
export const SIZES = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 44,

  radius_sm: 10,
  radius: 14,
  radius_lg: 20,
  radius_xl: 28,
  radius_full: 999,
};

// ─────────────────────────────────────────────────────────
// SHADOWS — refinadas y suaves (no las de stock RN)
// ─────────────────────────────────────────────────────────
export const SHADOWS = Platform.select({
  ios: {
    light: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.10,
      shadowRadius: 20,
    },
    glow: {
      shadowColor: '#C8A24B',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 18,
    },
  },
  default: {
    light: { elevation: 2 },
    medium: { elevation: 6 },
    glow: { elevation: 8 },
  },
}) as {
  light: any; medium: any; glow: any;
};

// Helper opcional
export const withFont = (variant: keyof typeof type) => type[variant];
