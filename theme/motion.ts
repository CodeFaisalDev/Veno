import { Easing } from 'react-native-reanimated';

export const durations = {
  instant: 80,
  fast: 150,
  base: 250,
  slow: 400,
  crawl: 600,
};

export const easings = {
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  decelerate: Easing.bezier(0, 0, 0.2, 1),
  accelerate: Easing.bezier(0.4, 0, 1, 1),
};

export const springConfigs = {
  default: {
    stiffness: 90,
    damping: 15,
    mass: 1,
  },
  toggle: {
    stiffness: 140,
    damping: 18,
    mass: 1,
  },
};
