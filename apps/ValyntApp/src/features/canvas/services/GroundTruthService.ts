import { createMCPServer } from "../../../mcp-ground-truth";
import type { ESOIndustry } from "../../../types/eso";

export interface GroundTruthMetric {
  metricId: string;
  name: string;
  value: number;
  unit: string;
  confidence: number;
  source: string;
  benchmarks: {
    p25: number;
    p50: number;
    p75: number;
  };
}

export class GroundTruthService {
  private static instance: GroundTruthService;
  private mcpServer: any;

  private constructor() {}

  public static getInstance(): GroundTruthService {
    if (!GroundTruthService.instance) {
      GroundTruthService.instance = new GroundTruthService();
    }
    return GroundTruthService.instance;
  }

  public async initialize() {
    if (this.mcpServer) return;

    this.mcpServer = await createMCPServer({
      industryBenchmark: {
        enableStaticData: true,
      },
    });
  }

  public async getMetricBenchmark(
    metricId: string,
    industry?: ESOIndustry,
    companySize?: "smb" | "mid_market" | "enterprise"
  ): Promise<GroundTruthMetric | null> {
    await this.initialize();

    try {
      const result = await this.mcpServer.executeTool("get_metric_value", {
        metricId,
        industry,
        companySize,
      });

      if (result && result.success) {
        return {
          metricId: result.data.metricId,
          name: result.data.name,
          value: result.data.value,
          unit: result.data.unit,
          confidence: 0.9, // Tier 1/2 default for ESO
          source: result.data.source,
          benchmarks: result.data.benchmarks,
        };
      }
    } catch (error) {
      console.error(`Failed to fetch ground truth for metric ${metricId}`, error);
    }

    return null;
  }
}
