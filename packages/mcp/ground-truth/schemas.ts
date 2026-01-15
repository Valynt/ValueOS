import { z } from "zod";

export const GetAuthoritativeFinancialsSchema = z.object({
  entity_id: z.string().regex(/^[A-Z0-9]{1,10}$/, "Invalid entity ID format"),
  period: z
    .enum(["FY2023", "FY2024", "CQ1_2024", "CQ2_2024", "LTM"])
    .optional(),
  metrics: z
    .array(
      z.enum([
        "revenue_total",
        "gross_profit",
        "operating_income",
        "net_income",
        "eps_diluted",
        "cash_and_equivalents",
        "total_debt",
      ])
    )
    .min(1),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, "Invalid currency code")
    .default("USD")
    .optional(),
});

export const GetPrivateEntityEstimatesSchema = z.object({
  domain: z
    .string()
    .refine(
      (val) =>
        /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(val),
      "Invalid domain format"
    ),
  proxy_metric: z
    .enum(["headcount_linkedin", "web_traffic", "funding_stage"])
    .default("headcount_linkedin")
    .optional(),
  industry_code: z.string().optional(),
});

export const VerifyClaimAletheiaSchema = z.object({
  claim_text: z.string().min(1),
  context_entity: z.string().min(1),
  context_date: z.string().optional(), // ISO 8601
  strict_mode: z.boolean().default(true).optional(),
});

export const PopulateValueDriverTreeSchema = z.object({
  target_cik: z.string().min(1),
  benchmark_naics: z.string().min(1),
  driver_node_id: z.enum([
    "revenue_uplift",
    "cost_reduction",
    "risk_mitigation",
    "productivity_delta",
  ]),
  simulation_period: z.string().optional(),
});

export const GetIndustryBenchmarkSchema = z.object({
  identifier: z.string().min(1),
  metric: z.string().optional(),
});

export const AnalyzeFinancialSentimentSchema = z.object({
  document_type: z.enum([
    "earnings_call",
    "sec_filing",
    "press_release",
    "analyst_report",
  ]),
  content: z.string().min(1),
  company_name: z.string().optional(),
  filing_type: z.string().optional(),
  period: z.string().optional(),
});

export const GenerateFinancialForecastSchema = z.object({
  metric_name: z.string().min(1),
  historical_data: z.object({
    periods: z.array(z.string()),
    values: z.array(z.number()),
  }),
  forecast_periods: z.number().int().min(1).max(12).default(4).optional(),
  confidence_level: z.number().min(0.8).max(0.99).default(0.95).optional(),
});

export const DetectFinancialAnomaliesSchema = z.object({
  metric_name: z.string().min(1),
  data: z.object({
    periods: z.array(z.string()),
    values: z.array(z.number()),
  }),
  sensitivity: z.enum(["low", "medium", "high"]).default("medium").optional(),
});

export const AnalyzeFinancialTrendsSchema = z.object({
  metric_name: z.string().min(1),
  data: z.object({
    periods: z.array(z.string()),
    values: z.array(z.number()),
  }),
  comparison_data: z
    .array(
      z.object({
        periods: z.array(z.string()),
        values: z.array(z.number()),
      })
    )
    .optional(),
});

export const GenerateBusinessIntelligenceSchema = z.object({
  company_name: z.string().min(1),
  cik: z.string().optional(),
  industry: z.string().optional(),
  time_range: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
  include_sentiment: z.boolean().optional(),
  include_forecasting: z.boolean().optional(),
  peer_companies: z.array(z.string()).optional(),
});

export const StartSentimentStreamSchema = z.object({
  session_id: z.string().min(1),
  event_type: z.enum([
    "earnings_call",
    "press_conference",
    "sec_hearing",
    "investor_meeting",
  ]),
  company_name: z.string().min(1),
});

export const ProcessStreamTranscriptSchema = z.object({
  session_id: z.string().min(1),
  speaker: z.string().min(1),
  text: z.string().min(1),
  sequence_number: z.number().optional(),
  is_partial: z.boolean().default(false).optional(),
});

export const EndSentimentStreamSchema = z.object({
  session_id: z.string().min(1),
});

export const GetStreamingStatsSchema = z.object({});

export const ToolSchemas: Record<string, z.ZodType<any>> = {
  get_authoritative_financials: GetAuthoritativeFinancialsSchema,
  get_private_entity_estimates: GetPrivateEntityEstimatesSchema,
  verify_claim_aletheia: VerifyClaimAletheiaSchema,
  populate_value_driver_tree: PopulateValueDriverTreeSchema,
  get_industry_benchmark: GetIndustryBenchmarkSchema,
  analyze_financial_sentiment: AnalyzeFinancialSentimentSchema,
  generate_financial_forecast: GenerateFinancialForecastSchema,
  detect_financial_anomalies: DetectFinancialAnomaliesSchema,
  analyze_financial_trends: AnalyzeFinancialTrendsSchema,
  generate_business_intelligence: GenerateBusinessIntelligenceSchema,
  start_sentiment_stream: StartSentimentStreamSchema,
  process_stream_transcript: ProcessStreamTranscriptSchema,
  end_sentiment_stream: EndSentimentStreamSchema,
  get_streaming_stats: GetStreamingStatsSchema,
};
