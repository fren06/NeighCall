// Data access layer. Screens only talk to these functions, so swapping the
// mock implementation for Supabase later doesn't touch any UI code.
import { analyzeText } from '@/lib/mock-ai';
import * as mock from '@/lib/mock-data';
import { supabase } from '@/lib/supabase';
import { DEFAULT_NOTIFICATIONS, isAdmin, isStaff } from '@/types/models';
import type {
  Bulletin,
  BulletinInput,
  ChatMessage,
  ConversationSummary,
  Estate,
  FeedPost,
  ManagementOverview,
  NewPostInput,
  PostAnalysis,
  PostStatus,
  Report,
  ReportDetail,
  ReportStatus,
  ReportTarget,
  SignUpInput,
  User,
} from '@/types/models';

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export class ApiError extends Error {}

// ─── Supabase helpers ─────────────────────────────────────────────────────
// Sections below marked "Supabase" talk to the real backend; the rest still
// use mock-data until they're migrated.

/** Unwraps a Supabase response, turning its error into an ApiError. */
function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new ApiError(error.message);
  return data;
}

const USER_COLUMNS =
  'id, estate_id, name, email, phone, block, unit_number, street, skills, notifications, role, status, admin_note, warning_count, created_at';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toUser = (row: any): User => ({ ...row, admin_note: row.admin_note ?? undefined });

async function fetchProfile(id: string): Promise<User> {
  const row = check(await supabase.from('users').select(USER_COLUMNS).eq('id', id).maybeSingle());
  if (!row) throw new ApiError('No NeighCall profile was found for this account.');
  return toUser(row);
}

const AUTH_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Incorrect email or password.',
  'User already registered': 'An account with this email already exists.',
};
const authError = (message: string) => new ApiError(AUTH_MESSAGES[message] ?? message);

// ─── Estates & accounts (Supabase) ────────────────────────────────────────

export async function getEstates(): Promise<Estate[]> {
  return check(await supabase.from('estates').select('id, name, area').order('name')) ?? [];
}

export async function getEstate(id: string): Promise<Estate | undefined> {
  return check(await supabase.from('estates').select('id, name, area').eq('id', id).maybeSingle()) ?? undefined;
}

export async function signUp(input: SignUpInput): Promise<User> {
  const { email, password, ...profile } = input;
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    // Read by the handle_new_auth_user trigger to create the profile row.
    options: { data: profile },
  });
  if (error) throw authError(error.message);
  if (!data.session || !data.user) {
    throw new ApiError('Check your email to confirm your account, then sign in.');
  }
  return fetchProfile(data.user.id);
}

export async function signIn(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw authError(error.message);
  try {
    return await fetchProfile(data.user.id);
  } catch (e) {
    await supabase.auth.signOut({ scope: 'local' });
    throw e;
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
}

/** The signed-in user from a saved login, if there is one. */
export async function restoreSession(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  try {
    return await fetchProfile(data.session.user.id);
  } catch {
    await signOut();
    return null;
  }
}

/** Calls back when the login ends elsewhere (expired, or signed out on another tab). */
export function onSignedOut(callback: () => void) {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') callback();
  });
  return () => data.subscription.unsubscribe();
}

/** Always resolves, so the response never reveals whether an account exists. */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!email.trim()) throw new ApiError('Enter your email address.');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) throw new ApiError(error.message);
}

/** Latest copy of a user, e.g. to notice when management has reviewed them. */
export async function getUser(id: string): Promise<User | undefined> {
  const row = check(await supabase.from('users').select(USER_COLUMNS).eq('id', id).maybeSingle());
  return row ? toUser(row) : undefined;
}

/** Fields a user may send when editing their own profile. */
type ProfileChanges = Partial<
  Pick<User, 'name' | 'phone' | 'block' | 'unit_number' | 'street' | 'skills' | 'notifications'>
>;

/** Resubmitting details after "needs_info" puts the user back in the queue. */
export async function updateProfile(userId: string, changes: ProfileChanges): Promise<User> {
  const current = await fetchProfile(userId);
  const status = current.status === 'needs_info' ? 'pending' : current.status;
  const row = check(
    await supabase.from('users').update({ ...changes, status }).eq('id', userId).select(USER_COLUMNS).single()
  );
  return toUser(row);
}

