export const primitives = {
  red: {
    50: '#FFF0F0',
    100: '#FFCCD1',
    200: '#FFA3AB',
    300: '#FF707E',
    400: '#E63C4E',
    500: '#A11A22', // Deep brand red (warm-minimalist, deep, not bright neon red)
    600: '#8A151C', // Deep dark red
    700: '#720F15',
    800: '#5A0B0E',
    900: '#420608',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#FAF9F7',
    100: '#F2F0EC',
    200: '#E8E5DF',
    300: '#D4D0C8',
    400: '#8C9099',
    500: '#686B73',
    600: '#4D4F55',
    700: '#2E3033', // grayish dark border
    800: '#1A1C1E', // grayish dark surface
    850: '#111214', // grayish dark page bg
    900: '#090A0C', // grayish dark deep background
  },
  green: {
    50: '#EFFBF4',
    100: '#C8F0D8',
    400: '#34B56A',
    500: '#1F9952',
    600: '#157A40',
    800: '#093D20',
  },
  amber: {
    50: '#FFFBEB',
    100: '#FEF0C0',
    400: '#FBB834',
    500: '#E69B10',
    600: '#B87A08',
    800: '#5C3C04',
  },
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    800: '#1E3A8A',
  },
  overlay: {
    light: 'rgba(0, 0, 0, 0.04)',
    medium: 'rgba(0, 0, 0, 0.40)',
    heavy: 'rgba(0, 0, 0, 0.72)',
  }
};

export const lightThemeColors = {
  bg: {
    page: primitives.neutral[50],
    surface: primitives.neutral[0],
    surfaceRaised: primitives.neutral[0],
    subtle: primitives.neutral[100],
    overlay: primitives.overlay.medium,
  },
  text: {
    primary: primitives.neutral[900],
    secondary: primitives.neutral[500],
    tertiary: primitives.neutral[400],
    onColor: primitives.neutral[0],
    link: primitives.red[500],
  },
  border: {
    subtle: primitives.neutral[200],
    default: primitives.neutral[300],
    strong: primitives.neutral[400],
  },
  brand: {
    default: primitives.red[500],
    hover: primitives.red[600],
    subtle: primitives.red[50],
    text: primitives.red[600],
  },
  status: {
    active: primitives.green[500],
    activeBg: primitives.green[50],
    activeText: primitives.green[600],
    pending: primitives.amber[500],
    pendingBg: primitives.amber[50],
    pendingText: primitives.amber[600],
    critical: primitives.red[500],
    criticalBg: primitives.red[50],
    criticalText: primitives.red[600],
    cooldown: primitives.neutral[400],
    cooldownBg: primitives.neutral[100],
    cooldownText: primitives.neutral[600],
    info: primitives.blue[500],
    infoBg: primitives.blue[50],
    infoText: primitives.blue[600],
  }
};

export const darkThemeColors = {
  bg: {
    page: primitives.neutral[850],
    surface: primitives.neutral[800],
    surfaceRaised: '#1F2123', // grayish dark surface raised
    subtle: primitives.neutral[700],
    overlay: primitives.overlay.medium,
  },
  text: {
    primary: primitives.neutral[50],
    secondary: primitives.neutral[400],
    tertiary: primitives.neutral[500],
    onColor: primitives.neutral[0],
    link: primitives.red[400],
  },
  border: {
    subtle: primitives.neutral[700],
    default: primitives.neutral[600],
    strong: primitives.neutral[500],
  },
  brand: {
    default: primitives.red[500],
    hover: primitives.red[600],
    subtle: primitives.red[900],
    text: primitives.red[300],
  },
  status: {
    active: primitives.green[500],
    activeBg: primitives.green[800],
    activeText: primitives.green[100],
    pending: primitives.amber[500],
    pendingBg: primitives.amber[800],
    pendingText: primitives.amber[100],
    critical: primitives.red[500],
    criticalBg: primitives.red[900],
    criticalText: primitives.red[200],
    cooldown: primitives.neutral[400],
    cooldownBg: primitives.neutral[700],
    cooldownText: primitives.neutral[300],
    info: primitives.blue[500],
    infoBg: primitives.blue[800],
    infoText: primitives.blue[100],
  }
};
