// Holds the signed-in user, backed by Supabase Auth.
import * as api from '@/lib/api';
import type { SignUpInput, User } from '@/types/models';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface SessionValue {
  user: User | null;
  /** False until a saved login has been checked on startup. */
  ready: boolean;
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .restoreSession()
      .then(setUser)
      .finally(() => setReady(true));
    return api.onSignedOut(() => setUser(null));
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      ready,
      signIn: async (email, password) => setUser(await api.signIn(email, password)),
      signUp: async (input) => setUser(await api.signUp(input)),
      signOut: () => {
        setUser(null);
        void api.signOut();
      },
      deleteAccount: async () => {
        if (!user) return;
        await api.deleteOwnAccount(user);
        setUser(null);
      },
      setUser,
    }),
    [user, ready]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
