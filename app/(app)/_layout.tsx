import { InboxProvider } from '@/lib/inbox';
import { Stack } from 'expo-router';

/** Signed-in area: the tab bar plus screens that open on top of it. */
export default function AppLayout() {
  return (
    <InboxProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="new-post" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
      </Stack>
    </InboxProvider>
  );
}
