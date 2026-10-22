// In-memory sample data used until Supabase is connected.
import type {
  Bulletin,
  Conversation,
  Estate,
  FeedPost,
  Message,
  Report,
  User,
} from '@/types/models';
import { DEFAULT_NOTIFICATIONS } from '@/types/models';

/** Post row as stored server-side: includes the private author_id. */
export type StoredPost = Omit<FeedPost, 'is_mine'> & { author_id: string };

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

export const estates: Estate[] = [
  { id: 'est-1', name: 'Taman Melati Residences', area: 'Setapak, Kuala Lumpur' },
  { id: 'est-2', name: 'Danau Kota Suites', area: 'Setapak, Kuala Lumpur' },
  { id: 'est-3', name: 'Seri Maya Condominium', area: 'Ampang, Kuala Lumpur' },
];

export const users: User[] = [
  {
    id: 'usr-1',
    estate_id: 'est-1',
    name: 'Aisyah Rahman',
    email: 'aisyah@example.com',
    phone: '+60 12-345 6789',
    block: 'B',
    unit_number: '12-03',
    street: 'Jalan Melati 3',
    skills: ['it_wifi', 'tutoring'],
    notifications: {
      skill_matches: true,
      quiet_hours: { enabled: true, start: '23:00', end: '07:00' },
    },
    role: 'resident',
    status: 'approved',
    created_at: hoursAgo(24 * 30),
  },
  ...(
    [
      ['usr-daniel', 'Daniel Tan', 'D', ['carpentry', 'moving']],
      ['usr-priya', 'Priya Nair', 'A', ['medical', 'cooking', 'babysitting']],
      ['usr-ravi', 'Ravi Kumar', 'C', ['automotive', 'electrical', 'plumbing']],
      ['usr-402', 'Lim Wei Jie', 'B', ['pet_care']],
      ['usr-hafiz', 'Hafiz Ismail', 'A', ['plumbing', 'aircon', 'electrical']],
      ['usr-mei', 'Tan Mei Ling', 'C', ['it_wifi', 'tutoring', 'moving']],
    ] as const
  ).map(
    ([id, name, block, skills], i): User => ({
      id,
      estate_id: 'est-1',
      name,
      email: `${id.slice(4)}@example.com`,
      phone: `+60 12-000 00${i}${i}`,
      block,
      unit_number: `0${i + 2}-1${i}`,
      street: 'Jalan Melati 3',
      skills: [...skills],
      notifications: DEFAULT_NOTIFICATIONS,
      role: 'resident',
      status: 'approved',
      created_at: hoursAgo(24 * (60 + i)),
    })
  ),
];

// Staff plus a couple of pending residents so the management tools have work to do.
users.push(
  {
    id: 'usr-mgr',
    estate_id: 'est-1',
    name: 'Nadia Kamal',
    email: 'manager@example.com',
    phone: '+60 3-4021 0000',
    block: 'Office',
    unit_number: 'G-01',
    street: 'Jalan Melati 3',
    skills: [],
    notifications: DEFAULT_NOTIFICATIONS,
    role: 'management',
    status: 'approved',
    created_at: hoursAgo(24 * 90),
  },
  {
    id: 'usr-admin',
    estate_id: 'est-1',
    name: 'Imran Yusof',
    email: 'admin@example.com',
    phone: '+60 3-4021 0001',
    block: 'Office',
    unit_number: 'G-02',
    street: 'Jalan Melati 3',
    skills: [],
    notifications: DEFAULT_NOTIFICATIONS,
    role: 'admin',
    status: 'approved',
    created_at: hoursAgo(24 * 120),
  },
  ...(
    [
      ['usr-nora', 'Nora Hassan', 'E', '03-05'],
      ['usr-kevin', 'Kevin Ong', 'F', '10-12'],
    ] as const
  ).map(
    ([id, name, block, unit_number], i): User => ({
      id,
      estate_id: 'est-1',
      name,
      email: `${id.slice(4)}@example.com`,
      phone: `+60 11-555 55${i}${i}`,
      block,
      unit_number,
      street: 'Jalan Melati 3',
      skills: [],
      notifications: DEFAULT_NOTIFICATIONS,
      role: 'resident',
      status: 'pending',
      created_at: hoursAgo(2 + i * 6),
    })
  )
);

/** Demo passwords for mock sign-in, keyed by email. */
export const passwords: Record<string, string> = {
  'aisyah@example.com': 'password',
  'manager@example.com': 'password',
  'admin@example.com': 'password',
};

