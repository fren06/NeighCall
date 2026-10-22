// The AI part of analyze-post, kept free of Supabase/Deno specifics so it can
// be tested on its own.

// Must match SKILLS in types/models.ts (Edge Functions can't import app code).
export const CATEGORIES = [
  'plumbing',
  'electrical',
  'it_wifi',
  'babysitting',
  'carpentry',
  'aircon',
  'automotive',
  'cooking',
  'tutoring',
  'medical',
  'pet_care',
  'moving',
  'other',
] as const;

const URGENCIES = ['low', 'medium', 'high'] as const;

/**
 * Only the fields the model got right. The app fills in anything missing
 * from its keyword matcher, so a sloppy answer never blocks a post.
 */
export interface Analysis {
  category?: (typeof CATEGORIES)[number];
  urgency?: (typeof URGENCIES)[number];
  tools_needed?: string[];
  punchline?: string;
}

const SYSTEM_PROMPT = `You sort help requests posted by residents of a Malaysian housing estate. Requests may be in English, Malay or a mix.
Reply with one JSON object only, no other text.
- category: the one skill a neighbour needs to help, from: ${CATEGORIES.join(', ')}. Use "other" if none fits.
- urgency: "high" = safety risk, damage happening now, or needed within the hour; "medium" = needed today or tomorrow; "low" = anything else.
- tools_needed: up to 5 short lowercase tool names a helper should bring. Empty if none.
- punchline: one friendly English line under 90 characters for a push notification asking neighbours to help. Start with "Urgent: " only when urgency is high. Never include names or phone numbers.`;

// Ollama applies this to models that support structured output.
const SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: CATEGORIES },
    urgency: { type: 'string', enum: URGENCIES },
    tools_needed: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    punchline: { type: 'string' },
  },
  required: ['category', 'urgency', 'tools_needed', 'punchline'],
};

export interface OllamaConfig {
  apiKey: string;
  model: string;
  /** Default: Ollama's cloud API. */
  baseUrl?: string;
}

/**
 * @param block Only given for public posts. On an anonymous post the block
 *   would narrow down who wrote it, so the model never sees it.
 */
export async function analyze(
  content: string,
  block: string | null,
  config: OllamaConfig
): Promise<Analysis> {
  const res = await fetch(`${config.baseUrl ?? 'https://ollama.com'}/api/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      think: false,
      format: SCHEMA,
      options: { temperature: 0.2 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Request: ${content}\n${
            block
              ? `Block: ${block} (you may mention it in the punchline)`
              : 'The poster is anonymous. Do not mention any block or unit.'
          }`,
        },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return clean(parseJson(data?.message?.content ?? ''));
}

/** Some models wrap the JSON in ```json fences or add a sentence around it. */
export function parseJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('The model did not return JSON.');
  return JSON.parse(text.slice(start, end + 1));
}

/** Keeps only valid fields; models don't always respect the schema. */
export function clean(raw: unknown): Analysis {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: Analysis = {};

  const category = typeof r.category === 'string' ? r.category.trim().toLowerCase() : '';
  if ((CATEGORIES as readonly string[]).includes(category)) {
    out.category = category as Analysis['category'];
  }

  const urgency = typeof r.urgency === 'string' ? r.urgency.trim().toLowerCase() : '';
  if ((URGENCIES as readonly string[]).includes(urgency)) {
    out.urgency = urgency as Analysis['urgency'];
  }

  if (Array.isArray(r.tools_needed)) {
    const tools = r.tools_needed
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase().replace(/_/g, ' '))
      .filter((t) => t.length > 0 && t.length <= 40);
    out.tools_needed = [...new Set(tools)].slice(0, 5);
  }

  const punchline = typeof r.punchline === 'string' ? r.punchline.trim() : '';
  if (punchline.length > 0 && punchline.length <= 140) out.punchline = punchline;

  return out;
}
