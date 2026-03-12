/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_BASE_URL: string;
  /**
   * Kill-switch for the ValueCommitmentTrackingService backend migration.
   * Set to "true" to route all commitment writes through /api/v1/value-commitments.
   * Defaults to "true" — set to "false" only during an emergency rollback window.
   */
  readonly VITE_USE_BACKEND_COMMITMENT_API: string;
}
