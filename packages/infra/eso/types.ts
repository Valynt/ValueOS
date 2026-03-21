/**
 * @valueos/infra/eso
 *
 * ESO (Economic Statistics Organizations) data ingestion adapters.
 * - SEC: Securities and Exchange Commission
 * - BLS: Bureau of Labor Statistics
 * - Census: US Census Bureau
 */

export type AdapterPayload = unknown;

export interface DataIngestionAdapter<
  TParams extends Record<string, unknown> = Record<string, unknown>,
  TRawData = AdapterPayload,
  TTransformedData = AdapterPayload,
> {
  name: string;
  fetchData(params?: TParams): Promise<TRawData>;
  transformData(rawData: TRawData): Promise<TTransformedData>;
  // Real-time streaming support
  startStreaming?(params?: Record<string, unknown>): Promise<void>;
  stopStreaming?(): Promise<void>;
  onData?(callback: (data: TTransformedData | TRawData) => void): () => void;
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
