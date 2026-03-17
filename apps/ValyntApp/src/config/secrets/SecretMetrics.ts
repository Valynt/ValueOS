// Browser-safe stub — prom-client metrics are server-side only
export const secretMetrics = {
  recordAccess: (_name: string, _provider: string) => undefined,
  recordError: (_name: string, _provider: string) => undefined,
  recordRotation: (_name: string) => undefined,
};
