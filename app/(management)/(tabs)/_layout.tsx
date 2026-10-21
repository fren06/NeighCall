import { palette } from '@/lib/theme';
import { useIsDark } from '@/lib/theme-mode';
import { Tabs } from 'expo-router/js-tabs';
import { Flag, LayoutDashboard, Megaphone } from 'lucide-react-native';
import React from 'react';

export default function ManagementTabs() {
  const colors = palette[useIsDark() ? 'dark' : 'light'];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="overview"
        options={{
          title: 'Overview',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="issues"
        options={{
          title: 'Issues',
          tabBarIcon: ({ color, size }) => <Flag color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="bulletins"
        options={{
          title: 'Bulletins',
          tabBarIcon: ({ color, size }) => <Megaphone color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
