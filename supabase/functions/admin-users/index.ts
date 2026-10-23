// Edge Function: account changes only the server may make, because they
// need Supabase's secret key. Callable by approved admins only, and only
// for residents and managers in the admin's own estate.
//
//   { action: "create", user: { name, email, password, role, phone, block,
//                               unit_number, street, skills } }
//   { action: "update_email", user_id, email }
//
// Deploy with JWT verification off; the function checks the caller itself.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MANAGED_ROLES = ['resident', 'management'];

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** The project's secret key (new-style first, legacy service_role as backup). */
function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    const key = keys.default ?? Object.values(keys)[0];
    if (typeof key === 'string' && key) return key;
  } catch {
    // fall through
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}

function friendlyAuthError(message: string) {
  if (/already|in use|exists|duplicate/i.test(message)) {
    return 'An account with this email already exists.';
  }
  if (/password/i.test(message)) return message;
  console.error('admin-users:', message);
  return 'Could not save the account. Please try again.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const authorization = req.headers.get('Authorization') ?? '';
  const asCaller = createClient(url, req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: auth } = await asCaller.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
  if (!auth.user) return reply({ error: 'Please sign in.' }, 401);

  const { data: me } = await asCaller
    .from('users')
    .select('role, status, estate_id')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (me?.role !== 'admin' || me.status !== 'approved') {
    return reply({ error: 'Admin access only.' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply({ error: 'Send a JSON body.' }, 400);
  }

  // Everything below runs with full access, so check inputs carefully.
  const admin = createClient(url, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (body.action === 'create') {
    const u = (body.user ?? {}) as Record<string, unknown>;
    const email = text(u.email).toLowerCase();
    const password = typeof u.password === 'string' ? u.password : '';
    const role = text(u.role) || 'resident';
    const profile = {
      name: text(u.name),
      phone: text(u.phone),
      block: text(u.block),
      unit_number: text(u.unit_number),
      street: text(u.street),
      skills: Array.isArray(u.skills) ? u.skills.filter((s) => typeof s === 'string') : [],
    };
    if (!MANAGED_ROLES.includes(role)) return reply({ error: 'Unknown role.' }, 400);
    if (!EMAIL_RE.test(email)) return reply({ error: 'Enter a valid email address.' }, 400);
    if (password.length < 8) return reply({ error: 'The password needs at least 8 characters.' }, 400);
    if (!profile.name || !profile.phone || !profile.block || !profile.unit_number || !profile.street) {
      return reply({ error: 'Fill in every field.' }, 400);
    }

    // The on_auth_user_created trigger turns this metadata into the profile row.
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { ...profile, estate_id: me.estate_id },
    });
    if (error || !created.user) {
      return reply({ error: friendlyAuthError(error?.message ?? '') }, 400);
    }

    // Added by an admin, so already verified.
    const { error: roleError } = await admin
      .from('users')
      .update({ role, status: 'approved', skills: role === 'management' ? [] : profile.skills })
      .eq('id', created.user.id);
    if (roleError) {
      await admin.auth.admin.deleteUser(created.user.id);
      console.error('admin-users create: profile update failed', roleError);
      return reply({ error: 'Could not save the account. Please try again.' }, 500);
    }
    return reply({ id: created.user.id });
  }

  if (body.action === 'update_email') {
    const userId = text(body.user_id);
    const email = text(body.email).toLowerCase();
    if (!EMAIL_RE.test(email)) return reply({ error: 'Enter a valid email address.' }, 400);

    const { data: target } = await admin
      .from('users')
      .select('estate_id, role, email')
      .eq('id', userId)
      .maybeSingle();
    if (!target || target.estate_id !== me.estate_id || !MANAGED_ROLES.includes(target.role)) {
      return reply({ error: 'User not found.' }, 404);
    }
    if (target.email === email) return reply({ id: userId });
    const { data: taken } = await admin.from('users').select('id').eq('email', email).maybeSingle();
    if (taken) return reply({ error: 'An account with this email already exists.' }, 400);

    // The login email lives in Supabase Auth; the profile keeps a copy.
    const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (error) return reply({ error: friendlyAuthError(error.message) }, 400);

    const { error: profileError } = await admin.from('users').update({ email }).eq('id', userId);
    if (profileError) {
      await admin.auth.admin.updateUserById(userId, { email: target.email, email_confirm: true });
      console.error('admin-users update_email: profile update failed', profileError);
      return reply({ error: friendlyAuthError(profileError.message) }, 400);
    }
    return reply({ id: userId });
  }

  return reply({ error: 'Unknown action.' }, 400);
});
