import { useSession } from '@/lib/session';
import { Redirect } from 'expo-router';

/** Entry point: routes the user based on their account status. */
export default function Index() {
  const { user } = useSession();

  if (!user) return <Redirect href="/welcome" />;
  if (user.status !== 'approved') return <Redirect href="/pending" />;
  return <Redirect href="/home" />;
}
 