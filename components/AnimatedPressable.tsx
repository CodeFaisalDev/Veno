import React from 'react';
import { Pressable, PressableProps, GestureResponderEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends PressableProps {
  children: React.ReactNode;
  style?: any;
  activeScale?: number;
}

export default function AnimatedPressable({
  children,
  style,
  activeScale = 0.96,
  onPressIn,
  onPressOut,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const handlePressIn = (e: GestureResponderEvent) => {
    scale.value = withSpring(activeScale, { damping: 14, stiffness: 320 });
    opacity.value = withSpring(0.92, { damping: 14, stiffness: 320 });
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    scale.value = withSpring(1, { damping: 14, stiffness: 320 });
    opacity.value = withSpring(1, { damping: 14, stiffness: 320 });
    if (onPressOut) onPressOut(e);
  };

  return (
    <AnimatedPressableBase
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressableBase>
  );
}
