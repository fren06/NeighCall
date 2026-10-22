// Holds the signed-in user. Mock for now; will wrap Supabase auth later.
import * as api from '@/lib/api';
import type { SignUpInput, User } from '@/types/models';
import React, { createContext, useContext, useMemo, useState } from 'react';

interface SessionValue {
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => void;
  /** Permanently deletes the signed-in resident's account, then signs out. */
  deleteAccount: () => Promise<void>;
  /** Replace the cached user, e.g. after a profile update. */
  setUser: (user: User) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      signIn: async (email, password) => setUser(await api.signIn(email, password)),
      signUp: async (input) => setUser(await api.signUp(input)),
      signOut: () => setUser(null),
      deleteAccount: async () => {
        if (!user) return;
        await api.deleteOwnAccount(user);
        setUser(null);
      },
      setUser,
    }),
    [user]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
