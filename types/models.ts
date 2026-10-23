// Domain types for NeighCall. These mirror the planned Supabase tables so the
// UI can be built on mock data now and wired to the real backend later.

export type ID = string;
/** ISO-8601 timestamp, as returned by Postgres/Supabase. */
export type Timestamp = string;

// ─── Estates ──────────────────────────────────────────────────────────────
// One estate = one self-contained community (own admin, feed and matching).

export interface Estate {
  id: ID;
  name: string;
  area: string;
}

// ─── Users ────────────────────────────────────────────────────────────────

export type UserRole = 'resident' | 'admin' | 'management';

/**
 * pending   – registered, waiting for an admin
 * needs_info – admin asked for more details (see `admin_note`)
 * approved  – full access to feed and chat
 * rejected  – address not in the estate registry
 * suspended – banned by moderation
 */
export type UserStatus =
  | 'pending'
  | 'needs_info'
  | 'approved'
  | 'rejected'
  | 'suspended';

export interface Address {
  block: string;
  unit_number: string;
  street: string;
}

export interface NotificationPrefs {
  /** Push alerts when a new request matches one of the user's skills. */
  skill_matches: boolean;
  /** Mute non-urgent pushes overnight. Important bulletins still come through. */
  quiet_hours: {
    enabled: boolean;
    /** 24h "HH:mm", local time. */
    start: string;
    end: string;
  };
}

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  skill_matches: true,
  quiet_hours: { enabled: false, start: '22:00', end: '07:00' },
};

export interface User extends Address {
  id: ID;
  estate_id: ID;
  name: string;
  email: string;
  phone: string;
  /** Known skill ids, or free text the user entered under "Other". */
  skills: string[];
  notifications: NotificationPrefs;
  role: UserRole;
  status: UserStatus;
  /** Message from the admin when status is needs_info / rejected. */
  admin_note?: string;
  /** Formal warnings issued by management after upheld reports. */
  warning_count?: number;
  created_at: Timestamp;
}

/** Admins and estate management share the same staff tools. */
export const isStaff = (user: Pick<User, 'role'>) => user.role !== 'resident';
export const isAdmin = (user: Pick<User, 'role'>) => user.role === 'admin';

// ─── Skills ───────────────────────────────────────────────────────────────

export const SKILLS = [
  { id: 'plumbing', label: 'Plumbing' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'it_wifi', label: 'IT / WiFi' },
  { id: 'babysitting', label: 'Babysitting' },
  { id: 'carpentry', label: 'Carpentry' },
  { id: 'aircon', label: 'Aircon' },
  { id: 'automotive', label: 'Automotive' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'tutoring', label: 'Tutoring' },
  { id: 'medical', label: 'First Aid / Medical' },
  { id: 'pet_care', label: 'Pet Care' },
  { id: 'moving', label: 'Moving / Lifting' },
] as const;

export type SkillId = (typeof SKILLS)[number]['id'];

/** Display label: known skills use their label, custom ones show as typed. */
export const skillLabel = (skill: string) => SKILLS.find((s) => s.id === skill)?.label ?? skill;

// ─── Posts ────────────────────────────────────────────────────────────────

export type PostStatus = 'open' | 'in_progress' | 'resolved';
export type Urgency = 'low' | 'medium' | 'high';

/** Structured output from the AI pipeline. */
export interface PostAnalysis {
  category: SkillId | 'other';
  tools_needed: string[];
  urgency: Urgency;
  /** Short catchy push-notification line. */
  punchline: string;
}

/**
 * How the author is shown publicly. The feed never receives `author_id` —
 * anonymous posts only expose the alias.
 */
export type AuthorDisplay =
  | { kind: 'anonymous'; alias: string }
  | { kind: 'public'; name: string; block: string };

/** A post as the feed sees it (shape of the future `feed_posts` view). */
export interface FeedPost {
  id: ID;
  estate_id: ID;
  author: AuthorDisplay;
  /** True when the signed-in user wrote it (computed server-side). */
  is_mine: boolean;
  content: string;
  media_url?: string;
  analysis?: PostAnalysis;
  status: PostStatus;
  helper_count: number;
  created_at: Timestamp;
}

