import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightThemeColors, darkThemeColors, primitives } from './colors';
import { typeScale } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';
import { lightShadows, darkShadows } from './shadows';
import { durations, easings, springConfigs } from './motion';

const defaultThemeColors = lightThemeColors;
const defaultShadows = lightShadows;

const defaultTheme = {
  colors: defaultThemeColors,
  primitives,
  typography: typeScale,
  spacing,
  radius,
  shadows: defaultShadows,
  motion: { durations, easings, springConfigs },
  dark: false,
  themeMode: 'system' as 'light' | 'dark' | 'system',
  setThemeMode: async (mode: 'light' | 'dark' | 'system') => {},
};

type ThemeType = typeof defaultTheme;

const ThemeContext = createContext<ThemeType>(defaultTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    // Load stored theme mode on mount
    AsyncStorage.getItem('theme_mode').then((storedMode) => {
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
        setThemeModeState(storedMode);
      }
    });
  }, []);

  const setThemeMode = async (mode: 'light' | 'dark' | 'system') => {
    setThemeModeState(mode);
    await AsyncStorage.setItem('theme_mode', mode);
  };

  const isDark =
    themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';

  const theme: ThemeType = {
    colors: isDark ? darkThemeColors : lightThemeColors,
    primitives,
    typography: typeScale,
    spacing,
    radius,
    shadows: isDark ? darkShadows : lightShadows,
    motion: { durations, easings, springConfigs },
    dark: isDark,
    themeMode,
    setThemeMode,
  };

  return React.createElement(ThemeContext.Provider, { value: theme }, children);
}

export function useTheme() {
  return useContext(ThemeContext);
}
