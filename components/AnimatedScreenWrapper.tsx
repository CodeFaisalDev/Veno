import React from 'react';
import { StyleSheet, View } from 'react-native';

interface AnimatedScreenWrapperProps {
  children: React.ReactNode;
  style?: any;
  screenIndex?: number;
}

export default function AnimatedScreenWrapper({ children, style }: AnimatedScreenWrapperProps) {
  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
