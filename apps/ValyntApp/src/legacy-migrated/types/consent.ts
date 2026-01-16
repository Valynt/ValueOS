export type ConsentRegistry = {
  hasConsent: (tenantId: string, scope: string) => Promise<boolean> | boolean;
};