export const posts: StoredPost[] = [
  {
    id: 'pst-1',
    estate_id: 'est-1',
    author_id: 'usr-402',
    author: { kind: 'anonymous', alias: 'Neighbor #402' },
    content:
      'Water is leaking from under my kitchen sink and the floor is getting wet. Anyone have a pipe wrench or know how to fix this?',
    analysis: {
      category: 'plumbing',
      tools_needed: ['pipe wrench', 'plumber tape'],
      urgency: 'high',
      punchline: 'Leaky pipe emergency near Block B! Can any handyman assist?',
    },
    status: 'open',
    helper_count: 1,
    created_at: hoursAgo(0.5),
  },
  {
    id: 'pst-2',
    estate_id: 'est-1',
    author_id: 'usr-daniel',
    author: { kind: 'public', name: 'Daniel Tan', block: 'D' },
    content:
      'Our home WiFi keeps dropping every few minutes since yesterday. Router lights look normal. Would appreciate someone taking a look this weekend.',
    analysis: {
      category: 'it_wifi',
      tools_needed: [],
      urgency: 'medium',
      punchline: 'WiFi woes in Block D — any tech wizards around this weekend?',
    },
    status: 'open',
    helper_count: 0,
    created_at: hoursAgo(5),
  },
  {
    id: 'pst-3',
    estate_id: 'est-1',
    author_id: 'usr-priya',
    author: { kind: 'public', name: 'Priya Nair', block: 'A' },
    content:
      'Looking for someone to watch my 6-year-old for two hours on Saturday morning. Happy to pay.',
    analysis: {
      category: 'babysitting',
      tools_needed: [],
      urgency: 'low',
      punchline: 'Block A parent needs a trusted sitter this Saturday morning.',
    },
    status: 'in_progress',
    helper_count: 2,
    created_at: hoursAgo(26),
  },
  {
    id: 'pst-4',
    estate_id: 'est-1',
    author_id: 'usr-1',
    author: { kind: 'anonymous', alias: 'Neighbor #118' },
    content:
      'Does anyone have a ladder I could borrow for an hour? Need to change a ceiling light in the living room.',
    analysis: {
      category: 'electrical',
      tools_needed: ['ladder'],
      urgency: 'low',
      punchline: 'Ladder loan needed for a quick ceiling light swap!',
    },
    status: 'open',
    helper_count: 1,
    created_at: hoursAgo(30),
  },
  {
    id: 'pst-5',
    estate_id: 'est-1',
    author_id: 'usr-ravi',
    author: { kind: 'public', name: 'Ravi Kumar', block: 'C' },
    content:
      'Car battery is dead and I need to get to the hospital for an appointment in an hour. Anyone with jumper cables in the basement car park?',
    analysis: {
      category: 'automotive',
      tools_needed: ['jumper cables'],
      urgency: 'high',
      punchline: 'Dead battery at Block C car park — jumper cables needed ASAP!',
    },
    status: 'resolved',
    helper_count: 3,
    created_at: hoursAgo(50),
  },
];

export const bulletins: Bulletin[] = [
  {
    id: 'blt-1',
    estate_id: 'est-1',
    admin_id: 'usr-mgr',
    title: 'Water maintenance on Thursday',
    body: 'Water supply to Blocks A–D will be cut from 10am to 4pm on Thursday for tank cleaning. Please store water in advance.',
    is_high_priority: true,
    pinned_until: hoursAgo(-72),
    created_at: hoursAgo(3),
  },
];

export const reports: Report[] = [
  {
    id: 'rpt-1',
    reporter_id: 'usr-priya',
    target_type: 'post',
    target_id: 'pst-2',
    reason: 'Looks like spam, not a genuine request',
    status: 'open',
    created_at: hoursAgo(1),
  },
  {
    id: 'rpt-2',
    reporter_id: 'usr-1',
    target_type: 'user',
    target_id: 'usr-hafiz',
    reason: 'Was rude to me in chat',
    status: 'investigating',
    created_at: hoursAgo(8),
  },
  {
    id: 'rpt-3',
    reporter_id: 'usr-daniel',
    target_type: 'message',
    target_id: 'msg-2',
    reason: 'Inappropriate message',
    status: 'open',
    created_at: hoursAgo(12),
  },
];

// Hafiz offered to help with Aisyah's anonymous ladder post (pst-4), so the
// "Share My Details" flow can be tried from the requester's side.
export const conversations: Conversation[] = [
  {
    id: 'cnv-1',
    post_id: 'pst-4',
    requester_id: 'usr-1',
    helper_id: 'usr-hafiz',
    is_identity_revealed: false,
    created_at: hoursAgo(20),
  },
];

export const messages: Message[] = [
  {
    id: 'msg-1',
    conversation_id: 'cnv-1',
    sender_id: 'usr-hafiz',
    type: 'system',
    text: 'Hafiz Ismail offered to help with this request.',
    created_at: hoursAgo(20),
  },
  {
    id: 'msg-2',
    conversation_id: 'cnv-1',
    sender_id: 'usr-hafiz',
    type: 'text',
    text: 'Hi! I have a 6-step ladder you can borrow. I can also help swap the light if you want.',
    created_at: hoursAgo(19.9),
  },
];
