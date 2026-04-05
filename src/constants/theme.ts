export const COLORS = {
  primary: '#6366F1', // Indigo
  secondary: '#818CF8', // Light Indigo
  background: '#F9FAFB', // Light Gray
  card: '#FFFFFF', // White
  text: '#111827', // Dark Gray
  textLight: '#6B7280', // Gray
  accept: '#10B981', // Emerald Green
  reject: '#EF4444', // Red
  border: '#E5E7EB', // Border Gray
  inputBackground: '#F3F4F6',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const SIZES = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  radius: 12,
  radius_lg: 20,
  radius_xl: 30,
};

export const FONTS = {
  regular: 'System', // Can be replaced with custom font
  medium: 'System',
  bold: 'System',
};

export const SHADOWS = {
  light: {
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};
