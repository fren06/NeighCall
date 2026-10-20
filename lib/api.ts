// Data access layer. Screens only talk to these functions, so swapping the
// mock implementation for Supabase later doesn't touch any UI code.
import { analyzeText } from '@/lib/mock-ai';
import * as mock from '@/lib/mock-data';
import { DEFAULT_NOTIFICATIONS } from '@/types/models';
import type {
  Bulletin,
  ChatMessage,
  ChatPeer,
  Conversation,
  ConversationSummary,
  Estate,
  FeedPost,
  Message,
  NewPostInput,
  PostAnalysis,
  ReportTarget,
  SignUpInput,
  User,
} from '@/types/models';

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export class ApiError extends Error {}

export async function getEstates(): Promise<Estate[]> {
  await delay(200);
  return mock.estates;
}

export async function getEstate(id: string): Promise<Estate | undefined> {
  return mock.estates.find((e) => e.id === id);
}

export async function signUp(input: SignUpInput): Promise<User> {
  await delay();
  const email = input.email.trim().toLowerCase();
  if (mock.users.some((u) => u.email === email)) {
    throw new ApiError('An account with this email already exists.');
  }
  const { password, ...profile } = input;
  const user: User = {
    ...profile,
    email,
    notifications: DEFAULT_NOTIFICATIONS,
    id: `usr-${Date.now()}`,
    role: 'resident',
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  mock.users.push(user);
  mock.passwords[email] = password;
  return user;
}

export async function signIn(email: string, password: string): Promise<User> {
  await delay();
  const key = email.trim().toLowerCase();
  const user = mock.users.find((u) => u.email === key);
  if (!user || mock.passwords[key] !== password) {
    throw new ApiError('Incorrect email or password.');
  }
  return user;
}

export async function updateProfile(
  userId: string,
  changes: Partial<Omit<User, 'id' | 'role' | 'status'>>
): Promise<User> {
  await delay();
  const user = mock.users.find((u) => u.id === userId);
  if (!user) throw new ApiError('User not found.');
  // Resubmitting details after "needs_info" puts the user back in the queue.
  Object.assign(user, changes, {
    status: user.status === 'needs_info' ? 'pending' : user.status,
    admin_note: undefined,
  });
  return { ...user };
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
  await delay(300);
  const user = mock.users.find((u) => u.id === userId);
  if (!user) throw new ApiError('User not found.');
  Object.assign(user, changes);
  return { ...user };
}

/** Dev-only: simulates the admin acting on a registration. */
export async function devSetStatus(
  userId: string,
  status: User['status'],
  admin_note?: string
): Promise<User> {
  await delay(150);
  const user = mock.users.find((u) => u.id === userId);
  if (!user) throw new ApiError('User not found.');
  user.status = status;
  user.admin_note = admin_note;
  return { ...user };
}
