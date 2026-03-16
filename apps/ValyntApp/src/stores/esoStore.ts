/**
 * ESO Store - stub declaration.
 * TODO: Replace with full implementation.
 */
export interface ESOState {
  data: unknown;
  isLoading: boolean;
  error: string | null;
}

export const esoStore = {
  getState: (): ESOState => ({ data: null, isLoading: false, error: null }),
  subscribe:
    (_listener: (state: ESOState) => void): (() => void) =>
    () => {},
};

export function useESOStore(): ESOState {
  return { data: null, isLoading: false, error: null };
}
