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
  ChatPeer,
  Conversation,
  ConversationSummary,
  Estate,
  FeedPost,
  ManagementOverview,
  Message,
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

// ─── Posting ──────────────────────────────────────────────────────────────

/** Runs the AI pipeline on draft text (mock: keyword rules). */
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
  author: User,
  category: PostAnalysis['category']
): Promise<number> {
  return mock.users.filter(
    (u) =>
      u.id !== author.id &&
      u.estate_id === author.estate_id &&
      u.status === 'approved' &&
      (u.skills as string[]).includes(category)
  ).length;
}

function newAlias(estateId: string) {
  const taken = new Set(
    mock.posts
      .filter((p) => p.estate_id === estateId && p.author.kind === 'anonymous')
      .map((p) => (p.author.kind === 'anonymous' ? p.author.alias : ''))
  );
  let alias: string;
  do alias = `Neighbor #${100 + Math.floor(Math.random() * 900)}`;
  while (taken.has(alias));
  return alias;
}

export async function createPost(
  author: User,
  input: NewPostInput
): Promise<{ post: FeedPost; notified: number }> {
  await delay(700);
  const analysis = analyzeText(input.content, input.is_anonymous ? undefined : author.block);
  const stored: mock.StoredPost = {
    id: `pst-${Date.now()}`,
    estate_id: author.estate_id,
    author_id: author.id,
    author: input.is_anonymous
      ? { kind: 'anonymous', alias: newAlias(author.estate_id) }
      : { kind: 'public', name: author.name, block: author.block },
    content: input.content.trim(),
    media_url: input.media_uri,
    analysis,
    status: 'open',
    helper_count: 0,
    created_at: new Date().toISOString(),
  };
  mock.posts.unshift(stored);
  const notified = await countSkillMatches(author, analysis.category);
  return { post: toFeedPost(stored, author.id), notified };
}

// ─── Feed ─────────────────────────────────────────────────────────────────

/** Strips the private author_id, like the future `feed_posts` view will. */
function toFeedPost({ author_id, ...post }: mock.StoredPost, viewerId: string): FeedPost {
  return { ...post, is_mine: author_id === viewerId };
}

