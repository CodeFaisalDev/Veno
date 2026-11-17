import React, { useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withSequence, 
  withTiming 
} from 'react-native-reanimated';
import { House, UserCircle, MapPin } from 'phosphor-react-native';
import { useTheme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CustomTabBar({ state, descriptors, navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const focusedRoute = state.routes[state.index];
  const focusedDescriptor = descriptors[focusedRoute?.key];
  const focusedOptions = focusedDescriptor?.options;

  // Respect screen-specific tabBarStyle: { display: 'none' }
  if (focusedOptions?.tabBarStyle?.display === 'none') {
    return null;
  }

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
          bottom: insets.bottom > 0 ? insets.bottom + 8 : 20,
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.subtle,
          borderWidth: 1,
          ...(!theme.dark ? theme.shadows.elevation2 : {}),
        },
      ]}
    >
      {visibleRoutes.map((route: any) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.routes[state.index]?.key === route.key;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate({ name: route.name, merge: true });
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
  const iconScale = useSharedValue(1);

  useEffect(() => {
    if (isFocused) {
      iconScale.value = withSequence(
        withTiming(1.22, { duration: 110 }),
        withSpring(1, { damping: 10, stiffness: 220 })
      );
    } else {
      iconScale.value = withTiming(1, { duration: 100 });
    }
  }, [isFocused]);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: iconScale.value }],
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
      accessibilityRole="tab"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={styles.tabButton}
    >
      <View 
        style={[
          styles.innerPill, 
          isFocused && { 
            backgroundColor: theme.colors.brand.subtle,
            borderColor: theme.colors.brand.default + '20',
            borderWidth: 1,
          },
        ]}
      >
        <Animated.View style={[styles.iconWrapper, animatedIconStyle]}>
          {getIcon(isFocused, currentColor)}
        </Animated.View>
        <View style={styles.labelWrapper}>
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                color: currentColor,
                fontFamily: theme.typography.caption.fontFamily,
                fontWeight: isFocused ? '600' : '500',
              },
            ]}
          >
            {label}
          </Text>
        </View>
      </View>
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
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  innerPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 16,
    minWidth: 70,
  },
  iconWrapper: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelWrapper: {
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
});
