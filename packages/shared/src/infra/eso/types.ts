/**
 * @valueos/infra/eso
 *
 * ESO (Economic Statistics Organizations) data ingestion adapters.
 * - SEC: Securities and Exchange Commission
 * - BLS: Bureau of Labor Statistics
 * - Census: US Census Bureau
 */

export type ESOQueryParams = Record<string, unknown>;

export interface DataIngestionAdapter<TRaw = unknown, TTransformed = unknown, TParams = ESOQueryParams> {
  name: string;
  fetchData(params?: TParams): Promise<TRaw>;
  transformData(rawData: TRaw): Promise<TTransformed>;
  // Real-time streaming support
  startStreaming?(params?: ESOQueryParams): Promise<void>;
  stopStreaming?(): Promise<void>;
  onData?(callback: (data: TTransformed) => void): () => void;
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
