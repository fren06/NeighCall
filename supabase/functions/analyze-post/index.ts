// Edge Function: reads a draft help request and suggests its category,
// urgency, tools and a push-notification punchline using an Ollama model.
// It runs on Supabase so the Ollama key never ships inside the app.
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   OLLAMA_API_KEY  required
//   OLLAMA_MODEL    optional, default gemma4:31b (in Ollama's free plan)
//
// Deploy with JWT verification off; the function checks the caller itself.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { analyze } from './analyze.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405);

  // Only approved residents may use the AI (it costs Ollama credits).
  const authorization = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } }
  );
  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth.user) return reply({ error: 'Please sign in.' }, 401);

  const { data: me } = await supabase
    .from('users')
    .select('status, block')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (me?.status !== 'approved') return reply({ error: 'Your account is not approved yet.' }, 403);

  let content = '';
  let isAnonymous = true;
  try {
    const body = await req.json();
    content = typeof body.content === 'string' ? body.content.trim() : '';
    isAnonymous = body.is_anonymous !== false;
  } catch {
    return reply({ error: 'Send JSON: { content, is_anonymous }.' }, 400);
  }
  if (content.length < 15 || content.length > 500) {
    return reply({ error: 'The request must be 15 to 500 characters.' }, 400);
  }

  const apiKey = Deno.env.get('OLLAMA_API_KEY');
  if (!apiKey) return reply({ error: 'OLLAMA_API_KEY is not set.' }, 500);

  try {
    const analysis = await analyze(content, isAnonymous ? null : me.block, {
      apiKey,
      model: Deno.env.get('OLLAMA_MODEL') || 'gemma4:31b',
    });
    return reply(analysis);
  } catch (e) {
    console.error('analyze-post failed:', e);
    return reply({ error: 'The AI is unavailable right now.' }, 502);
  }
});
