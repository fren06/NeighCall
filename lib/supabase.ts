// Supabase client shared by the whole app. Only lib/api.ts and lib/session.tsx
// should import it; screens go through those.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!rawUrl || !key) {
  throw new Error(
    'Missing Supabase settings. Copy .env.example to .env.local, fill it in, then restart `expo start`.'
  );
}

// Strip any trailing slashes or /rest/v1 paths if pasted from the API URL settings.
const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

// Web pages are also rendered on the server, where there is no browser
// storage; the session only needs to persist in the real app/browser.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(url, key, {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    persistSession: !isServer,
    autoRefreshToken: !isServer,
    detectSessionInUrl: false,
  },
});

// Keep the login fresh only while the app is open (recommended for mobile).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
