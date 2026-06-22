import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useNavigation } from 'expo-router';
import { useTheme } from '../theme';

interface AnimatedScreenWrapperProps {
  children: React.ReactNode;
  style?: any;
  screenIndex?: number;
}

export default function AnimatedScreenWrapper({ children, style }: AnimatedScreenWrapperProps) {
  const theme = useTheme();
  const navigation = useNavigation();
  const [isFocused, setIsFocused] = useState(true);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsFocused(true);
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsFocused(false);
    });

    // Check if currently focused
    setIsFocused(navigation.isFocused());

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation]);

  useEffect(() => {
    if (isFocused) {
      opacity.value = withTiming(1, { 
        duration: theme.motion.durations.fast, // 150ms
      });
    } else {
      opacity.value = 0;
    }
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
