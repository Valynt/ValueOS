/**
 * ESO (Employee Stock Ownership) Module stub
 * Provides ESO-related ground truth data for the valuation engine.
 */

export class ESOModule {
  async initialize(): Promise<void> {
    // No-op for local dev
  }

  async getESOData(companyId: string): Promise<Record<string, unknown>> {
    return {};
  }
}
