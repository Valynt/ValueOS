import { ESOAdapterBase } from "../base.js";
import { DataIngestionAdapter, IngestionConfig } from "../types.js";

interface CensusFetchParams {
  dataset: string;
  variables: string[];
  geography?: string;
}

type CensusResponse = unknown[];

interface CensusTransformed {
  source: "Census";
  data: CensusResponse;
  timestamp: string;
  dataset?: string;
}

const DEFAULT_DATASETS: CensusFetchParams[] = [
  { dataset: "acs/acs5", variables: ["B01003_001E"], geography: "state:*" },
];
const DEFAULT_POLL_INTERVAL_MS = 3600000;
const MAX_CONCURRENT_CENSUS_DATASETS = 4;

export class CensusAdapter
  extends ESOAdapterBase<CensusResponse, CensusTransformed>
  implements DataIngestionAdapter<CensusResponse, CensusTransformed, CensusFetchParams>
{
  name = "Census";
  private lastDataTimestamps: Map<string, string> = new Map();

  constructor(config: IngestionConfig) {
    super(config);
  }

  async fetchData(params?: CensusFetchParams): Promise<CensusResponse> {
    if (!params) {
      throw new Error("Census fetchData requires params");
    }

    return this.fetchJson({
      cacheKey: `census-${JSON.stringify(params)}`,
      params,
      buildUrl: (requestParams) => {
        const url = new URL(`${this.config.baseUrl}/data/${requestParams.dataset}`);
        url.searchParams.set("get", requestParams.variables.join(","));
        if (requestParams.geography) {
          url.searchParams.set("for", requestParams.geography);
        }
        if (this.config.apiKey) {
          url.searchParams.set("key", this.config.apiKey);
        }
        return url;
      },
      headers: {
        "Content-Type": "application/json",
      },
      validateResponse: validateCensusResponse,
    });
  }

  async transformData(rawData: CensusResponse): Promise<CensusTransformed> {
    return {
      source: "Census",
      data: rawData,
      timestamp: new Date().toISOString(),
    };
  }

  async startStreaming(
    params: {
      datasets?: CensusFetchParams[];
      pollInterval?: number;
    } = {}
  ): Promise<void> {
    const pollInterval = params.pollInterval ?? DEFAULT_POLL_INTERVAL_MS;
    const datasets = params.datasets?.length ? params.datasets : DEFAULT_DATASETS;

    await this.startPollingLoop({
      intervalMs: pollInterval,
      onError: (error) => {
        console.error("Census polling error:", error);
      },
      poll: async () => {
        const updates = await this.mapWithConcurrency(
          datasets,
          MAX_CONCURRENT_CENSUS_DATASETS,
          async (datasetConfig) => {
            const data = await this.fetchData(datasetConfig);
            const dataKey = createDatasetKey(datasetConfig);
            const currentTimestamp = new Date().toISOString();
            const lastTimestamp = this.lastDataTimestamps.get(dataKey);

            if (lastTimestamp && Date.now() - new Date(lastTimestamp).getTime() <= pollInterval) {
              return null;
            }

            this.lastDataTimestamps.set(dataKey, currentTimestamp);
            const transformed = await this.transformData(data);
            return { ...transformed, dataset: datasetConfig.dataset };
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
  }
}

function validateCensusResponse(data: unknown): CensusResponse {
  if (!Array.isArray(data)) {
    throw new Error("Census API returned an invalid response payload");
  }

  return data;
}

function createDatasetKey(dataset: CensusFetchParams): string {
  return `${dataset.dataset}-${dataset.variables.join(",")}-${dataset.geography ?? ""}`;
}
