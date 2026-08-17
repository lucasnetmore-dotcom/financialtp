// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

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

const FALLBACK_SUPABASE_URL = 'https://hokwwlajifoxqkeldlsv.supabase.co';

function resolveSupabaseUrl(): string {
  const fromEnvUrl = process.env['SUPABASE_URL'];
  const isBrokenProject =
    typeof fromEnvUrl === 'string' && fromEnvUrl.includes('yxaokofkcgfocqooniec');
  return isBrokenProject || !fromEnvUrl ? FALLBACK_SUPABASE_URL : fromEnvUrl;
}

/** True se a service role estiver configurada no Vercel. */
export function hasServiceRoleKey(): boolean {
  return Boolean(process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim());
}

function createSupabaseAdminClient(): SupabaseClient<Database> {
  const SUPABASE_URL = resolveSupabaseUrl();
  const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: SupabaseClient<Database> | undefined;

/**
 * Cliente admin (bypassa RLS). Só use em handlers server-side.
 * Preferir getSupabaseAdminOptional() quando a key pode faltar.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});

/** Devolve o admin ou null — sem console.error se a key não existir. */
export function getSupabaseAdminOptional(): SupabaseClient<Database> | null {
  if (!hasServiceRoleKey()) return null;
  try {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return _supabaseAdmin;
  } catch {
    return null;
  }
}
