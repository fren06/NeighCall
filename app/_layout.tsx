import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';
import { SessionProvider, useSession } from '@/lib/session';
import { ThemeModeProvider, useIsDark, useThemeMode } from '@/lib/theme-mode';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  return (
    <ThemeModeProvider>
      <SessionProvider>
        <RootLayoutNav />
      </SessionProvider>
    </ThemeModeProvider>
  );
}

function RootLayoutNav() {
  const isDark = useIsDark();
  const { mode } = useThemeMode();
  const { user } = useSession();
  const status = user?.status;

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GluestackUIProvider mode={mode}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {/* Each group is only reachable in the matching session state;
              when the state changes, the router sends the user to index,
              which redirects to the right place. */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Protected guard={!user}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={!!user && status !== 'approved'}>
              <Stack.Screen name="pending" />
            </Stack.Protected>
            <Stack.Protected guard={status === 'approved'}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>
          </Stack>
        </GluestackUIProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
