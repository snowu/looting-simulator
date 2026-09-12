/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Public: it ships in the bundle. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key. Public: RLS and the player's JWT are the boundary. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
