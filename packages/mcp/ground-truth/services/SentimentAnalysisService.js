"use strict";
/**
 * Sentiment Analysis Engine - AI-Powered Financial Document Analysis
 *
 * Provides advanced sentiment analysis for financial documents including:
 * - Earnings call transcript analysis
 * - SEC filing sentiment extraction
 * - Risk factor identification
 * - Management discussion analysis
 *
 * Uses LLM integration for sophisticated natural language understanding
 * of financial communications and qualitative disclosures.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentimentAnalysisService = void 0;
const LLMGateway_1 = require("../../lib/agent-fabric/LLMGateway");
const logger_1 = require("../../lib/logger");
const Cache_1 = require("../core/Cache");
class SentimentAnalysisService {
    llmGateway;
    cache = (0, Cache_1.getCache)();
    constructor() {
        this.llmGateway = new LLMGateway_1.LLMGateway("openai", true); // Use OpenAI for financial analysis
    }
    /**
     * Analyze sentiment of financial document
     */
    async analyzeDocument(request) {
        const cacheKey = `sentiment:${this.generateCacheKey(request)}`;
        // Check cache first
        const cachedResult = await this.cache.get(cacheKey);
        if (cachedResult) {
            logger_1.logger.debug("Using cached sentiment analysis", {
                documentType: request.documentType,
            });
            return cachedResult;
        }
        try {
            logger_1.logger.info("Starting sentiment analysis", {
                documentType: request.documentType,
                contentLength: request.content.length,
                companyName: request.companyName,
            });
            // Analyze document based on type
            let result;
            switch (request.documentType) {
                case "earnings_call":
                    result = await this.analyzeEarningsCall(request);
                    break;
                case "sec_filing":
                    result = await this.analyzeSECFiling(request);
                    break;
                case "press_release":
                    result = await this.analyzePressRelease(request);
                    break;
                default:
                    result = await this.analyzeGeneralDocument(request);
            }
            // Cache the result (Tier 2 - 6 hour TTL)
            await this.cache.set(cacheKey, result, "tier2");
            logger_1.logger.info("Sentiment analysis completed", {
                documentType: request.documentType,
                overallSentiment: result.overall_sentiment,
                confidence: result.confidence,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error("Sentiment analysis failed", error instanceof Error ? error : undefined, {
                documentType: request.documentType,
            });
            throw error;
        }
    }
    /**
     * Analyze earnings call transcript
     */
    async analyzeEarningsCall(request) {
        const prompt = this.buildEarningsCallPrompt(request);
        const response = await this.llmGateway.generate({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-4",
            temperature: 0.1, // Low temperature for consistent analysis
            max_tokens: 2000,
        });
        return this.parseSentimentResponse(response.content, request.documentType);
    }
    /**
     * Analyze SEC filing
     */
    async analyzeSECFiling(request) {
        const prompt = this.buildSECFilingPrompt(request);
        const response = await this.llmGateway.generate({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-4",
            temperature: 0.1,
            max_tokens: 2000,
        });
        return this.parseSentimentResponse(response.content, request.documentType);
    }
    /**
     * Analyze press release
     */
    async analyzePressRelease(request) {
        const prompt = this.buildPressReleasePrompt(request);
        const response = await this.llmGateway.generate({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-4",
            temperature: 0.2, // Slightly higher temperature for creative analysis
            max_tokens: 1500,
        });
        return this.parseSentimentResponse(response.content, request.documentType);
    }
    /**
     * Analyze general financial document
     */
    async analyzeGeneralDocument(request) {
        const prompt = this.buildGeneralDocumentPrompt(request);
        const response = await this.llmGateway.generate({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-4",
            temperature: 0.1,
            max_tokens: 1500,
        });
        return this.parseSentimentResponse(response.content, request.documentType);
    }
    /**
     * Build prompt for earnings call analysis
     */
    buildEarningsCallPrompt(request) {
        return `You are a financial analyst expert in sentiment analysis. Analyze the following earnings call transcript and provide a comprehensive sentiment assessment.

DOCUMENT INFORMATION:
- Company: ${request.companyName || "Unknown"}
- Period: ${request.period || "Unknown"}
- Content Length: ${request.content.length} characters

EARNINGS CALL TRANSCRIPT:
${request.content.substring(0, 15000)} // Limit content to avoid token limits

Please provide your analysis in the following JSON format:
{
  "overall_sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0,
  "sentiment_score": -1.0 to 1.0,
  "key_themes": ["theme1", "theme2", ...],
  "risk_factors": [
    {
      "category": "Financial Risk",
      "description": "Detailed description of the risk",
      "severity": "low|medium|high",
      "impact": "financial|operational|regulatory|reputational"
    }
  ],
  "management_tone": {
    "confidence_level": "high|medium|low",
    "transparency_score": 0.0-1.0,
    "optimism_indicators": ["indicator1", "indicator2"],
    "caution_indicators": ["indicator1", "indicator2"]
  },
  "forward_guidance": {
    "outlook": "positive|neutral|negative",
    "time_horizon": "next quarter|full year|multi-year",
    "key_commitments": ["commitment1", "commitment2"],
    "uncertainty_factors": ["factor1", "factor2"]
  }
}

Focus on:
- CEO/CFO confidence and tone
- Revenue and earnings guidance
- Market conditions and competition
- Operational challenges and opportunities
- Risk disclosures and mitigation strategies

Be specific and evidence-based in your analysis.`;
    }
    /**
     * Build prompt for SEC filing analysis
     */
    buildSECFilingPrompt(request) {
        return `You are a financial analyst expert in SEC filing analysis. Analyze the following SEC filing and provide a comprehensive sentiment and risk assessment.

DOCUMENT INFORMATION:
- Company: ${request.companyName || "Unknown"}
- Filing Type: ${request.filingType || "Unknown"}
- Period: ${request.period || "Unknown"}
- Content Length: ${request.content.length} characters

SEC FILING CONTENT:
${request.content.substring(0, 12000)}

Please provide your analysis in the following JSON format:
{
  "overall_sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0,
  "sentiment_score": -1.0 to 1.0,
  "key_themes": ["theme1", "theme2", ...],
  "risk_factors": [
    {
      "category": "Financial Risk",
      "description": "Detailed description of the risk",
      "severity": "low|medium|high",
      "impact": "financial|operational|regulatory|reputational"
    }
  ],
  "management_tone": {
    "confidence_level": "high|medium|low",
    "transparency_score": 0.0-1.0,
    "optimism_indicators": ["indicator1", "indicator2"],
    "caution_indicators": ["indicator1", "indicator2"]
  },
  "forward_guidance": {
    "outlook": "positive|neutral|negative",
    "time_horizon": "next quarter|full year|multi-year",
    "key_commitments": ["commitment1", "commitment2"],
    "uncertainty_factors": ["factor1", "factor2"]
  }
}

Focus on:
- Management's Discussion and Analysis (MD&A) section
- Risk Factors section
- Business outlook and strategy
- Legal proceedings and contingencies
- Accounting policies and estimates

Be thorough in identifying risks and assessing overall business sentiment.`;
    }
    /**
     * Build prompt for press release analysis
     */
    buildPressReleasePrompt(request) {
        return `You are a financial analyst expert in press release analysis. Analyze the following company press release and provide sentiment assessment.

DOCUMENT INFORMATION:
- Company: ${request.companyName || "Unknown"}
- Content Length: ${request.content.length} characters

PRESS RELEASE CONTENT:
${request.content.substring(0, 10000)}

Please provide your analysis in the following JSON format:
{
  "overall_sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0,
  "sentiment_score": -1.0 to 1.0,
  "key_themes": ["theme1", "theme2", ...],
  "risk_factors": [
    {
      "category": "Financial Risk",
      "description": "Detailed description of the risk",
      "severity": "low|medium|high",
      "impact": "financial|operational|regulatory|reputational"
    }
  ],
  "management_tone": {
    "confidence_level": "high|medium|low",
    "transparency_score": 0.0-1.0,
    "optimism_indicators": ["indicator1", "indicator2"],
    "caution_indicators": ["indicator1", "indicator2"]
  },
  "forward_guidance": {
    "outlook": "positive|neutral|negative",
    "time_horizon": "next quarter|full year|multi-year",
    "key_commitments": ["commitment1", "commitment2"],
    "uncertainty_factors": ["factor1", "factor2"]
  }
}

Focus on:
- Product launches and innovations
- Financial performance highlights
- Strategic partnerships and deals
- Market expansion and growth initiatives
- Any cautionary language or risks mentioned

Analyze the overall market perception and business momentum.`;
    }
    /**
     * Build prompt for general document analysis
     */
    buildGeneralDocumentPrompt(request) {
        return `You are a financial analyst expert in document sentiment analysis. Analyze the following financial document and provide comprehensive sentiment assessment.

DOCUMENT INFORMATION:
- Company: ${request.companyName || "Unknown"}
- Content Length: ${request.content.length} characters

DOCUMENT CONTENT:
${request.content.substring(0, 10000)}

Please provide your analysis in the following JSON format:
{
  "overall_sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0,
  "sentiment_score": -1.0 to 1.0,
  "key_themes": ["theme1", "theme2", ...],
  "risk_factors": [
    {
      "category": "Financial Risk",
      "description": "Detailed description of the risk",
      "severity": "low|medium|high",
      "impact": "financial|operational|regulatory|reputational"
    }
  ],
  "management_tone": {
    "confidence_level": "high|medium|low",
    "transparency_score": 0.0-1.0,
    "optimism_indicators": ["indicator1", "indicator2"],
    "caution_indicators": ["indicator1", "indicator2"]
  },
  "forward_guidance": {
    "outlook": "positive|neutral|negative",
    "time_horizon": "next quarter|full year|multi-year",
    "key_commitments": ["commitment1", "commitment2"],
    "uncertainty_factors": ["factor1", "factor2"]
  }
}

Provide a balanced analysis of the document's sentiment, risks, and business outlook.`;
    }
    /**
     * Parse LLM response into structured sentiment result
     */
    parseSentimentResponse(content, documentType) {
        try {
            // Extract JSON from response (LLM might add extra text)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON found in LLM response");
            }
            const parsed = JSON.parse(jsonMatch[0]);
            // Validate and provide defaults for missing fields
            return {
                overall_sentiment: parsed.overall_sentiment || "neutral",
                confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
                sentiment_score: Math.max(-1, Math.min(1, parsed.sentiment_score || 0)),
                key_themes: Array.isArray(parsed.key_themes) ? parsed.key_themes : [],
                risk_factors: Array.isArray(parsed.risk_factors)
                    ? parsed.risk_factors
                    : [],
                management_tone: parsed.management_tone || {
                    confidence_level: "medium",
                    transparency_score: 0.5,
                    optimism_indicators: [],
                    caution_indicators: [],
                },
                forward_guidance: parsed.forward_guidance || {
                    outlook: "neutral",
                    time_horizon: "unknown",
                    key_commitments: [],
                    uncertainty_factors: [],
                },
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to parse sentiment response", error instanceof Error ? error : undefined, {
                documentType,
                contentLength: content.length,
            });
            // Return a neutral result if parsing fails
            return {
                overall_sentiment: "neutral",
                confidence: 0.1, // Low confidence due to parsing failure
                sentiment_score: 0,
                key_themes: ["analysis_failed"],
                risk_factors: [],
                management_tone: {
                    confidence_level: "low",
                    transparency_score: 0.1,
                    optimism_indicators: [],
                    caution_indicators: ["analysis_failed"],
                },
                forward_guidance: {
                    outlook: "neutral",
                    time_horizon: "unknown",
                    key_commitments: [],
                    uncertainty_factors: ["analysis_failed"],
                },
            };
        }
    }
    /**
     * Generate cache key for sentiment analysis
     */
    generateCacheKey(request) {
        const contentHash = this.simpleHash(request.content.substring(0, 1000)); // Hash first 1000 chars
        return `${request.documentType}:${request.companyName || "unknown"}:${request.period || "unknown"}:${contentHash}`;
    }
    /**
     * Simple hash function for cache keys
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
    /**
     * Clear sentiment analysis cache
     */
    clearCache() {
        return this.cache.clear();
    }
}
exports.SentimentAnalysisService = SentimentAnalysisService;
//# sourceMappingURL=SentimentAnalysisService.js.map