// ─── Posting (Supabase) ───────────────────────────────────────────────────

/** Runs the AI pipeline on draft text (mock: keyword rules, on the device). */
export async function analyzePost(
  author: User,
  content: string,
  isAnonymous: boolean
): Promise<PostAnalysis> {
  await delay(500);
  return analyzeText(content, isAnonymous ? undefined : author.block);
}

/** Approved neighbours in the author's estate who have the given skill. */
export async function countSkillMatches(
  _author: User,
  category: PostAnalysis['category']
): Promise<number> {
  return check(await supabase.rpc('count_skill_matches', { p_category: category })) ?? 0;
}

/**
 * Uploads a photo picked on the device to the public `post-media` bucket.
 * The path is "<estate>/<random>" — never the user id, which would reveal
 * who wrote an anonymous post.
 */
async function uploadPostPhoto(author: User, uri: string): Promise<string> {
  const res = await fetch(uri);
  const body = await res.arrayBuffer();
  const contentType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `${author.estate_id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const { error } = await supabase.storage.from('post-media').upload(path, body, { contentType });
  if (error) throw new ApiError(`Couldn't upload the photo: ${error.message}`);
  return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
}

export async function createPost(
  author: User,
  input: NewPostInput
): Promise<{ post: FeedPost; notified: number }> {
  const analysis = analyzeText(input.content, input.is_anonymous ? undefined : author.block);
  const mediaUrl = input.media_uri ? await uploadPostPhoto(author, input.media_uri) : null;

  // The server picks the anonymous alias and counts skill matches.
  const result = check(
    await supabase.rpc('create_post', {
      p_content: input.content.trim(),
      p_is_anonymous: input.is_anonymous,
      p_media_url: mediaUrl,
      p_category: analysis.category,
      p_tools_needed: analysis.tools_needed,
      p_urgency: analysis.urgency,
      p_punchline: analysis.punchline,
    })
  ) as { id: string; notified: number };

  const post = await getPost(author, result.id);
  if (!post) throw new ApiError('Your request was posted but could not be loaded.');
  return { post, notified: result.notified };
}

// ─── Feed (Supabase) ──────────────────────────────────────────────────────

/** Row shape of the `feed_posts` view (never includes the author's id). */
interface FeedRow {
  id: string;
  estate_id: string;
  content: string;
  media_url: string | null;
  category: string | null;
  tools_needed: string[];
  urgency: PostAnalysis['urgency'] | null;
  punchline: string | null;
  status: PostStatus;
  created_at: string;
  is_anonymous: boolean;
  anon_alias: string | null;
  author_name: string | null;
  author_block: string | null;
  is_mine: boolean;
  helper_count: number;
}

const toFeedPost = (r: FeedRow): FeedPost => ({
  id: r.id,
  estate_id: r.estate_id,
  author: r.is_anonymous
    ? { kind: 'anonymous', alias: r.anon_alias ?? 'Neighbour' }
    : { kind: 'public', name: r.author_name ?? 'Neighbour', block: r.author_block ?? '?' },
  is_mine: r.is_mine,
  content: r.content,
  media_url: r.media_url ?? undefined,
  analysis:
    r.category && r.urgency
      ? {
          category: r.category as PostAnalysis['category'],
          tools_needed: r.tools_needed,
          urgency: r.urgency,
          punchline: r.punchline ?? '',
        }
      : undefined,
  status: r.status,
  helper_count: Number(r.helper_count),
  created_at: r.created_at,
});

/** The viewer's estate feed, newest first (the view scopes it to their estate). */
export async function getFeed(_viewer: User): Promise<FeedPost[]> {
  const rows = check(
    await supabase.from('feed_posts').select('*').order('created_at', { ascending: false })
  ) as FeedRow[] | null;
  return (rows ?? []).map(toFeedPost);
}

