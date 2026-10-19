// Data access layer. Screens only talk to these functions, so swapping the
// mock implementation for Supabase later doesn't touch any UI code.
import { analyzeText } from '@/lib/mock-ai';
import * as mock from '@/lib/mock-data';
import type {
  Bulletin,
  Estate,
  FeedPost,
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
