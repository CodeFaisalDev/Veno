import React, { useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { House, UserCircle, MapPin } from 'phosphor-react-native';
import { useTheme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CustomTabBar({ state, descriptors, navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Filter out any screens that might be hidden or invalid
  const visibleRoutes = state.routes.filter((route: any) => {
    const { options } = descriptors[route.key];
    return options.tabBarButton === undefined || typeof options.tabBarButton !== 'function';
  });

  return (
    <View
      style={[
        styles.container,
        {
          bottom: insets.bottom > 0 ? insets.bottom + 8 : 16,
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.subtle,
          borderWidth: theme.dark ? 0 : 1,
          ...(!theme.dark ? theme.shadows.elevation2 : {}),
        },
      ]}
    >
      {visibleRoutes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TabItem
            key={route.key}
            routeName={route.name}
            label={label as string}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </View>
  );
}

interface TabItemProps {
  routeName: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ routeName, label, isFocused, onPress, onLongPress }: TabItemProps) {
  const theme = useTheme();
  
  const scale = useSharedValue(isFocused ? 1.08 : 1);
  const labelOpacity = useSharedValue(isFocused ? 1 : 0);
  const labelTranslateY = useSharedValue(isFocused ? 0 : 4);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.08 : 1, theme.motion.springConfigs.default);
    labelOpacity.value = withTiming(isFocused ? 1 : 0, { duration: theme.motion.durations.fast });
    labelTranslateY.value = withTiming(isFocused ? 0 : 4, { duration: theme.motion.durations.fast });
  }, [isFocused]);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const animatedLabelStyle = useAnimatedStyle(() => {
    return {
      opacity: labelOpacity.value,
      transform: [{ translateY: labelTranslateY.value }],
    };
  });

  const getIcon = (focused: boolean, color: string) => {
    const size = 22;
    const weight = focused ? 'bold' : 'regular';
    switch (routeName) {
      case 'index':
        return <House size={size} color={color} weight={weight} />;
      case 'request':
        return <MapPin size={size} color={color} weight={weight} />;
      case 'profile':
        return <UserCircle size={size} color={color} weight={weight} />;
      default:
        return null;
    }
  };

  const activeColor = theme.colors.brand.default;
  const inactiveColor = theme.colors.text.tertiary;
  const currentColor = isFocused ? activeColor : inactiveColor;

  return (
    <TouchableOpacity
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabButton}
      activeOpacity={0.8}
    >
      <Animated.View style={[styles.iconWrapper, animatedIconStyle]}>
        {getIcon(isFocused, currentColor)}
      </Animated.View>
      <Animated.View style={animatedLabelStyle}>
        {isFocused && (
          <Text
            style={[
              styles.label,
              {
                color: activeColor,
                fontFamily: theme.typography.caption.fontFamily,
              },
            ]}
          >
            {label}
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    position: 'absolute',
    left: 20,
    right: 20,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingVertical: 8,
  },
  iconWrapper: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
});
