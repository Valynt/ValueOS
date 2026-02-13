/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WEBHOOK_URL: string;
  readonly VITE_ENABLE_UNIFIED_ORCHESTRATION: string;
  readonly VITE_ENABLE_STATELESS_ORCHESTRATION: string;
  readonly SSR: boolean;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
