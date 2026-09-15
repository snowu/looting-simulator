/// <reference types="vite/client" />

declare const __BUILD_ID__: string;
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** True under `vite dev`, statically false in a production build. */
  readonly DEV: boolean;
  readonly PROD: boolean;
  /** Supabase project URL. Public: it ships in the bundle. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable key. Public: RLS and the player's JWT are the boundary. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
