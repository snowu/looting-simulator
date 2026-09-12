import type { Session, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client and session handling.
 *
 * Both values below are public: they ship inside the bundle, and every player
 * can read them. They identify the project rather than authorizing anything —
 * the boundary is the player's JWT checked against row-level security. The
 * service-role key must never appear here or anywhere else in this repo.
 *
 * The library itself is loaded on demand. A player who never signs in never
 * pays for it, which matters on a phone: the game is playable offline and
 * cloud saves are strictly opt-in.
 */

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** False in a build with no Supabase configured; the account UI stays hidden. */
export function cloudConfigured(): boolean {
  return !!(URL && KEY);
}

let client: Promise<SupabaseClient> | null = null;

/** The client, created on first use. Rejects if the build has no config. */
export function supabase(): Promise<SupabaseClient> {
  client ??= (async () => {
    if (!cloudConfigured()) throw new Error('Supabase is not configured in this build');
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(URL!, KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Sign-in is a typed six-digit code, never a link landing back here.
        // GitHub Pages has no SPA route fallback, so there is no callback URL
        // to parse and nothing good can come of looking for one.
        detectSessionInUrl: false,
      },
    });
  })();
  return client;
}

/**
 * Whether this browser looks like it has a session to restore, without loading
 * the library to find out. Supabase keeps its session under an `sb-*-auth-token`
 * key; matching the shape rather than computing the exact name keeps this
 * working if the project ref or the naming changes. A wrong guess is cheap in
 * both directions — too eager loads a library we did not need, too shy leaves
 * the player signed out until they open the account menu.
 */
export function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) return true;
    }
  } catch {
    // Blocked storage: treat as signed out.
  }
  return false;
}

/** The signed-in session, or null. Does not load the library if none is stored. */
export async function currentSession(): Promise<Session | null> {
  if (!cloudConfigured() || !hasStoredSession()) return null;
  const { data } = await (await supabase()).auth.getSession();
  return data.session;
}

/**
 * Subscribe to sign-in and sign-out.
 *
 * The callback runs deferred, because Supabase invokes it while holding its
 * internal auth lock: doing real work — a fetch, a save upload — inline can
 * deadlock against the very calls it triggers.
 */
export async function onSession(cb: (session: Session | null) => void): Promise<() => void> {
  const { data } = (await supabase()).auth.onAuthStateChange((_event, session) => {
    setTimeout(() => cb(session), 0);
  });
  return () => data.subscription.unsubscribe();
}

/** Send a six-digit code, creating the account if this email is new. */
export async function requestCode(email: string): Promise<void> {
  const { error } = await (await supabase()).auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Exchange the typed code for a session. */
export async function verifyCode(email: string, token: string): Promise<Session> {
  const { data, error } = await (await supabase()).auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  if (!data.session) throw new Error('That code did not sign you in. Try again.');
  return data.session;
}

/** Sign out. The local save is deliberately left where it is. */
export async function signOut(): Promise<void> {
  const { error } = await (await supabase()).auth.signOut();
  if (error) throw error;
}
