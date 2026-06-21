import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '../../theme';
import { House, UserCircle, MapPin } from 'phosphor-react-native';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand.default,
        tabBarInactiveTintColor: theme.colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.bg.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.subtle,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 8,
          paddingTop: 8,
          ...theme.shadows.elevation2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <House
              size={24}
              color={focused ? theme.colors.brand.default : theme.colors.text.tertiary}
              weight={focused ? 'bold' : 'regular'}
            />
          ),
          tabBarLabel: ({ focused }) => focused ? (
            <Text style={{
              fontFamily: theme.typography.caption.fontFamily,
              fontSize: 10,
              color: theme.colors.brand.default,
              marginTop: -2,
            }}>
              Dashboard
            </Text>
          ) : null,
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: 'Request',
          tabBarIcon: ({ focused }) => (
            <MapPin
              size={24}
              color={focused ? theme.colors.brand.default : theme.colors.text.tertiary}
              weight={focused ? 'bold' : 'regular'}
            />
          ),
          tabBarLabel: ({ focused }) => focused ? (
            <Text style={{
              fontFamily: theme.typography.caption.fontFamily,
              fontSize: 10,
              color: theme.colors.brand.default,
              marginTop: -2,
            }}>
              Request
            </Text>
          ) : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Donor Card',
          tabBarIcon: ({ focused }) => (
            <UserCircle
              size={24}
              color={focused ? theme.colors.brand.default : theme.colors.text.tertiary}
              weight={focused ? 'bold' : 'regular'}
            />
          ),
          tabBarLabel: ({ focused }) => focused ? (
            <Text style={{
              fontFamily: theme.typography.caption.fontFamily,
              fontSize: 10,
              color: theme.colors.brand.default,
              marginTop: -2,
            }}>
              Donor Card
            </Text>
          ) : null,
        }}
      />
    </Tabs>
  );
}
