import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Color Palettes ───────────────────────────────────────────────────────────

export const lightColors = {
  primary: '#6366F1',
  secondary: '#818CF8',
  background: '#F9FAFB',
  card: '#FFFFFF',
  white: '#FFFFFF',
  black: '#000000',
  text: '#111827',
  textLight: '#6B7280',
  accept: '#10B981',
  reject: '#EF4444',
  border: '#E5E7EB',
  inputBackground: '#F3F4F6',
  transparent: 'transparent',
  tabBar: '#FFFFFF',
  headerBg: '#FFFFFF',
};

export const darkColors = {
  primary: '#818CF8',
  secondary: '#6366F1',
  background: '#0F172A',
  card: '#1E293B',
  white: '#1E293B',
  black: '#F8FAFC',
  text: '#F1F5F9',
  textLight: '#94A3B8',
  accept: '#34D399',
  reject: '#F87171',
  border: '#334155',
  inputBackground: '#1E293B',
  transparent: 'transparent',
  tabBar: '#1E293B',
  headerBg: '#1E293B',
};

export type AppColors = typeof lightColors;

// ─── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextData {
  isDark: boolean;
  toggleTheme: () => void;
  colors: AppColors;
}

const ThemeContext = createContext<ThemeContextData>({
  isDark: false,
  toggleTheme: () => {},
  colors: lightColors,
});

const STORAGE_KEY = '@workly_theme';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState(false);

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value === 'dark') setIsDark(true);
    });
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors: isDark ? darkColors : lightColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
