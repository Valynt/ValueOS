export interface BootstrapState {
  isReady: boolean;
  error: Error | null;
}

export function useBootstrap(): BootstrapState {
  return { isReady: true, error: null };
}
