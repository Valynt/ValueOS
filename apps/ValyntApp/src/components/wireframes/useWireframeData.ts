/**
 * @deprecated This file has no consumers — safe to delete.
 * Verified via grep: no file imports from components/wireframes/useWireframeData.
 */
export function useWireframeData() {
  return {
    data: null as unknown,
    isLoading: false,
    error: null as string | null,
  };
}
