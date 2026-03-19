import { ESOAdapterBase } from "../base.js";
import { DataIngestionAdapter, IngestionConfig } from "../types.js";

interface BLSFetchParams {
  seriesId: string;
  startYear?: string;
  endYear?: string;
}

interface BLSDataPoint {
  year?: string;
  period?: string;
}

interface BLSSeries {
  data?: BLSDataPoint[];
}

interface BLSResults {
  series?: BLSSeries[];
}

interface BLSResponse {
  Results?: BLSResults;
}

interface BLSTransformed {
  source: "BLS";
  data: BLSResponse;
  timestamp: string;
}

const DEFAULT_SERIES_IDS = ["CES0000000001"];
const DEFAULT_POLL_INTERVAL_MS = 300000;
const MAX_CONCURRENT_BLS_SERIES = 4;

export class BLSAdapter
  extends ESOAdapterBase<BLSResponse, BLSTransformed>
  implements DataIngestionAdapter<BLSResponse, BLSTransformed, BLSFetchParams>
{
  name = "BLS";
  private reconnectTimer?: NodeJS.Timeout;
  private lastDataTimestamps: Map<string, string> = new Map();

  constructor(config: IngestionConfig) {
    super(config);
  }

  async fetchData(params?: BLSFetchParams): Promise<BLSResponse> {
    if (!params) {
      throw new Error("BLS fetchData requires params");
    }

    return this.fetchJson({
      cacheKey: `bls-${JSON.stringify(params)}`,
      params,
      buildUrl: (requestParams) => {
        const url = new URL(`${this.config.baseUrl}/timeseries/data/`);
        url.searchParams.set("seriesid", requestParams.seriesId);
        if (requestParams.startYear) {
          url.searchParams.set("startyear", requestParams.startYear);
        }
        if (requestParams.endYear) {
          url.searchParams.set("endyear", requestParams.endYear);
        }
        if (this.config.apiKey) {
          url.searchParams.set("registrationkey", this.config.apiKey);
        }
        return url;
      },
      headers: {
        "Content-Type": "application/json",
      },
      validateResponse: validateBLSResponse,
    });
  }

  async transformData(rawData: BLSResponse): Promise<BLSTransformed> {
    return {
      source: "BLS",
      data: rawData,
      timestamp: new Date().toISOString(),
    };
  }

  async startStreaming(params: { seriesIds?: string[]; pollInterval?: number } = {}): Promise<void> {
    const pollInterval = params.pollInterval ?? DEFAULT_POLL_INTERVAL_MS;
    const seriesIds = params.seriesIds?.length ? params.seriesIds : DEFAULT_SERIES_IDS;

    await this.startPollingLoop({
      intervalMs: pollInterval,
      onError: (error) => {
        console.error("BLS polling error:", error);
      },
      poll: async () => {
        const updates = await this.mapWithConcurrency(
          seriesIds,
          MAX_CONCURRENT_BLS_SERIES,
          async (seriesId) => {
            const raw = await this.fetchData({ seriesId });
            const transformed = await this.transformData(raw);
            const latestTimestamp = extractLatestBLSTimestamp(raw);
            const lastTimestamp = this.lastDataTimestamps.get(seriesId);

            if (latestTimestamp === lastTimestamp) {
              return null;
            }

            this.lastDataTimestamps.set(seriesId, latestTimestamp);
            return transformed;
          }
        );

        for (const update of updates) {
          if (update) {
            this.emitData(update);
          }
        }
      },
    });
  }

  async stopStreaming(): Promise<void> {
    this.stopPollingLoop();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}

function validateBLSResponse(data: unknown): BLSResponse {
  if (!data || typeof data !== "object") {
    throw new Error("BLS API returned an invalid response payload");
  }

  return data as BLSResponse;
}

function extractLatestBLSTimestamp(raw: BLSResponse): string {
  const firstPoint = raw.Results?.series?.[0]?.data?.[0];
  return firstPoint ? `${firstPoint.year ?? ""}${firstPoint.period ?? ""}` : "";
}
