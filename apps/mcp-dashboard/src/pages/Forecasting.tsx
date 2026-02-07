import {
  BarChart3,
  Calculator,
  LineChart,
  Loader,
  TrendingUp,
} from "lucide-react";
import React, { useState } from "react";

import {
  FinancialBarChart,
  FinancialLineChart,
} from "../components/charts/FinancialCharts";

interface ForecastingResult {
  forecast: {
    periods: string[];
    values: number[];
    confidence_intervals?: {
      lower: number[];
      upper: number[];
      level: number;
    };
  };
  model_info: {
    type: string;
    accuracy_score: number;
    trend_direction: "increasing" | "decreasing" | "stable" | "volatile";
    seasonality_detected: boolean;
    data_quality_assessment: string;
  };
  growth_analysis: {
    cagr: number;
    growth_stability: number;
    projected_growth_next_period: number;
    growth_trend: "accelerating" | "decelerating" | "stable" | "erratic";
  };
}

export default function Forecasting() {
  const [metricName, setMetricName] = useState("revenue");
  const [historicalData, setHistoricalData] = useState("");
  const [forecastPeriods, setForecastPeriods] = useState(4);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<ForecastingResult | null>(null);
  const [error, setError] = useState("");

  const handleForecast = async () => {
    if (!historicalData.trim()) {
      setError("Please enter historical data");
      return;
    }

    try {
      // Parse the historical data
      const lines = historicalData.trim().split("\n");
      const data: { periods: string[]; values: number[] } = {
        periods: [],
        values: [],
      };

      for (const line of lines) {
        const [period, value] = line.split(",").map((s) => s.trim());
        if (period && value) {
          data.periods.push(period);
          data.values.push(parseFloat(value));
        }
      }

      if (data.periods.length < 3) {
        setError("Please provide at least 3 data points for forecasting");
        return;
      }

      setIsCalculating(true);
      setError("");
      setResult(null);

      // This would call the MCP forecasting API
      // For now, using mock calculation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockResult: ForecastingResult = {
        forecast: {
          periods: Array.from(
            { length: forecastPeriods },
            (_, i) => `Forecast_${i + 1}`
          ),
          values: Array.from(
            { length: forecastPeriods },
            (_, i) => data.values[data.values.length - 1] * (1 + 0.1 * (i + 1))
          ),
          confidence_intervals: {
            lower: Array.from(
              { length: forecastPeriods },
              (_, i) =>
                data.values[data.values.length - 1] * (1 + 0.05 * (i + 1))
            ),
            upper: Array.from(
              { length: forecastPeriods },
              (_, i) =>
                data.values[data.values.length - 1] * (1 + 0.15 * (i + 1))
            ),
            level: 0.95,
          },
        },
        model_info: {
          type: "linear_regression",
          accuracy_score: 0.85,
          trend_direction: "increasing",
          seasonality_detected: false,
          data_quality_assessment:
            "Good data quality with consistent upward trend",
        },
        growth_analysis: {
          cagr: 0.12,
          growth_stability: 0.78,
          projected_growth_next_period: 0.08,
          growth_trend: "stable",
        },
      };

      setResult(mockResult);
    } catch (err) {
      setError("Failed to generate forecast. Please check your data format.");
      console.error("Forecasting error:", err);
    } finally {
      setIsCalculating(false);
    }
  };

  const loadSampleData = () => {
    const sampleData = `FY2020, 1000000
FY2021, 1150000
FY2022, 1322500
FY2023, 1520875
FY2024, 1749006`;

    setHistoricalData(sampleData);
    setMetricName("revenue");
    setForecastPeriods(4);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing":
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case "decreasing":
        return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
      default:
        return <BarChart3 className="w-4 h-4 text-gray-500" />;
    }
  };

  const getGrowthColor = (trend: string) => {
    switch (trend) {
      case "accelerating":
        return "text-green-600";
      case "stable":
        return "text-blue-600";
      case "decelerating":
        return "text-yellow-600";
      case "erratic":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Financial Forecasting
          </h1>
          <p className="text-gray-600">
            Generate predictive models and forecast financial metrics
          </p>
        </div>
        <button
          onClick={loadSampleData}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Load Sample Data
        </button>
      </div>

      {/* Forecasting Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Metric Name
            </label>
            <input
              type="text"
              value={metricName}
              onChange={(e) => setMetricName(e.target.value)}
              placeholder="e.g., revenue, earnings, users"
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forecast Periods
            </label>
            <select
              value={forecastPeriods}
              onChange={(e) => setForecastPeriods(parseInt(e.target.value))}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value={1}>1 period</option>
              <option value={2}>2 periods</option>
              <option value={4}>4 periods</option>
              <option value={6}>6 periods</option>
              <option value={12}>12 periods</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleForecast}
              disabled={isCalculating}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isCalculating ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4 mr-2" />
                  Generate Forecast
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Historical Data (CSV format: period,value)
          </label>
          <textarea
            value={historicalData}
            onChange={(e) => setHistoricalData(e.target.value)}
            rows={8}
            placeholder={`FY2020,1000000
FY2021,1150000
FY2022,1322500
FY2023,1520875`}
            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
          />
          <p className="mt-1 text-sm text-gray-500">
            Enter historical data as CSV: period,value (one per line)
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}
      </div>

      {/* Forecasting Results */}
      {result && (
        <div className="space-y-6">
          {/* Model Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <BarChart3 className="w-8 h-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Model Type
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {result.model_info.type}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                {getTrendIcon(result.model_info.trend_direction)}
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Trend</p>
                  <p className="text-lg font-semibold capitalize text-gray-900">
                    {result.model_info.trend_direction}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <LineChart className="w-8 h-8 text-green-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Accuracy</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {(result.model_info.accuracy_score * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-purple-500 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-600">CAGR</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatPercentage(result.growth_analysis.cagr)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Forecast Chart */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Forecast Visualization
            </h3>
            <FinancialLineChart
              data={result.forecast.periods.map((period, index) => ({
                period,
                value: result.forecast.values[index],
              }))}
              title={`Forecasted ${metricName}`}
              height={350}
              color="#10B981"
            />
          </div>

          {/* Growth Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Growth Analysis
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">
                    Compound Annual Growth Rate
                  </span>
                  <span className="text-sm font-semibold text-green-600">
                    {formatPercentage(result.growth_analysis.cagr)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">
                    Growth Stability
                  </span>
                  <span className="text-sm font-semibold">
                    {(result.growth_analysis.growth_stability * 100).toFixed(1)}
                    %
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">
                    Next Period Growth
                  </span>
                  <span className="text-sm font-semibold">
                    {formatPercentage(
                      result.growth_analysis.projected_growth_next_period
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">
                    Growth Trend
                  </span>
                  <span
                    className={`text-sm font-semibold capitalize ${getGrowthColor(result.growth_analysis.growth_trend)}`}
                  >
                    {result.growth_analysis.growth_trend}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Model Assessment
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Data Quality</span>
                    <span className="font-medium">Good</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Seasonality Detected</span>
                    <span className="font-medium">
                      {result.model_info.seasonality_detected ? "Yes" : "No"}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Forecast Confidence</span>
                    <span className="font-medium">High</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: "85%" }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-600">
                    {result.model_info.data_quality_assessment}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Forecast Data Table */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Forecast Data
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Forecast Value
                    </th>
                    {result.forecast.confidence_intervals && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Lower Bound
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Upper Bound
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {result.forecast.periods.map((period, index) => (
                    <tr key={period}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {period}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(result.forecast.values[index])}
                      </td>
                      {result.forecast.confidence_intervals && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatCurrency(
                              result.forecast.confidence_intervals.lower[index]
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatCurrency(
                              result.forecast.confidence_intervals.upper[index]
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
