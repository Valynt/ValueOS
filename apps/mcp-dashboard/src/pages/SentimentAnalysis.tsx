import {
  FileText,
  Loader,
  MessageSquare,
  Send,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import React, { useState } from "react";

import { SentimentGauge } from "../components/charts/FinancialCharts";

interface SentimentResult {
  overall_sentiment: "positive" | "neutral" | "negative";
  confidence: number;
  sentiment_score: number;
  key_themes: string[];
  risk_factors: Array<{
    category: string;
    description: string;
    severity: "low" | "medium" | "high";
  }>;
  management_tone: {
    confidence_level: "high" | "medium" | "low";
    transparency_score: number;
  };
  forward_guidance: {
    outlook: "positive" | "neutral" | "negative";
    time_horizon: string;
  };
}

export default function SentimentAnalysis() {
  const [documentType, setDocumentType] = useState<
    "earnings_call" | "sec_filing" | "press_release" | "analyst_report"
  >("earnings_call");
  const [content, setContent] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<SentimentResult | null>(null);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!content.trim()) {
      setError("Please enter document content to analyze");
      return;
    }

    setIsAnalyzing(true);
    setError("");
    setResult(null);

    try {
      // This would call the MCP sentiment analysis API
      // For now, using mock data
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate API call

      const mockResult: SentimentResult = {
        overall_sentiment: "positive",
        confidence: 0.87,
        sentiment_score: 0.65,
        key_themes: [
          "revenue growth",
          "margin expansion",
          "strategic investments",
          "market leadership",
        ],
        risk_factors: [
          {
            category: "Market Risk",
            description: "Competitive pressures in key markets",
            severity: "medium",
          },
          {
            category: "Operational Risk",
            description: "Supply chain optimization challenges",
            severity: "low",
          },
        ],
        management_tone: {
          confidence_level: "high",
          transparency_score: 0.92,
        },
        forward_guidance: {
          outlook: "positive",
          time_horizon: "full year",
        },
      };

      setResult(mockResult);
    } catch (err) {
      setError("Failed to analyze sentiment. Please try again.");
      console.error("Sentiment analysis error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadSampleContent = () => {
    const sampleContent = `Thank you for joining our Q4 earnings call. I'm pleased to report that we exceeded our revenue guidance by 8%, achieving $2.4 billion in total revenue, representing 15% year-over-year growth.

Our cloud business continues to show strong momentum, with 25% growth driven by enterprise adoption and new customer acquisitions. While we face some headwinds in the consumer segment, our B2B focus provides stability and long-term growth potential.

Looking ahead to fiscal 2024, we're guiding to 12-15% revenue growth, supported by our continued investment in AI and cloud infrastructure. We remain confident in our ability to deliver shareholder value through disciplined execution and strategic innovation.`;

    setContent(sampleContent);
    setCompanyName("TechCorp Inc.");
    setDocumentType("earnings_call");
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "text-green-600";
      case "negative":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "text-red-600 bg-red-50";
      case "medium":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-green-600 bg-green-50";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Sentiment Analysis
          </h1>
          <p className="text-gray-600">
            Analyze sentiment and qualitative factors in financial documents
          </p>
        </div>
        <button
          onClick={loadSampleContent}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Load Sample
        </button>
      </div>

      {/* Analysis Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as any)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="earnings_call">Earnings Call Transcript</option>
              <option value="sec_filing">SEC Filing</option>
              <option value="press_release">Press Release</option>
              <option value="analyst_report">Analyst Report</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name (Optional)
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Apple Inc."
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              placeholder="Paste your financial document content here..."
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            <p className="mt-1 text-sm text-gray-500">
              {content.length} characters
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !content.trim()}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Analyze Sentiment
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {result && (
        <div className="space-y-6">
          {/* Overall Sentiment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SentimentGauge
              sentiment={{
                overall: result.overall_sentiment,
                score: result.sentiment_score,
                confidence: result.confidence,
              }}
            />

            {/* Key Metrics */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Analysis Summary
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">
                    Overall Sentiment
                  </span>
                  <span
                    className={`text-sm font-semibold capitalize ${getSentimentColor(result.overall_sentiment)}`}
                  >
                    {result.overall_sentiment}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">
                    Confidence Score
                  </span>
                  <span className="text-sm font-semibold">
                    {(result.confidence * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">
                    Management Tone
                  </span>
                  <span className="text-sm font-semibold capitalize">
                    {result.management_tone.confidence_level}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">
                    Forward Outlook
                  </span>
                  <span
                    className={`text-sm font-semibold capitalize ${getSentimentColor(result.forward_guidance.outlook)}`}
                  >
                    {result.forward_guidance.outlook}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Themes */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Key Themes Identified
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.key_themes.map((theme, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>

          {/* Risk Factors */}
          {result.risk_factors.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Risk Factors
              </h3>
              <div className="space-y-3">
                {result.risk_factors.map((risk, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">
                        {risk.category}
                      </h4>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(risk.severity)}`}
                      >
                        {risk.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{risk.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Management Assessment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Management Assessment
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Confidence Level</span>
                    <span className="font-medium">
                      {result.management_tone.confidence_level}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Transparency Score</span>
                    <span className="font-medium">
                      {(
                        result.management_tone.transparency_score * 100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`bg-blue-500 h-2 rounded-full w-[${result.management_tone.transparency_score * 100}%]`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Forward Guidance
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    Outlook
                  </span>
                  <span
                    className={`text-sm font-semibold capitalize ${getSentimentColor(result.forward_guidance.outlook)}`}
                  >
                    {result.forward_guidance.outlook}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    Time Horizon
                  </span>
                  <span className="text-sm font-semibold">
                    {result.forward_guidance.time_horizon}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
