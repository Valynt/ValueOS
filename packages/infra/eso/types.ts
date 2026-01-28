/**
 * @valueos/infra/eso
 *
 * ESO (Economic Statistics Organizations) data ingestion adapters.
 * - SEC: Securities and Exchange Commission
 * - BLS: Bureau of Labor Statistics
 * - Census: US Census Bureau
 */

export interface DataIngestionAdapter {
  name: string;
  fetchData(params?: Record<string, any>): Promise<any>;
  transformData(rawData: any): Promise<any>;
}

export interface IngestionConfig {
  apiKey?: string;
  baseUrl: string;
  rateLimit?: number; // requests per minute
  timeout?: number;
  enableCache?: boolean;
  cacheTTL?: number; // in milliseconds
}

export type ESOAdapterType = "sec" | "bls" | "census";
