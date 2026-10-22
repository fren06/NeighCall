import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';
import { SessionProvider, useSession } from '@/lib/session';
import { isAdmin, isStaff } from '@/types/models';
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
  const admin = !!user && isAdmin(user);
  const staff = !!user && isStaff(user) && !admin;

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
            {/* (auth) also holds the pending screen, so it stays open
                until the account is approved. */}
            <Stack.Protected guard={status !== 'approved'}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={status === 'approved' && !staff && !admin}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>
            <Stack.Protected guard={status === 'approved' && admin}>
              <Stack.Screen name="(admin)" />
            </Stack.Protected>
            <Stack.Protected guard={status === 'approved' && staff}>
              <Stack.Screen name="(management)" />
            </Stack.Protected>
          </Stack>
        </GluestackUIProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
