// src/context/ThemeContext.tsx
// Context con paleta negro puro + dorado.
// API conservada: useTheme() => { colors, isDark, toggleTheme }

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, ThemeColors } from '../constants/theme';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

// Default seguro: NUNCA undefined.
const defaultValue: ThemeContextValue = {
  colors: darkColors,
  isDark: true,
  toggleTheme: () => { },
};

const ThemeContext = createContext<ThemeContextValue>(defaultValue);

const STORAGE_KEY = '@workly_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = Appearance.getColorScheme();
  const [isDark, setIsDark] = useState<boolean>(systemScheme !== 'light');

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'dark') setIsDark(true);
        else if (stored === 'light') setIsDark(false);
      } catch { }
    })();
  }, []);

  const toggleTheme = async () => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(() => { });
      return next;
    });
  };

  const colors = (isDark ? darkColors : lightColors) || darkColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  // Fallback defensivo para evitar `Cannot read property 'background' of undefined`
  if (!ctx || !ctx.colors) return defaultValue;
  return ctx;
};