export async function getPost(_viewer: User, postId: string): Promise<FeedPost | undefined> {
  const row = check(
    await supabase.from('feed_posts').select('*').eq('id', postId).maybeSingle()
  ) as FeedRow | null;
  return row ? toFeedPost(row) : undefined;
}

/** Author-only: move a request between open / in progress / resolved. */
export async function updatePostStatus(
  _viewer: User,
  postId: string,
  status: PostStatus
): Promise<void> {
  const rows = check(
    await supabase.from('posts').update({ status }).eq('id', postId).select('id')
  );
  if (!rows?.length) throw new ApiError('You can only update your own requests.');
}

/** Author-only: removes the request; its chats are deleted with it. */
export async function deletePost(_viewer: User, postId: string): Promise<void> {
  const rows = check(await supabase.from('posts').delete().eq('id', postId).select('id'));
  if (!rows?.length) throw new ApiError('You can only delete your own requests.');
}

/** Bulletins still pinned for the estate, newest first. */
export async function getActiveBulletins(_estateId: string): Promise<Bulletin[]> {
  const now = new Date().toISOString();
  const rows = check(
    await supabase
      .from('bulletins')
      .select('*')
      .or(`pinned_until.is.null,pinned_until.gt.${now}`)
      .order('created_at', { ascending: false })
  );
  return (rows ?? []) as Bulletin[];
}

export async function createReport(
  _reporterId: string,
  target_type: ReportTarget,
  target_id: string,
  reason: string
): Promise<void> {
  check(
    await supabase.rpc('create_report', {
      p_target_type: target_type,
      p_target_id: target_id,
      p_reason: reason,
    })
  );
}

// ─── Chat (Supabase) ──────────────────────────────────────────────────────
// Chats are read only through server functions: they label each message as
// me / them / system, so an anonymous requester's user id never reaches the
// helper's device.

/**
 * Calls `onChange` whenever a message is added to the conversation. The
 * server sends an empty "changed" ping on channel `chat:<id>`; the screen
 * then refetches through getConversation.
 */
