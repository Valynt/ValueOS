import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60_000,
};

const requestLog = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = requestLog.get(key);

  if (!entry || entry.resetAt < now) {
    requestLog.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }

  if (entry.count >= RATE_LIMIT.maxRequests) return true;

  requestLog.set(key, { ...entry, count: entry.count + 1 });
  return false;
}

async function buildSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment not configured');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.get('Authorization') || '',
      },
    },
  });
}

async function ensureAuthenticated(req: Request) {
  const client = await buildSupabaseClient(req);
  const {
    data: { user },
  } = await client.auth.getUser();

  return user;
}

async function callProvider({
  provider,
  payload,
  path,
}: {
  provider: 'together' | 'openai';
  payload: Record<string, unknown>;
  path: string;
}) {
  const togetherKey = Deno.env.get('TOGETHER_API_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const apiKey = provider === 'together' ? togetherKey : openaiKey;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: `${provider} key is not configured on the server` }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }

  const baseUrl = provider === 'together' ? 'https://api.together.xyz/v1' : 'https://api.openai.com/v1';

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    return new Response(
      JSON.stringify({ error: `Provider error ${response.status}: ${text}` }),
      { status: response.status, headers: { 'content-type': 'application/json' } },
    );
  }

  return response;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  try {
    const user = await ensureAuthenticated(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (isRateLimited(user.id)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });
    }

    const body = await req.json();
    const provider = body.provider === 'openai' ? 'openai' : 'together';

    if (body.type === 'embedding') {
      const embeddingModel = provider === 'together'
        ? 'togethercomputer/m2-bert-80M-8k-retrieval'
        : 'text-embedding-ada-002';

      const response = await callProvider({
        provider,
        path: '/embeddings',
        payload: { model: embeddingModel, input: body.input },
      });

      if (!response.ok) return response;

      const data = await response.json();
      return new Response(JSON.stringify({ embedding: data.data?.[0]?.embedding || [] }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    const chatPayload = {
      model: body.config?.model || (provider === 'together'
        ? 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'
        : 'gpt-4'),
      messages: body.messages,
      temperature: body.config?.temperature ?? 0.7,
      max_tokens: body.config?.max_tokens ?? 2000,
      top_p: body.config?.top_p ?? 1,
    };

    const start = Date.now();
    const response = await callProvider({ provider, path: '/chat/completions', payload: chatPayload });
    if (!response.ok) return response;

    const data = await response.json();
    const latency = Date.now() - start;

    return new Response(
      JSON.stringify({
        content: data.choices?.[0]?.message?.content || '',
        tokens_used: data.usage?.total_tokens || 0,
        latency_ms: latency,
        model: data.model,
        provider,
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  } catch (error) {
    console.error('LLM proxy failure', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
