// The resident's notification inbox: the unread count for the bell, kept
// live by one realtime subscription shared by every screen that needs it.
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

interface InboxValue {
  unread: number;
  /** Goes up whenever the inbox changes, so open lists know to reload. */
  version: number;
  refresh: () => void;
}

const InboxContext = createContext<InboxValue>({ unread: 0, version: 0, refresh: () => {} });

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useSession();
  const userId = user?.id;
  const [unread, setUnread] = useState(0);
  const [version, setVersion] = useState(0);

  // The account's status as the app knows it; compared after each change.
  const known = useRef({ status: user?.status, note: user?.admin_note });
  known.current = { status: user?.status, note: user?.admin_note };

  const refresh = useCallback(() => {
    if (!userId) return;
    setVersion((v) => v + 1);
    api.countUnreadNotifications().then(setUnread, () => {});
    // Being suspended or restored arrives as a notification, so re-check the
    // account too; the app then shows or hides the suspended notice live.
    api.getUser(userId).then((latest) => {
      if (latest && (latest.status !== known.current.status || latest.admin_note !== known.current.note)) {
        setUser(latest);
      }
    }, () => {});
  }, [userId, setUser]);

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
