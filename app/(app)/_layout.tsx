import { Stack } from 'expo-router';

/** Signed-in area: the tab bar plus screens that open on top of it. */
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="new-post" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
