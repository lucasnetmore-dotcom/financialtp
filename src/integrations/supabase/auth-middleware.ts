// Server auth for TanStack server functions (checkout, delete account, etc.)
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

// Mesmo fallback do client.ts — o deploy Vercel apontava para um projeto sem schema.
const FALLBACK_SUPABASE_URL = 'https://hokwwlajifoxqkeldlsv.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_A-L-Id2snj-slXEdWL-ouQ_877fZw5-';

function resolveSupabaseConfig() {
  const fromEnvUrl = process.env['SUPABASE_URL'];
  const fromEnvKey = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const isBrokenProject =
    typeof fromEnvUrl === 'string' && fromEnvUrl.includes('yxaokofkcgfocqooniec');

  const SUPABASE_URL = isBrokenProject || !fromEnvUrl ? FALLBACK_SUPABASE_URL : fromEnvUrl;
  const SUPABASE_PUBLISHABLE_KEY =
    isBrokenProject || !fromEnvKey ? FALLBACK_SUPABASE_PUBLISHABLE_KEY : fromEnvKey;

  return { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };
}

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = resolveSupabaseConfig();

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error(
        'Configuração do servidor incompleta (Supabase). Contacte o suporte.',
      );
    }

    const request = getRequest();

    if (!request?.headers) {
      throw new Error('Sessão inválida. Faça login novamente.');
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Error('Sessão em falta. Faça login novamente e tente outra vez.');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Sessão inválida. Faça login novamente.');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      throw new Error('Sessão em falta. Faça login novamente.');
    }

    // JWT access tokens têm 3 segmentos
    if (token.split('.').length !== 3) {
      throw new Error('Sessão inválida. Faça logout e entre outra vez.');
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    type AuthClaims = { sub: string; email: string | undefined };

    // Preferir getUser (validação no Auth API) — mais fiável que só parse local
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (!userError && userData?.user?.id) {
      const claims: AuthClaims = {
        sub: userData.user.id,
        email: userData.user.email,
      };
      return next({
        context: {
          supabase,
          userId: userData.user.id,
          claims,
        },
      });
    }

    // Fallback: getClaims (API mais recente)
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      console.error('[auth] token validation failed', userError?.message ?? error?.message);
      throw new Error(
        'Sessão expirada ou inválida. Saia da conta, entre novamente e tente o upgrade.',
      );
    }

    const claims: AuthClaims = {
      sub: data.claims.sub as string,
      email: (data.claims as { email?: string }).email,
    };
    return next({
      context: {
        supabase,
        userId: data.claims.sub as string,
        claims,
      },
    });
  },
);
