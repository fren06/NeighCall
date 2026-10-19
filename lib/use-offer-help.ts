import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { useNotify } from '@/lib/use-notify';
import { router } from 'expo-router';
import { useCallback } from 'react';

/** Opens (or reuses) a chat with the post's author and navigates to it. */
export function useOfferHelp() {
  const { user } = useSession();
  const notify = useNotify();

  return useCallback(
    async (postId: string) => {
      if (!user) return;
      try {
        const id = await api.offerHelp(user, postId);
        router.push({ pathname: '/chat/[id]', params: { id } });
      } catch (e) {
        notify("Couldn't open chat", (e as Error).message);
      }
    },
    [user, notify]
  );
}
