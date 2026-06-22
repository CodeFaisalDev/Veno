import React from 'react';
import { Tabs } from 'expo-router';
import CustomTabBar from '../../components/CustomTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: 'Request',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Donor Card',
        }}
      />
    </Tabs>
  );
}

