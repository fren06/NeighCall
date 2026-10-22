import { Stack } from 'expo-router';

/** Admin area: user list, approvals and reports. */
export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="user-form" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
