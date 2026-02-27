"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolSchemas = exports.GetStreamingStatsSchema = exports.EndSentimentStreamSchema = exports.ProcessStreamTranscriptSchema = exports.StartSentimentStreamSchema = exports.GenerateBusinessIntelligenceSchema = exports.AnalyzeFinancialTrendsSchema = exports.DetectFinancialAnomaliesSchema = exports.GenerateFinancialForecastSchema = exports.AnalyzeFinancialSentimentSchema = exports.GetIndustryBenchmarkSchema = exports.PopulateValueDriverTreeSchema = exports.VerifyClaimAletheiaSchema = exports.GetPrivateEntityEstimatesSchema = exports.ResolveTickerFromDomainSchema = exports.GetFilingSectionsSchema = exports.GetAuthoritativeFinancialsSchema = void 0;
const zod_1 = require("zod");
exports.GetAuthoritativeFinancialsSchema = zod_1.z.object({
    entity_id: zod_1.z.string().regex(/^[A-Z0-9]{1,10}$/, "Invalid entity ID format"),
    period: zod_1.z
        .enum(["FY2023", "FY2024", "CQ1_2024", "CQ2_2024", "LTM"])
        .optional(),
    metrics: zod_1.z
        .array(zod_1.z.enum([
        "revenue_total",
        "gross_profit",
        "operating_income",
        "net_income",
        "eps_diluted",
        "cash_and_equivalents",
        "total_debt",
    ]))
        .min(1),
    currency: zod_1.z
        .string()
        .regex(/^[A-Z]{3}$/, "Invalid currency code")
        .default("USD")
        .optional(),
});
exports.GetFilingSectionsSchema = zod_1.z.object({
    identifier: zod_1.z.string().regex(/^[A-Z0-9.]{1,20}$/, "Invalid identifier format"),
    filing_type: zod_1.z.enum(["10-K", "10-Q", "8-K"]).default("10-K").optional(),
    sections: zod_1.z.array(zod_1.z.string()).min(1),
});
exports.ResolveTickerFromDomainSchema = zod_1.z.object({
    domain: zod_1.z.string().min(1),
});
exports.GetPrivateEntityEstimatesSchema = zod_1.z.object({
    domain: zod_1.z
        .string()
        .refine((val) => /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(val), "Invalid domain format"),
    proxy_metric: zod_1.z
        .enum(["headcount_linkedin", "web_traffic", "funding_stage"])
        .default("headcount_linkedin")
        .optional(),
    industry_code: zod_1.z.string().optional(),
});
exports.VerifyClaimAletheiaSchema = zod_1.z.object({
    claim_text: zod_1.z.string().min(1),
    context_entity: zod_1.z.string().min(1),
    context_date: zod_1.z.string().optional(), // ISO 8601
    strict_mode: zod_1.z.boolean().default(true).optional(),
});
exports.PopulateValueDriverTreeSchema = zod_1.z.object({
    target_cik: zod_1.z.string().min(1),
    benchmark_naics: zod_1.z.string().min(1),
    driver_node_id: zod_1.z.enum([
        "revenue_uplift",
        "cost_reduction",
        "risk_mitigation",
        "productivity_delta",
    ]),
    simulation_period: zod_1.z.string().optional(),
});
exports.GetIndustryBenchmarkSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(1),
    metric: zod_1.z.string().optional(),
});
exports.AnalyzeFinancialSentimentSchema = zod_1.z.object({
    document_type: zod_1.z.enum([
        "earnings_call",
        "sec_filing",
        "press_release",
        "analyst_report",
    ]),
    content: zod_1.z.string().min(1),
    company_name: zod_1.z.string().optional(),
    filing_type: zod_1.z.string().optional(),
    period: zod_1.z.string().optional(),
});
exports.GenerateFinancialForecastSchema = zod_1.z.object({
    metric_name: zod_1.z.string().min(1),
    historical_data: zod_1.z.object({
        periods: zod_1.z.array(zod_1.z.string()),
        values: zod_1.z.array(zod_1.z.number()),
    }),
    forecast_periods: zod_1.z.number().int().min(1).max(12).default(4).optional(),
    confidence_level: zod_1.z.number().min(0.8).max(0.99).default(0.95).optional(),
});
exports.DetectFinancialAnomaliesSchema = zod_1.z.object({
    metric_name: zod_1.z.string().min(1),
    data: zod_1.z.object({
        periods: zod_1.z.array(zod_1.z.string()),
        values: zod_1.z.array(zod_1.z.number()),
    }),
    sensitivity: zod_1.z.enum(["low", "medium", "high"]).default("medium").optional(),
});
exports.AnalyzeFinancialTrendsSchema = zod_1.z.object({
    metric_name: zod_1.z.string().min(1),
    data: zod_1.z.object({
        periods: zod_1.z.array(zod_1.z.string()),
        values: zod_1.z.array(zod_1.z.number()),
    }),
    comparison_data: zod_1.z
        .array(zod_1.z.object({
        periods: zod_1.z.array(zod_1.z.string()),
        values: zod_1.z.array(zod_1.z.number()),
    }))
        .optional(),
});
exports.GenerateBusinessIntelligenceSchema = zod_1.z.object({
    company_name: zod_1.z.string().min(1),
    cik: zod_1.z.string().optional(),
    industry: zod_1.z.string().optional(),
    time_range: zod_1.z
        .object({
        start: zod_1.z.string(),
        end: zod_1.z.string(),
    })
        .optional(),
    include_sentiment: zod_1.z.boolean().optional(),
    include_forecasting: zod_1.z.boolean().optional(),
    peer_companies: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.StartSentimentStreamSchema = zod_1.z.object({
    session_id: zod_1.z.string().min(1),
    event_type: zod_1.z.enum([
        "earnings_call",
        "press_conference",
        "sec_hearing",
        "investor_meeting",
    ]),
    company_name: zod_1.z.string().min(1),
});
exports.ProcessStreamTranscriptSchema = zod_1.z.object({
    session_id: zod_1.z.string().min(1),
    speaker: zod_1.z.string().min(1),
    text: zod_1.z.string().min(1),
    sequence_number: zod_1.z.number().optional(),
    is_partial: zod_1.z.boolean().default(false).optional(),
});
exports.EndSentimentStreamSchema = zod_1.z.object({
    session_id: zod_1.z.string().min(1),
});
exports.GetStreamingStatsSchema = zod_1.z.object({});
exports.ToolSchemas = {
    get_authoritative_financials: exports.GetAuthoritativeFinancialsSchema,
    get_filing_sections: exports.GetFilingSectionsSchema,
    resolve_ticker_from_domain: exports.ResolveTickerFromDomainSchema,
    get_private_entity_estimates: exports.GetPrivateEntityEstimatesSchema,
    verify_claim_aletheia: exports.VerifyClaimAletheiaSchema,
    populate_value_driver_tree: exports.PopulateValueDriverTreeSchema,
    get_industry_benchmark: exports.GetIndustryBenchmarkSchema,
    analyze_financial_sentiment: exports.AnalyzeFinancialSentimentSchema,
    generate_financial_forecast: exports.GenerateFinancialForecastSchema,
    detect_financial_anomalies: exports.DetectFinancialAnomaliesSchema,
    analyze_financial_trends: exports.AnalyzeFinancialTrendsSchema,
    generate_business_intelligence: exports.GenerateBusinessIntelligenceSchema,
    start_sentiment_stream: exports.StartSentimentStreamSchema,
    process_stream_transcript: exports.ProcessStreamTranscriptSchema,
    end_sentiment_stream: exports.EndSentimentStreamSchema,
    get_streaming_stats: exports.GetStreamingStatsSchema,
};
//# sourceMappingURL=schemas.js.map