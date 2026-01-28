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
  // Real-time streaming support
  startStreaming?(params?: Record<string, any>): Promise<void>;
  stopStreaming?(): Promise<void>;
  onData?(callback: (data: any) => void): () => void;
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
