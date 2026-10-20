import { useSession } from '@/lib/session';
import { isStaff } from '@/types/models';
import { Redirect, type Href } from 'expo-router';

/** Entry point: routes the user based on their account status. */
export default function Index() {
  const { user } = useSession();

  if (!user) return <Redirect href="/welcome" />;
  if (user.status !== 'approved') return <Redirect href="/pending" />;
  if (isStaff(user)) return <Redirect href={'/overview' as Href} />;
  return <Redirect href="/home" />;
}
 