export async function getFeed(viewer: User): Promise<FeedPost[]> {
  await delay(600);
  return mock.posts
    .filter((p) => p.estate_id === viewer.estate_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((p) => toFeedPost(p, viewer.id));
}

export async function getPost(viewer: User, postId: string): Promise<FeedPost | undefined> {
  await delay(200);
  const post = mock.posts.find((p) => p.id === postId && p.estate_id === viewer.estate_id);
  return post && toFeedPost(post, viewer.id);
}

/** Author-only: move a request between open / in progress / resolved. */
export async function updatePostStatus(
  viewer: User,
  postId: string,
  status: PostStatus
): Promise<void> {
  await delay(300);
  const post = mock.posts.find((p) => p.id === postId);
  if (!post || post.author_id !== viewer.id) throw new ApiError('You can only update your own requests.');
  post.status = status;
}

/** Author-only: removes the request and its chats. */
export async function deletePost(viewer: User, postId: string): Promise<void> {
  await delay(300);
  const idx = mock.posts.findIndex((p) => p.id === postId);
  if (idx < 0 || mock.posts[idx].author_id !== viewer.id)
    throw new ApiError('You can only delete your own requests.');
  mock.posts.splice(idx, 1);
  const convoIds = new Set(mock.conversations.filter((c) => c.post_id === postId).map((c) => c.id));
  for (let i = mock.conversations.length - 1; i >= 0; i--)
    if (convoIds.has(mock.conversations[i].id)) mock.conversations.splice(i, 1);
  for (let i = mock.messages.length - 1; i >= 0; i--)
    if (convoIds.has(mock.messages[i].conversation_id)) mock.messages.splice(i, 1);
}

/** Bulletins still pinned for the estate, newest first. */
export async function getActiveBulletins(estateId: string): Promise<Bulletin[]> {
  await delay(300);
  const now = new Date().toISOString();
  return mock.bulletins
    .filter((b) => b.estate_id === estateId && (!b.pinned_until || b.pinned_until > now))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createReport(
  reporterId: string,
  target_type: ReportTarget,
  target_id: string,
  reason: string
): Promise<void> {
  await delay(300);
  mock.reports.push({
    id: `rpt-${Date.now()}`,
    reporter_id: reporterId,
    target_type,
    target_id,
    reason,
    status: 'open',
    created_at: new Date().toISOString(),
  });
}

// ─── Chat ─────────────────────────────────────────────────────────────────

// Mock stand-in for Supabase Realtime: screens subscribe to a conversation
// and get called whenever a message is added to it.
const chatListeners = new Map<string, Set<() => void>>();

export function subscribeToConversation(conversationId: string, onChange: () => void) {
  const set = chatListeners.get(conversationId) ?? new Set();
  set.add(onChange);
  chatListeners.set(conversationId, set);
  return () => {
    set.delete(onChange);
  };
}

function emit(conversationId: string) {
  chatListeners.get(conversationId)?.forEach((fn) => fn());
}

const findUser = (id: string) => mock.users.find((u) => u.id === id);
const findPost = (id: string) => mock.posts.find((p) => p.id === id);

/** Helpers are always public; requesters stay anonymous until they share. */
function peerFor(viewer: User, conv: Conversation): ChatPeer {
  const isRequester = conv.requester_id === viewer.id;
  const peer = findUser(isRequester ? conv.helper_id : conv.requester_id);
  const post = findPost(conv.post_id);
  if (!isRequester && post?.author.kind === 'anonymous' && !conv.is_identity_revealed) {
    return { kind: 'anonymous', alias: post.author.alias };
  }
  return { kind: 'public', name: peer?.name ?? 'Neighbour', block: peer?.block ?? '?' };
}

function toChatMessage(m: Message, viewerId: string): ChatMessage {
  const { sender_id, conversation_id, ...rest } = m;
  return { ...rest, from: m.type === 'system' ? 'system' : sender_id === viewerId ? 'me' : 'them' };
}

function summarize(conv: Conversation, viewer: User): ConversationSummary {
  const post = findPost(conv.post_id);
  const msgs = mock.messages.filter((m) => m.conversation_id === conv.id);
  const last = msgs[msgs.length - 1];
  return {
    id: conv.id,
    post_id: conv.post_id,
    post_title: post?.analysis?.punchline ?? post?.content.slice(0, 60) ?? 'Request',
    my_role: conv.requester_id === viewer.id ? 'requester' : 'helper',
    peer: peerFor(viewer, conv),
    is_anonymous_post: post?.author.kind === 'anonymous',
    is_identity_revealed: conv.is_identity_revealed,
    last_message: last && toChatMessage(last, viewer.id),
    updated_at: last?.created_at ?? conv.created_at,
  };
}

function participantConversation(viewer: User, conversationId: string) {
  const conv = mock.conversations.find((c) => c.id === conversationId);
  if (!conv || (conv.requester_id !== viewer.id && conv.helper_id !== viewer.id)) {
    throw new ApiError('Conversation not found.');
  }
  return conv;
}

function addMessage(conv: Conversation, senderId: string, fields: Partial<Message>) {
  mock.messages.push({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conversation_id: conv.id,
    sender_id: senderId,
    type: 'text',
    created_at: new Date().toISOString(),
    ...fields,
  });
  emit(conv.id);
}

export async function getConversations(viewer: User): Promise<ConversationSummary[]> {
  await delay(300);
  return mock.conversations
    .filter((c) => c.requester_id === viewer.id || c.helper_id === viewer.id)
    .map((c) => summarize(c, viewer))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getConversation(
  viewer: User,
  conversationId: string
): Promise<{ summary: ConversationSummary; messages: ChatMessage[] }> {
  const conv = participantConversation(viewer, conversationId);
  return {
    summary: summarize(conv, viewer),
    messages: mock.messages
      .filter((m) => m.conversation_id === conv.id)
      .map((m) => toChatMessage(m, viewer.id)),
  };
}

/** Opens (or reuses) the helper's 1-to-1 chat with the post's author. */
export async function offerHelp(viewer: User, postId: string): Promise<string> {
  await delay(300);
  const post = findPost(postId);
  if (!post || post.estate_id !== viewer.estate_id) throw new ApiError('Post not found.');
  if (post.author_id === viewer.id) throw new ApiError("You can't offer help on your own post.");

  const existing = mock.conversations.find(
    (c) => c.post_id === postId && c.helper_id === viewer.id
  );
  if (existing) return existing.id;

  const conv: Conversation = {
    id: `cnv-${Date.now()}`,
    post_id: postId,
    requester_id: post.author_id,
    helper_id: viewer.id,
    is_identity_revealed: false,
    created_at: new Date().toISOString(),
  };
  mock.conversations.push(conv);
  post.helper_count += 1;
  addMessage(conv, viewer.id, {
    type: 'system',
    text: `${viewer.name} offered to help with this request.`,
  });
  return conv.id;
}

export async function sendMessage(viewer: User, conversationId: string, text: string) {
  const conv = participantConversation(viewer, conversationId);
  addMessage(conv, viewer.id, { text: text.trim() });
  scheduleMockReply(conv, viewer.id);
}

/** Posts the viewer's verified contact card into the chat. */
export async function shareIdentity(viewer: User, conversationId: string) {
  await delay(300);
  const conv = participantConversation(viewer, conversationId);
  if (conv.requester_id === viewer.id) conv.is_identity_revealed = true;
  addMessage(conv, viewer.id, {
    type: 'identity_card',
    identity_card: {
      name: viewer.name,
      block: viewer.block,
      unit_number: viewer.unit_number,
      phone: viewer.phone,
    },
  });
}

/** Reports the other participant; their user id is resolved server-side. */
export async function reportChatPeer(viewer: User, conversationId: string, reason: string) {
  const conv = participantConversation(viewer, conversationId);
  const peerId = conv.requester_id === viewer.id ? conv.helper_id : conv.requester_id;
  await createReport(viewer.id, 'user', peerId, reason);
}

// Scripted replies so the chat feels alive until real users are connected.
const MOCK_REPLIES = {
  fromHelper: [
    'Sure! What time works best for you?',
    "Okay, I'll bring what I need.",
    'On my way 👍',
  ],
  fromRequester: [
    'Thank you so much, that would really help! 🙏',
    'Is later this evening okay for you?',
    'Great, see you then!',
  ],
};

function scheduleMockReply(conv: Conversation, viewerId: string) {
  const peerId = conv.requester_id === viewerId ? conv.helper_id : conv.requester_id;
  const script = peerId === conv.helper_id ? MOCK_REPLIES.fromHelper : MOCK_REPLIES.fromRequester;
  const sent = mock.messages.filter(
    (m) => m.conversation_id === conv.id && m.sender_id === peerId && m.type === 'text'
  ).length;
  const reply = script[sent % script.length];
  setTimeout(() => addMessage(conv, peerId, { text: reply }), 1500 + Math.random() * 1000);
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

