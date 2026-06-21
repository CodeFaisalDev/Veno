import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing,
  FadeIn,
  FadeOut
} from 'react-native-reanimated';
import { Drop } from 'phosphor-react-native';
import { useTheme } from '../theme';

interface CustomLoaderProps {
  size?: 'small' | 'large';
  message?: string;
  overlay?: boolean;
  color?: string;
}

export default function CustomLoader({ size = 'large', message, overlay = false, color }: CustomLoaderProps) {
  const theme = useTheme();
  const activeColor = color || theme.colors.brand.default;
  const isSmall = size === 'small';
  
  // Animation values
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    // Pulse animation for the drop (only for large loader)
    if (!isSmall) {
      scale.value = withRepeat(
        withTiming(1.15, { duration: 800, easing: Easing.bezier(0.25, 1, 0.5, 1) }),
        -1,
        true
      );
    }

    // Smooth continuous rotation
    rotate.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
  }, [isSmall]);

  const animatedLogoStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const animatedSpinStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotate.value}deg` }],
    };
  });

  const content = (
    <View style={[styles.loaderContainer, isSmall && styles.loaderContainerSmall]}>
      {isSmall ? (
        <View style={styles.ringWrapperSmall}>
          {/* Simple clean rotating border spinner inside buttons */}
          <Animated.View style={[
            styles.spinRingSmall, 
            { borderColor: activeColor, borderTopColor: 'transparent' }, 
            animatedSpinStyle
          ]} />
        </View>
      ) : (
        <View style={styles.largeContainer}>
          <View style={styles.ringWrapper}>
            {/* Elegant rotating indicator */}
            <Animated.View style={[
              styles.spinRing, 
              { borderColor: activeColor, borderTopColor: 'transparent' }, 
              animatedSpinStyle
            ]} />

            {/* Inner drop icon pulsing gently */}
            <Animated.View style={[styles.iconWrapper, animatedLogoStyle]}>
              <Drop 
                size={26} 
                color={activeColor} 
                weight="fill" 
              />
            </Animated.View>
          </View>
          
          {message && (
            <Text style={[
              styles.messageText, 
              { 
                fontFamily: theme.typography.body.fontFamily,
                color: theme.colors.text.secondary 
              }
            ]}>
              {message}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  if (overlay) {
    return (
      <Animated.View 
        entering={FadeIn.duration(250)}
        exiting={FadeOut.duration(200)}
        style={[
          styles.overlayContainer, 
          { backgroundColor: theme.dark ? 'rgba(17, 18, 20, 0.8)' : 'rgba(250, 249, 247, 0.85)' }
        ]}
      >
        {content}
      </Animated.View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loaderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loaderContainerSmall: {
    padding: 0,
    width: 20,
    height: 20,
  },
  largeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrapper: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringWrapperSmall: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
  },
  spinRingSmall: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 0.2,
    maxWidth: 240,
  },
});
