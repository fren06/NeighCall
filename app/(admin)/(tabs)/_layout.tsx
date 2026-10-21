import { palette } from '@/lib/theme';
import { useIsDark } from '@/lib/theme-mode';
import { Tabs } from 'expo-router/js-tabs';
import { Flag, LayoutDashboard, Users } from 'lucide-react-native';
import React from 'react';

export default function AdminTabs() {
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
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <Flag color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
