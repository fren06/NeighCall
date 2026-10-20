import { Stack } from 'expo-router';

/** Staff area (estate management / admin): the tab bar plus modal screens. */
export default function ManagementLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="compose-bulletin" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
