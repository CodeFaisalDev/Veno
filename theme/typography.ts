import { Platform } from 'react-native';

export const fontFamilies = {
  sansRegular: Platform.select({
    ios: 'DMSans_400Regular',
    android: 'DMSans_400Regular',
    default: 'sans-serif',
  }),
  sansMedium: Platform.select({
    ios: 'DMSans_500Medium',
    android: 'DMSans_500Medium',
    default: 'sans-serif-medium',
  }),
  sansSemiBold: Platform.select({
    ios: 'DMSans_600SemiBold',
    android: 'DMSans_600SemiBold',
    default: 'sans-serif-condensed',
  }),
  mono: Platform.select({
    ios: 'DMMono_500Medium',
    android: 'DMMono_500Medium',
    default: 'monospace',
  }),
};

export const typeScale = {
  display: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 32,
    lineHeight: 38,
  },
  h1: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 24,
    lineHeight: 30,
  },
  h2: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  h3: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 17,
    lineHeight: 22,
  },
  bodyLg: {
    fontFamily: fontFamilies.sansRegular,
    fontSize: 16,
    lineHeight: 24,
  },
  body: {
    fontFamily: fontFamilies.sansRegular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodySm: {
    fontFamily: fontFamilies.sansRegular,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  blood: {
    fontFamily: fontFamilies.mono,
    fontSize: 22,
  },
  badge: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
};
