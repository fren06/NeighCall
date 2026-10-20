// Keyword-based stand-in for the LLM pipeline. Returns the same PostAnalysis
// shape the real model (structured output) will, so callers don't change.
import type { PostAnalysis, Urgency } from '@/types/models';

type Category = PostAnalysis['category'];

const CATEGORY_KEYWORDS: [Exclude<Category, 'other'>, RegExp][] = [
  ['plumbing', /\b(leak\w*|pipes?|sink|taps?|toilet|drain|clog\w*|water heater|plumb\w*)\b/],
  ['electrical', /\b(lights?|bulbs?|sockets?|power|fuse|wiring|trip\w*|electric\w*|ceiling fan)\b/],
  ['it_wifi', /\b(wi-?fi|internet|router|laptop|computer|printer|modem|network)\b/],
  ['babysitting', /\b(babysit\w*|sitter|kids?|child\w*|toddler|baby)\b/],
  ['carpentry', /\b(door|cabinet|shelf|shelves|furniture|wood\w*|hinge|drawer)\b/],
  ['aircon', /\b(aircon|air-con|air cond\w*|a\/c)\b/],
  ['automotive', /\b(car|battery|tyre|tire|jumper|jump start|engine|flat tyre|flat tire)\b/],
  ['cooking', /\b(cook\w*|recipe|meal|bake|baking|kitchen)\b/],
  ['tutoring', /\b(homework|tutor\w*|maths?|exam|study|studying|lesson)\b/],
  ['medical', /\b(fever|hurt|injur\w*|first aid|medicine|faint\w*|bleed\w*|sick|dizzy)\b/],
  ['pet_care', /\b(dogs?|cats?|pets?|puppy|kitten|walk my)\b/],
  ['moving', /\b(mov(e|ing)|lift\w*|heavy|sofa|carry|boxes)\b/],
];

const HIGH = /\b(urgent\w*|asap|emergency|now|flood\w*|fire|stuck|immediately|hospital|bleed\w*|right away)\b/;
const MEDIUM = /\b(today|tonight|soon|this (morning|afternoon|evening|weekend)|tomorrow)\b/;

const TOOLS = [
  'pipe wrench', 'plumber tape', 'plunger', 'ladder', 'drill', 'screwdriver',
  'jumper cables', 'hammer', 'multimeter', 'spanner', 'tool box', 'trolley',
];

const COPY: Record<Category, { title: string; helper: string }> = {
  plumbing: { title: 'Plumbing problem', helper: 'handy neighbour' },
  electrical: { title: 'Electrical issue', helper: 'electrician' },
  it_wifi: { title: 'Tech trouble', helper: 'tech-savvy neighbour' },
  babysitting: { title: 'Childcare needed', helper: 'trusted sitter' },
  carpentry: { title: 'Carpentry fix needed', helper: 'carpenter' },
  aircon: { title: 'Aircon trouble', helper: 'aircon expert' },
  automotive: { title: 'Car trouble', helper: 'car-savvy neighbour' },
  cooking: { title: 'Kitchen help wanted', helper: 'home cook' },
  tutoring: { title: 'Study help wanted', helper: 'tutor' },
  medical: { title: 'Medical help needed', helper: 'first-aider' },
  pet_care: { title: 'Pet care needed', helper: 'pet lover' },
  moving: { title: 'Extra hands needed', helper: 'strong pair of hands' },
  other: { title: 'A neighbour needs a hand', helper: 'neighbour' },
};

/**
 * @param block Included in the punchline only for public posts — on an
 *   anonymous post the block would narrow down who wrote it.
 */
export function analyzeText(content: string, block?: string): PostAnalysis {
  const text = content.toLowerCase();
  const category = CATEGORY_KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? 'other';
  const urgency: Urgency = HIGH.test(text) ? 'high' : MEDIUM.test(text) ? 'medium' : 'low';
  const tools_needed = TOOLS.filter((t) => text.includes(t));

  const { title, helper } = COPY[category];
  const prefix = urgency === 'high' ? 'Urgent: ' : '';
  const where = block ? ` in Block ${block}` : '';
  const punchline = `${prefix}${title}${where}! Can any ${helper} help?`;

  return { category, urgency, tools_needed, punchline };
}