export interface NewPostInput {
  content: string;
  media_uri?: string;
  is_anonymous: boolean;
}

// ─── Chat ─────────────────────────────────────────────────────────────────

export interface Conversation {
  id: ID;
  post_id: ID;
  requester_id: ID;
  helper_id: ID;
  is_identity_revealed: boolean;
  created_at: Timestamp;
}

export type MessageType = 'text' | 'identity_card' | 'system';

export interface IdentityCard {
  name: string;
  block: string;
  unit_number: string;
  phone: string;
}

export interface Message {
  id: ID;
  conversation_id: ID;
  sender_id: ID;
  type: MessageType;
  text?: string;
  identity_card?: IdentityCard;
  created_at: Timestamp;
}

/**
 * A message as the client sees it. Sender is relative to the viewer so an
 * anonymous requester's user id never reaches the helper's device.
 */
export interface ChatMessage {
  id: ID;
  from: 'me' | 'them' | 'system';
  type: MessageType;
  text?: string;
  identity_card?: IdentityCard;
  created_at: Timestamp;
}

/** The other person in a conversation, as the viewer is allowed to see them. */
export type ChatPeer = AuthorDisplay;

export interface ConversationSummary {
  id: ID;
  post_id: ID;
  post_title: string;
  /** Viewer's role: they offered help, or they wrote the request. */
  my_role: 'helper' | 'requester';
  peer: ChatPeer;
  /** The request was posted anonymously. */
  is_anonymous_post: boolean;
  /** Requester has shared their details (only the requester can be anonymous). */
  is_identity_revealed: boolean;
  last_message?: ChatMessage;
  updated_at: Timestamp;
}

// ─── Notifications ────────────────────────────────────────────────────────

export type NotificationKind = 'skill_match' | 'offer' | 'message' | 'bulletin' | 'account';

/** An entry in the resident's in-app inbox (the bell on the home screen). */
export interface AppNotification {
  id: ID;
  kind: NotificationKind;
  title: string;
  body?: string;
  /** Screen to open when tapped, e.g. /post/<id>. */
  url?: string;
  read_at?: Timestamp;
  created_at: Timestamp;
}

// ─── Bulletins & moderation ───────────────────────────────────────────────

export interface Bulletin {
  id: ID;
  estate_id: ID;
  admin_id: ID;
  title: string;
  body: string;
  is_high_priority: boolean;
  pinned_until?: Timestamp;
  created_at: Timestamp;
}

export type ReportTarget = 'post' | 'user' | 'message';
export type ReportStatus = 'open' | 'investigating' | 'resolved';

export interface Report {
  id: ID;
  reporter_id: ID;
  target_type: ReportTarget;
  target_id: ID;
  reason: string;
  status: ReportStatus;
  /** Staff note recorded when the report is resolved. */
  resolution_note?: string;
  handled_by?: ID;
  created_at: Timestamp;
}

/** A report plus the context management needs to act on it. */
export interface ReportDetail {
  report: Report;
  reporter_name: string;
  /** What was reported, e.g. the post text, chat message or user's name. */
  target_excerpt: string;
  /** Author/sender/user behind the target; staff can see through anonymity. */
  offender?: { id: ID; name: string; block: string; status: UserStatus };
  /** The reported post still exists and can be removed. */
  post_exists: boolean;
}

export interface BulletinInput {
  title: string;
  body: string;
  is_high_priority: boolean;
  /** How long it stays pinned on residents' feeds. */
  pin_days: number;
}

export interface ManagementOverview {
  pending_residents: number;
  open_reports: number;
  investigating_reports: number;
  active_bulletins: number;
  resident_count: number;
}

// ─── Auth inputs ──────────────────────────────────────────────────────────

export interface SignUpInput extends Address {
  estate_id: ID;
  name: string;
  email: string;
  phone: string;
  password: string;
  skills: string[];
}
