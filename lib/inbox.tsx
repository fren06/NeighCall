// The resident's notification inbox: the unread count for the bell, kept
// live by one realtime subscription shared by every screen that needs it.
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface InboxValue {
  unread: number;
  /** Goes up whenever the inbox changes, so open lists know to reload. */
  version: number;
  refresh: () => void;
}

const InboxContext = createContext<InboxValue>({ unread: 0, version: 0, refresh: () => {} });

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const userId = user?.id;
  const [unread, setUnread] = useState(0);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    if (!userId) return;
    setVersion((v) => v + 1);
    api.countUnreadNotifications().then(setUnread, () => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }
    refresh();
    return api.subscribeToInbox(userId, refresh);
  }, [userId, refresh]);

  const value = useMemo(() => ({ unread, version, refresh }), [unread, version, refresh]);
  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export const useInbox = () => useContext(InboxContext);
