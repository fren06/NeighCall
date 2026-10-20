// App-wide light/dark preference. Held in memory for now; can be persisted
// on the device later.
import type { ModeType } from '@/components/ui/gluestack-ui-provider';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

const ThemeModeContext = createContext<{
  mode: ModeType;
  setMode: (mode: ModeType) => void;
} | null>(null);

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ModeType>('system');
  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

/** Whether the app is currently dark, honouring the user's choice over the OS. */
export function useIsDark() {
  const { mode } = useThemeMode();
  const system = useColorScheme();
  return mode === 'system' ? system === 'dark' : mode === 'dark';
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used inside <ThemeModeProvider>');
  return ctx;
}
