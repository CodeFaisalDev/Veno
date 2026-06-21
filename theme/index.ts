import React, { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { lightThemeColors, darkThemeColors, primitives } from './colors';
import { typeScale } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';
import { lightShadows, darkShadows } from './shadows';
import { durations, easings, springConfigs } from './motion';

const defaultTheme = {
  colors: lightThemeColors,
  primitives,
  typography: typeScale,
  spacing,
  radius,
  shadows: lightShadows,
  motion: { durations, easings, springConfigs },
  dark: false,
};

type ThemeType = typeof defaultTheme;

const ThemeContext = createContext<ThemeType>(defaultTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme: ThemeType = {
    colors: isDark ? darkThemeColors : lightThemeColors,
    primitives,
    typography: typeScale,
    spacing,
    radius,
    shadows: isDark ? darkShadows : lightShadows,
    motion: { durations, easings, springConfigs },
    dark: isDark,
  };

  return React.createElement(ThemeContext.Provider, { value: theme }, children);
}

export function useTheme() {
  return useContext(ThemeContext);
}