export function subscribeToConversation(conversationId: string, onChange: () => void) {
  const channel = supabase
    .channel(`chat:${conversationId}`)
    .on('broadcast', { event: 'changed' }, () => onChange())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function getConversations(_viewer: User): Promise<ConversationSummary[]> {
  return (check(await supabase.rpc('get_my_conversations')) ?? []) as ConversationSummary[];
}

export async function getConversation(
  _viewer: User,
  conversationId: string
): Promise<{ summary: ConversationSummary; messages: ChatMessage[] }> {
  return check(await supabase.rpc('get_conversation', { p_id: conversationId })) as {
    summary: ConversationSummary;
    messages: ChatMessage[];
  };
}

/** Opens (or reuses) the helper's 1-to-1 chat with the post's author. */
export async function offerHelp(_viewer: User, postId: string): Promise<string> {
  return check(await supabase.rpc('offer_help', { p_post_id: postId })) as string;
}

export async function sendMessage(_viewer: User, conversationId: string, text: string) {
  check(await supabase.rpc('send_message', { p_conversation_id: conversationId, p_text: text }));
}

/** Posts the viewer's verified contact card (built server-side) into the chat. */
export async function shareIdentity(_viewer: User, conversationId: string) {
  check(await supabase.rpc('share_identity', { p_conversation_id: conversationId }));
}

/** Reports the other participant; their user id is resolved server-side. */
export async function reportChatPeer(_viewer: User, conversationId: string, reason: string) {
  check(
    await supabase.rpc('report_chat_peer', { p_conversation_id: conversationId, p_reason: reason })
  );
}

/**
 * Settings an approved resident can change freely. Name, address and estate
 * were verified by management, so they aren't editable here.
 */
export async function updatePreferences(
  userId: string,
  changes: Partial<Pick<User, 'phone' | 'skills' | 'notifications'>>
): Promise<User> {
  const row = check(
    await supabase.from('users').update(changes).eq('id', userId).select(USER_COLUMNS).single()
  );
  return toUser(row);
}


// ─── Management (staff only) ──────────────────────────────────────────────

function assertStaff(viewer: User) {
  if (!isStaff(viewer)) throw new ApiError('Staff access only.');
}

function assertAdmin(viewer: User) {
  if (!isAdmin(viewer)) throw new ApiError('Admin access only.');
}

const estateResidents = (viewer: User) =>
  mock.users.filter((u) => u.role === 'resident' && u.estate_id === viewer.estate_id);

/** Accounts an admin looks after: residents and management staff (not admins). */
const estateManaged = (viewer: User) =>
  mock.users.filter((u) => u.role !== 'admin' && u.estate_id === viewer.estate_id);

export async function getManagementOverview(viewer: User): Promise<ManagementOverview> {
  assertStaff(viewer);
  await delay(250);
  const residents = estateResidents(viewer);
  const now = new Date().toISOString();
  return {
    pending_residents: residents.filter((u) => u.status === 'pending').length,
    open_reports: mock.reports.filter((r) => r.status === 'open').length,
    investigating_reports: mock.reports.filter((r) => r.status === 'investigating').length,
    active_bulletins: mock.bulletins.filter(
      (b) => b.estate_id === viewer.estate_id && (!b.pinned_until || b.pinned_until > now)
    ).length,
    resident_count: residents.filter((u) => u.status === 'approved').length,
  };
}

/** Residents and management staff of the admin's estate, newest first. */
export async function getResidents(viewer: User): Promise<User[]> {
  assertAdmin(viewer);
  await delay(300);
  return estateManaged(viewer)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((u) => ({ ...u }));
}

/** Approve, ask for more info, reject, suspend or reinstate a resident. */
export async function reviewResident(
  viewer: User,
  userId: string,
  status: User['status'],
  note?: string
): Promise<User> {
  assertAdmin(viewer);
  await delay(300);
  const user = estateManaged(viewer).find((u) => u.id === userId);
  if (!user) throw new ApiError('User not found.');
  if (status === 'needs_info' && !note?.trim()) {
    throw new ApiError('Tell the resident what information you need.');
  }
  user.status = status;
  user.admin_note = status === 'approved' ? undefined : note?.trim() || undefined;
  return { ...user };
}

function describeTarget(r: Report): { excerpt: string; offenderId?: string; postExists: boolean } {
  if (r.target_type === 'post') {
    const post = mock.posts.find((p) => p.id === r.target_id);
    return post
      ? { excerpt: post.content, offenderId: post.author_id, postExists: true }
      : { excerpt: 'This post has been removed.', postExists: false };
  }
  if (r.target_type === 'message') {
    const msg = mock.messages.find((m) => m.id === r.target_id);
    return msg
      ? { excerpt: msg.text ?? 'Shared details card', offenderId: msg.sender_id, postExists: false }
      : { excerpt: 'This message is no longer available.', postExists: false };
  }
  const u = mock.users.find((x) => x.id === r.target_id);
  return { excerpt: u ? `Account: ${u.name}` : 'Unknown account', offenderId: u?.id, postExists: false };
}

/** Report queue with context. Staff can see who is behind anonymous posts. */
export async function getReports(viewer: User): Promise<ReportDetail[]> {
  assertStaff(viewer);
  await delay(300);
  return mock.reports
    .map((report): ReportDetail => {
      const { excerpt, offenderId, postExists } = describeTarget(report);
      const offender = mock.users.find((u) => u.id === offenderId);
      return {
        report: { ...report },
        reporter_name: mock.users.find((u) => u.id === report.reporter_id)?.name ?? 'Unknown',
        target_excerpt: excerpt,
        offender: offender && {
          id: offender.id,
          name: offender.name,
          block: offender.block,
          status: offender.status,
        },
        post_exists: postExists,
      };
    })
    .sort((a, b) => b.report.created_at.localeCompare(a.report.created_at));
}

export async function updateReportStatus(
  viewer: User,
  reportId: string,
  status: ReportStatus
): Promise<void> {
  assertStaff(viewer);
  await delay(200);
  const report = mock.reports.find((r) => r.id === reportId);
  if (!report) throw new ApiError('Report not found.');
  report.status = status;
  report.handled_by = viewer.id;
}

export type ModerationAction = 'delete_post' | 'warn_user' | 'suspend_user';

/** One-click moderation. Acting on a report also resolves it. */
export async function moderate(
  viewer: User,
  reportId: string,
  action: ModerationAction
): Promise<string> {
  assertStaff(viewer);
  await delay(300);
  const report = mock.reports.find((r) => r.id === reportId);
  if (!report) throw new ApiError('Report not found.');
  const { offenderId } = describeTarget(report);
  const offender = estateResidents(viewer).find((u) => u.id === offenderId);
  let outcome: string;

  if (action === 'delete_post') {
    const index = mock.posts.findIndex((p) => p.id === report.target_id);
    if (index < 0) throw new ApiError('That post is already gone.');
    mock.posts.splice(index, 1);
    outcome = 'Post deleted';
  } else {
    if (!offender) throw new ApiError('No resident account is linked to this report.');
    if (action === 'warn_user') {
      offender.warning_count = (offender.warning_count ?? 0) + 1;
      outcome = `Warning issued to ${offender.name}`;
    } else {
      offender.status = 'suspended';
      offender.admin_note = 'Suspended after a community report.';
      outcome = `${offender.name} suspended`;
    }
  }
  report.status = 'resolved';
  report.handled_by = viewer.id;
  report.resolution_note = outcome;
  return outcome;
}

/** Every bulletin for the estate, including expired ones. */
export async function getAllBulletins(viewer: User): Promise<Bulletin[]> {
  assertStaff(viewer);
  await delay(250);
  return mock.bulletins
    .filter((b) => b.estate_id === viewer.estate_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((b) => ({ ...b }));
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

function inQuietHours(user: User, now = new Date()) {
  const { enabled, start, end } = user.notifications.quiet_hours;
  if (!enabled) return false;
  const t = now.getHours() * 60 + now.getMinutes();
  const [s, e] = [toMinutes(start), toMinutes(end)];
  return s <= e ? t >= s && t < e : t >= s || t < e;
}

/**
 * Publishes a notice. Important notices bypass quiet hours; ordinary ones are
 * held back for residents who are currently muted. Mock push: counts only.
 */
export async function publishBulletin(
  viewer: User,
  input: BulletinInput
): Promise<{ bulletin: Bulletin; notified: number; held_back: number }> {
  assertStaff(viewer);
  await delay(500);
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new ApiError('Add a title and a message.');

  const bulletin: Bulletin = {
    id: `blt-${Date.now()}`,
    estate_id: viewer.estate_id,
    admin_id: viewer.id,
    title,
    body,
    is_high_priority: input.is_high_priority,
    pinned_until: new Date(Date.now() + input.pin_days * 86_400_000).toISOString(),
    created_at: new Date().toISOString(),
  };
  mock.bulletins.unshift(bulletin);

  const audience = estateResidents(viewer).filter((u) => u.status === 'approved');
  const held = input.is_high_priority ? [] : audience.filter((u) => inQuietHours(u));
  return { bulletin, notified: audience.length - held.length, held_back: held.length };
}

export async function deleteBulletin(viewer: User, bulletinId: string): Promise<void> {
  assertStaff(viewer);
  await delay(200);
  const index = mock.bulletins.findIndex((b) => b.id === bulletinId);
  if (index >= 0) mock.bulletins.splice(index, 1);
}


// ─── Admin (user list management) ─────────────────────────────────────────

export interface AdminOverview {
  pending: number;
  approved: number;
  restricted: number;
  staff: number;
  open_reports: number;
  investigating_reports: number;
}

export async function getAdminOverview(viewer: User): Promise<AdminOverview> {
  assertAdmin(viewer);
  await delay(250);
  const residents = estateResidents(viewer);
  const count = (...s: User['status'][]) => residents.filter((u) => s.includes(u.status)).length;
  return {
    pending: count('pending', 'needs_info'),
    approved: count('approved'),
    restricted: count('rejected', 'suspended'),
    staff: estateManaged(viewer).filter((u) => u.role === 'management').length,
    open_reports: mock.reports.filter((r) => r.status === 'open').length,
    investigating_reports: mock.reports.filter((r) => r.status === 'investigating').length,
  };
}

export interface AdminUserInput {
  name: string;
  email: string;
  phone: string;
  block: string;
  unit_number: string;
  street: string;
  skills: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateAdminUser(input: AdminUserInput) {
  if (!input.name.trim()) throw new ApiError('Enter the resident’s name.');
  if (!EMAIL_RE.test(input.email.trim())) throw new ApiError('Enter a valid email address.');
  if (input.phone.replace(/\D/g, '').length < 9) throw new ApiError('Enter a valid phone number.');
  if (!input.block.trim() || !input.unit_number.trim() || !input.street.trim()) {
    throw new ApiError('Block, unit number and street are required.');
  }
}

const cleanUserInput = (input: AdminUserInput): AdminUserInput => ({
  skills: input.skills,
  name: input.name.trim(),
  email: input.email.trim().toLowerCase(),
  phone: input.phone.trim(),
  block: input.block.trim(),
  unit_number: input.unit_number.trim(),
  street: input.street.trim(),
});

/**
 * Adds a resident or a management account directly. Both are pre-verified,
 * so they start approved.
 */
export async function adminCreateUser(
  viewer: User,
  input: AdminUserInput & { password: string; role?: 'resident' | 'management' }
): Promise<User> {
  assertAdmin(viewer);
  await delay(400);
  validateAdminUser(input);
  if (input.password.length < 8) throw new ApiError('Use a password of at least 8 characters.');
  const data = cleanUserInput(input);
  if (mock.users.some((u) => u.email === data.email)) {
    throw new ApiError('An account with this email already exists.');
  }
  const user: User = {
    ...data,
    estate_id: viewer.estate_id,
    notifications: DEFAULT_NOTIFICATIONS,
    id: `usr-${Date.now()}`,
    role: input.role ?? 'resident',
    status: 'approved',
    created_at: new Date().toISOString(),
  };
  mock.users.push(user);
  mock.passwords[data.email] = input.password;
  return { ...user };
}

/** Edits a resident's or manager's details (not their role, status or password). */
export async function adminUpdateUser(
  viewer: User,
  userId: string,
  input: AdminUserInput
): Promise<User> {
  assertAdmin(viewer);
  await delay(300);
  const user = estateManaged(viewer).find((u) => u.id === userId);
  if (!user) throw new ApiError('User not found.');
  validateAdminUser(input);
  const data = cleanUserInput(input);
  if (data.email !== user.email) {
    if (mock.users.some((u) => u.email === data.email)) {
      throw new ApiError('Another account already uses this email.');
    }
    // Keep the mock sign-in credentials attached to the new email.
    mock.passwords[data.email] = mock.passwords[user.email];
    delete mock.passwords[user.email];
  }
  Object.assign(user, data);
  return { ...user };
}

/** Permanently removes a resident along with their posts and chats. */
export async function adminDeleteUser(viewer: User, userId: string): Promise<void> {
  assertAdmin(viewer);
  await delay(300);
  const user = estateManaged(viewer).find((u) => u.id === userId);
  if (!user) throw new ApiError('User not found.');
  purgeUser(user);
}

/** Lets a resident delete their own account and everything they posted (Supabase). */
export async function deleteOwnAccount(viewer: User): Promise<void> {
  if (viewer.role !== 'resident') throw new ApiError('Staff accounts are removed by an admin.');
  check(await supabase.rpc('delete_own_account'));
  await signOut();
}

function purgeUser(user: User) {
  const userId = user.id;
  const gone = new Set(
    mock.conversations
      .filter((c) => c.requester_id === userId || c.helper_id === userId)
      .map((c) => c.id)
  );
  const keep = <T>(list: T[], pred: (item: T) => boolean) => {
    for (let i = list.length - 1; i >= 0; i--) if (!pred(list[i])) list.splice(i, 1);
  };
  keep(mock.messages, (m) => !gone.has(m.conversation_id));
  keep(mock.conversations, (c) => !gone.has(c.id));
  keep(mock.posts, (p) => p.author_id !== userId);
  keep(mock.users, (u) => u.id !== userId);
  delete mock.passwords[user.email];
}

