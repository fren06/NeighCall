import { useSession } from '@/lib/session';
import { isAdmin, isStaff } from '@/types/models';
import { Redirect, type Href } from 'expo-router';

/** Entry point: routes the user based on their account status. */
export default function Index() {
  const { user, ready } = useSession();

  if (!ready) return null; // still checking for a saved login
  if (!user) return <Redirect href="/welcome" />;
  // Suspended residents still get the (read-only) app; see 0005_suspended_residents.sql.
  const suspendedResident = user.role === 'resident' && user.status === 'suspended';
  if (user.status !== 'approved' && !suspendedResident) return <Redirect href="/pending" />;
  if (isAdmin(user)) return <Redirect href={'/dashboard' as Href} />;
  if (isStaff(user)) return <Redirect href={'/overview' as Href} />;
  return <Redirect href="/home" />;
}
 