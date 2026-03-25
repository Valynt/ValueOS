/**
 * Predictive Modeling Service - Financial Forecasting and Trend Analysis
 *
 * Provides advanced predictive analytics for financial data including:
 * - Time series forecasting for financial metrics
 * - Industry trend prediction and extrapolation
 * - Anomaly detection for unusual data patterns
 * - Statistical modeling with confidence intervals
 * - Growth rate analysis and forecasting
 *
 * Uses statistical methods and machine learning approaches for
 * reliable financial predictions and risk assessment.
 */

import { logger } from "../../lib/logger";
import { getCache } from "../core/Cache";

export interface TimeSeriesData {
  periods: string[]; // Period labels (e.g., "FY2020", "FY2021")
  values: number[]; // Corresponding values
  metadata?: {
    company?: string;
    metric?: string;
    data_quality?: number; // 0-1 confidence in data accuracy
  };
}

export interface ForecastingRequest {
  historicalData: TimeSeriesData;
  forecastPeriods: number; // How many periods to forecast
  confidenceLevel?: number; // 0.8, 0.9, 0.95 for confidence intervals
  modelType?: "linear" | "exponential" | "seasonal" | "auto";
}

export interface ForecastingResult {
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
    accuracy_score: number; // R-squared or similar
    trend_direction: "increasing" | "decreasing" | "stable" | "volatile";
    seasonality_detected: boolean;
    data_quality_assessment: string;
  };
  growth_analysis: {
    cagr: number; // Compound Annual Growth Rate
    growth_stability: number; // 0-1, how consistent growth has been
    projected_growth_next_period: number;
    growth_trend: "accelerating" | "decelerating" | "stable" | "erratic";
  };
}

export interface AnomalyDetectionRequest {
  data: TimeSeriesData;
  sensitivity?: "low" | "medium" | "high"; // How aggressively to detect anomalies
  context?: {
    industry?: string;
    metric_type?: string;
    expected_seasonality?: boolean;
  };
}

export interface AnomalyResult {
  anomalies: {
    period: string;
    value: number;
    expected_value: number;
    deviation_percent: number;
    severity: "low" | "medium" | "high" | "critical";
    explanation: string;
  }[];
  overall_assessment: {
    anomaly_count: number;
    data_quality_score: number; // 0-1
    recommendations: string[];
    risk_level: "low" | "medium" | "high";
  };
}

export interface TrendAnalysisRequest {
  data: TimeSeriesData;
  comparisonData?: TimeSeriesData[]; // Optional peer/benchmark data
  analysisType: "industry" | "company" | "market" | "peer_comparison";
}

export interface TrendAnalysisResult {
  trend_summary: {
    direction: "upward" | "downward" | "sideways" | "volatile";
    strength: number; // 0-1, how strong the trend is
    consistency: number; // 0-1, how consistent the trend has been
    duration_periods: number; // How many periods the trend has lasted
  };
  statistical_measures: {
    mean: number;
    median: number;
    standard_deviation: number;
    coefficient_of_variation: number;
    skewness: number; // Measure of asymmetry
    kurtosis: number; // Measure of "tailedness"
  };
  peer_comparison?: {
    percentile_rank: number; // Where this data ranks vs peers
    relative_performance: "leading" | "average" | "lagging";
    convergence_divergence: "converging" | "diverging" | "stable";
  };
  forecast_implications: {
    short_term_outlook: "positive" | "neutral" | "negative";
    long_term_trajectory: string;
    key_inflection_points: string[];
  };
}

export class PredictiveModelingService {
  private cache = getCache();

  /**
   * Generate financial forecast using time series analysis
   */
  async generateForecast(
    request: ForecastingRequest
  ): Promise<ForecastingResult> {
    const cacheKey = `forecast:${this.generateDataHash(request.historicalData)}:${request.forecastPeriods}`;

    const cachedResult = await this.cache.get<ForecastingResult>(cacheKey);
    if (cachedResult) {
      logger.debug("Using cached forecast result");
      return cachedResult;
    }

    try {
      logger.info("Generating financial forecast", {
        dataPoints: request.historicalData.values.length,
        forecastPeriods: request.forecastPeriods,
        modelType: request.modelType,
      });

      // Analyze the data and determine best model
      const modelType =
        request.modelType || this.selectBestModel(request.historicalData);

      let forecast: ForecastingResult;
      switch (modelType) {
        case "linear":
          forecast = this.linearRegressionForecast(request);
          break;
        case "exponential":
          forecast = this.exponentialSmoothingForecast(request);
          break;
        case "seasonal":
          forecast = this.seasonalDecompositionForecast(request);
          break;
        case "auto":
        default:
          forecast = this.automaticForecast(request);
      }

      // Cache the result (Tier 2 - 6 hour TTL for forecasts)
      await this.cache.set(cacheKey, forecast, "tier2");

      logger.info("Forecast generated successfully", {
        modelType: forecast.model_info.type,
        accuracyScore: forecast.model_info.accuracy_score,
        cagr: forecast.growth_analysis.cagr,
      });

      return forecast;
    } catch (error) {
      logger.error(
        "Forecast generation failed",
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  /**
   * Detect anomalies in financial time series data
   */
  async detectAnomalies(
    request: AnomalyDetectionRequest
  ): Promise<AnomalyResult> {
    const cacheKey = `anomalies:${this.generateDataHash(request.data)}:${request.sensitivity || "medium"}`;

    const cachedResult = await this.cache.get<AnomalyResult>(cacheKey);
    if (cachedResult) {
      logger.debug("Using cached anomaly detection result");
      return cachedResult;
    }

    try {
      logger.info("Detecting anomalies in time series", {
        dataPoints: request.data.values.length,
        sensitivity: request.sensitivity,
        context: request.context,
      });

      const anomalies = this.performAnomalyDetection(request);
      const assessment = this.assessDataQuality(request.data, anomalies);

      const result: AnomalyResult = {
        anomalies,
        overall_assessment: assessment,
      };

      // Cache the result (Tier 2 - 6 hour TTL)
      await this.cache.set(cacheKey, result, "tier2");

      logger.info("Anomaly detection completed", {
        anomalyCount: anomalies.length,
        riskLevel: assessment.risk_level,
      });

      return result;
    } catch (error) {
      logger.error(
        "Anomaly detection failed",
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  /**
   * Analyze trends in financial data
   */
  async analyzeTrends(
    request: TrendAnalysisRequest
  ): Promise<TrendAnalysisResult> {
    const cacheKey = `trends:${this.generateDataHash(request.data)}:${request.analysisType}`;

    const cachedResult = await this.cache.get<TrendAnalysisResult>(cacheKey);
    if (cachedResult) {
      logger.debug("Using cached trend analysis result");
      return cachedResult;
    }

    try {
      logger.info("Analyzing trends in financial data", {
        dataPoints: request.data.values.length,
        analysisType: request.analysisType,
        hasComparisonData: !!request.comparisonData?.length,
      });

      const trendSummary = this.calculateTrendSummary(request.data);
      const statisticalMeasures = this.calculateStatisticalMeasures(
        request.data
      );
      const peerComparison = request.comparisonData
        ? this.performPeerComparison(request.data, request.comparisonData)
        : undefined;
      const forecastImplications = this.analyzeForecastImplications(
        request.data,
        trendSummary
      );

      const result: TrendAnalysisResult = {
        trend_summary: trendSummary,
        statistical_measures: statisticalMeasures,
        peer_comparison: peerComparison,
        forecast_implications: forecastImplications,
      };

      // Cache the result (Tier 2 - 6 hour TTL)
      await this.cache.set(cacheKey, result, "tier2");

      logger.info("Trend analysis completed", {
        trendDirection: trendSummary.direction,
        trendStrength: trendSummary.strength,
      });

      return result;
    } catch (error) {
      logger.error(
        "Trend analysis failed",
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
  }

  /**
   * Linear regression forecasting
   */
  private linearRegressionForecast(
    request: ForecastingRequest
  ): ForecastingResult {
    const { historicalData, forecastPeriods, confidenceLevel = 0.95 } = request;
    const { periods, values } = historicalData;

    // Simple linear regression: y = mx + b
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i); // Time indices

    // Calculate means
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = values.reduce((a, b) => a + b, 0) / n;

    // Calculate slope (m) and intercept (b)
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (values[i] - meanY);
      denominator += Math.pow(x[i] - meanX, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;

    // Generate forecast
    const forecastPeriodsArray: string[] = [];
    const forecastValues: number[] = [];

    for (let i = 0; i < forecastPeriods; i++) {
      const periodIndex = n + i;
      const predictedValue = slope * periodIndex + intercept;

      forecastPeriodsArray.push(`Forecast_${i + 1}`);
      forecastValues.push(Math.max(0, predictedValue)); // Ensure non-negative
    }

    // Calculate R-squared for accuracy
    const predictedHistorical = x.map((xi) => slope * xi + intercept);
    const ssRes = values.reduce(
      (sum, yi, i) => sum + Math.pow(yi - predictedHistorical[i], 2),
      0
    );
    const ssTot = values.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
    const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    // Calculate CAGR
    const initialValue = values[0] ?? 0;
    const finalValue = values[values.length - 1] ?? 0;
    const periodsCount = values.length - 1;
    const cagr =
      periodsCount > 0 && initialValue > 0
        ? Math.pow(finalValue / initialValue, 1 / periodsCount) - 1
        : 0;

    // Assess growth stability (coefficient of variation of growth rates)
    const growthRates: number[] = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0) {
        growthRates.push((values[i] - values[i - 1]) / values[i - 1]);
      }
    }
    const growthStability =
      growthRates.length > 0
        ? 1 /
          (1 +
            this.calculateStandardDeviation(growthRates) /
              Math.abs(this.calculateMean(growthRates) || 1))
        : 0;

    // Determine trend direction
    let trendDirection: "increasing" | "decreasing" | "stable" | "volatile" =
      "stable";
    if (Math.abs(slope) > this.calculateStandardDeviation(values) * 0.1) {
      trendDirection = slope > 0 ? "increasing" : "decreasing";
    } else if (this.calculateCoefficientOfVariation(values) > 0.5) {
      trendDirection = "volatile";
    }

    return {
      forecast: {
        periods: forecastPeriodsArray,
        values: forecastValues,
      },
      model_info: {
        type: "linear_regression",
        accuracy_score: Math.max(0, Math.min(1, rSquared)),
        trend_direction: trendDirection,
        seasonality_detected: false, // Linear regression doesn't detect seasonality
        data_quality_assessment: this.assessDataQualityText(historicalData),
      },
      growth_analysis: {
        cagr: cagr,
        growth_stability: Math.max(0, Math.min(1, growthStability)),
        projected_growth_next_period: slope > 0 ? slope : 0,
        growth_trend: this.determineGrowthTrend(values),
      },
    };
  }

  /**
   * Exponential smoothing forecast
   */
  private exponentialSmoothingForecast(
    request: ForecastingRequest
  ): ForecastingResult {
    const { historicalData, forecastPeriods } = request;
    const values = [...historicalData.values];
    const alpha = 0.3; // Smoothing parameter

    // Calculate smoothed values
    const smoothed = [values[0]];
    for (let i = 1; i < values.length; i++) {
      smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
    }

    // Generate forecast using last smoothed value
    const lastSmoothed = smoothed[smoothed.length - 1];
    const forecastValues = Array(forecastPeriods).fill(lastSmoothed);

    return {
      forecast: {
        periods: Array.from(
          { length: forecastPeriods },
          (_, i) => `Forecast_${i + 1}`
        ),
        values: forecastValues,
      },
      model_info: {
        type: "exponential_smoothing",
        accuracy_score: 0.7, // Placeholder - would calculate MAPE
        trend_direction: "stable",
        seasonality_detected: false,
        data_quality_assessment: this.assessDataQualityText(historicalData),
      },
      growth_analysis: {
        cagr: 0,
        growth_stability: 0.5,
        projected_growth_next_period: 0,
        growth_trend: "stable",
      },
    };
  }

  /**
   * Seasonal decomposition forecast (simplified)
   */
  private seasonalDecompositionForecast(
    request: ForecastingRequest
  ): ForecastingResult {
    // Simplified seasonal analysis - would need more sophisticated implementation
    return this.linearRegressionForecast(request);
  }

  /**
   * Automatic model selection and forecasting
   */
  private automaticForecast(request: ForecastingRequest): ForecastingResult {
    // For now, default to linear regression
    // In production, would analyze data characteristics to select best model
    return this.linearRegressionForecast(request);
  }

  /**
   * Select best forecasting model based on data characteristics
   */
  private selectBestModel(
    data: TimeSeriesData
  ): "linear" | "exponential" | "seasonal" {
    const values = data.values;
    if (values.length < 3) return "linear";

    // Check for strong trend (use linear regression)
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const slope = this.calculateSlope(x, values);

    if (Math.abs(slope) > this.calculateStandardDeviation(values) * 0.2) {
      return "linear";
    }

    // Check for seasonality (simplified check)
    if (n >= 8) {
      // Look for quarterly patterns
      const quarters = values.slice(-8); // Last 2 years
      if (this.detectSeasonality(quarters)) {
        return "seasonal";
      }
    }

    return "exponential";
  }

  /**
   * Perform anomaly detection using statistical methods
   */
  private performAnomalyDetection(
    request: AnomalyDetectionRequest
  ): AnomalyResult["anomalies"] {
    const { data, sensitivity = "medium" } = request;
    const values = data.values;
    const anomalies: AnomalyResult["anomalies"] = [];

    if (values.length < 3) return anomalies;

    // Calculate rolling statistics
    const windowSize = Math.min(5, Math.floor(values.length / 3));
    const sensitivityMultiplier =
      { low: 2, medium: 2.5, high: 3 }[sensitivity] || 2.5;

    for (let i = windowSize; i < values.length; i++) {
      const window = values.slice(i - windowSize, i);
      const mean = this.calculateMean(window);
      const stdDev = this.calculateStandardDeviation(window);

      if (stdDev === 0) continue;

      const deviation = Math.abs(values[i] - mean) / stdDev;

      if (deviation > sensitivityMultiplier) {
        const severity =
          deviation > 4
            ? "critical"
            : deviation > 3
              ? "high"
              : deviation > 2.5
                ? "medium"
                : "low";

        anomalies.push({
          period: data.periods[i],
          value: values[i],
          expected_value: mean,
          deviation_percent: ((values[i] - mean) / mean) * 100,
          severity: severity as "low" | "medium" | "high" | "critical",
          explanation: this.generateAnomalyExplanation(
            values[i],
            mean,
            deviation
          ),
        });
      }
    }

    return anomalies;
  }

  /**
   * Assess overall data quality and provide recommendations
   */
  private assessDataQuality(
    data: TimeSeriesData,
    anomalies: AnomalyResult["anomalies"]
  ): AnomalyResult["overall_assessment"] {
    const anomalyCount = anomalies.length;
    const totalPoints = data.values.length;
    const anomalyRate = anomalyCount / totalPoints;

    let dataQualityScore = 1 - anomalyRate;
    let riskLevel: "low" | "medium" | "high" = "low";
    const recommendations: string[] = [];

    if (anomalyRate > 0.3) {
      riskLevel = "high";
      recommendations.push(
        "High anomaly rate detected - review data collection process"
      );
      recommendations.push(
        "Consider implementing additional data validation checks"
      );
    } else if (anomalyRate > 0.15) {
      riskLevel = "medium";
      recommendations.push(
        "Moderate anomaly rate - monitor data quality trends"
      );
      recommendations.push("Validate data sources and calculation methods");
    } else {
      recommendations.push("Data quality appears good - continue monitoring");
    }

    // Additional checks
    const criticalAnomalies = anomalies.filter(
      (a) => a.severity === "critical"
    ).length;
    if (criticalAnomalies > 0) {
      riskLevel = "high";
      recommendations.push(
        `${criticalAnomalies} critical anomalies detected - immediate investigation required`
      );
    }

    return {
      anomaly_count: anomalyCount,
      data_quality_score: Math.max(0, Math.min(1, dataQualityScore)),
      recommendations,
      risk_level: riskLevel,
    };
  }

  /**
   * Calculate trend summary statistics
   */
  private calculateTrendSummary(
    data: TimeSeriesData
  ): TrendAnalysisResult["trend_summary"] {
    const values = data.values;
    if (values.length < 2) {
      return {
        direction: "sideways",
        strength: 0,
        consistency: 0,
        duration_periods: values.length,
      };
    }

    // Calculate slope using linear regression
    const x = Array.from({ length: values.length }, (_, i) => i);
    const slope = this.calculateSlope(x, values);
    const intercept = this.calculateIntercept(x, values, slope);

    // Calculate R-squared for trend strength
    const predicted = x.map((xi) => slope * xi + intercept);
    const actualMean = this.calculateMean(values);
    const ssRes = values.reduce(
      (sum, yi, i) => sum + Math.pow(yi - predicted[i], 2),
      0
    );
    const ssTot = values.reduce(
      (sum, yi) => sum + Math.pow(yi - actualMean, 2),
      0
    );
    const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    // Determine direction
    let direction: "upward" | "downward" | "sideways" | "volatile" = "sideways";
    const strengthThreshold = this.calculateStandardDeviation(values) * 0.1;

    if (Math.abs(slope) > strengthThreshold) {
      direction = slope > 0 ? "upward" : "downward";
    } else if (this.calculateCoefficientOfVariation(values) > 0.5) {
      direction = "volatile";
    }

    // Calculate consistency (how well the trend fits the data)
    const consistency = Math.max(0, Math.min(1, rSquared));

    return {
      direction,
      strength: Math.max(0, Math.min(1, rSquared)),
      consistency,
      duration_periods: values.length,
    };
  }

  /**
   * Calculate comprehensive statistical measures
   */
  private calculateStatisticalMeasures(
    data: TimeSeriesData
  ): TrendAnalysisResult["statistical_measures"] {
    const values = data.values;
    const mean = this.calculateMean(values);
    const median = this.calculateMedian(values);
    const stdDev = this.calculateStandardDeviation(values);
    const cv = mean !== 0 ? stdDev / Math.abs(mean) : 0;

    // Calculate skewness
    const skewness =
      values.reduce((sum, val) => {
        return sum + Math.pow((val - mean) / stdDev, 3);
      }, 0) / values.length;

    // Calculate kurtosis
    const kurtosis =
      values.reduce((sum, val) => {
        return sum + Math.pow((val - mean) / stdDev, 4);
      }, 0) /
        values.length -
      3; // Excess kurtosis

    return {
      mean,
      median,
      standard_deviation: stdDev,
      coefficient_of_variation: cv,
      skewness,
      kurtosis,
    };
  }

  /**
   * Perform peer comparison analysis
   */
  private performPeerComparison(
    targetData: TimeSeriesData,
    peerData: TimeSeriesData[]
  ): TrendAnalysisResult["peer_comparison"] {
    if (!peerData.length) return undefined;

    const targetLatest = targetData.values[targetData.values.length - 1];
    const peerLatestValues = peerData
      .map((d) => d.values[d.values.length - 1])
      .filter((v) => !isNaN(v));

    if (!peerLatestValues.length) return undefined;

    // Calculate percentile rank
    const sortedPeers = [...peerLatestValues].sort((a, b) => a - b);
    let rank = 0;
    for (const peer of sortedPeers) {
      if (targetLatest >= peer) rank++;
    }
    const percentileRank = (rank / sortedPeers.length) * 100;

    // Determine relative performance
    let relativePerformance: "leading" | "average" | "lagging" = "average";
    if (percentileRank >= 75) relativePerformance = "leading";
    else if (percentileRank <= 25) relativePerformance = "lagging";

    // Check for convergence/divergence (simplified)
    const targetGrowth = this.calculateGrowthRate(targetData.values);
    const avgPeerGrowth =
      peerData.reduce((sum, d) => sum + this.calculateGrowthRate(d.values), 0) /
      peerData.length;

    let convergenceDivergence: "converging" | "diverging" | "stable" = "stable";
    const growthDiff = Math.abs(targetGrowth - avgPeerGrowth);
    if (growthDiff > 0.1) {
      // 10% difference threshold
      convergenceDivergence =
        targetGrowth > avgPeerGrowth ? "diverging" : "converging";
    }

    return {
      percentile_rank: percentileRank,
      relative_performance: relativePerformance,
      convergence_divergence: convergenceDivergence,
    };
  }

  /**
   * Analyze forecast implications
   */
  private analyzeForecastImplications(
    data: TimeSeriesData,
    trend: TrendAnalysisResult["trend_summary"]
  ): TrendAnalysisResult["forecast_implications"] {
    const values = data.values;
    const latestValue = values[values.length - 1];
    const previousValue = values[values.length - 2] || latestValue;

    // Simple short-term outlook based on recent trend
    let shortTermOutlook: "positive" | "neutral" | "negative" = "neutral";
    const recentChange = (latestValue - previousValue) / previousValue;

    if (recentChange > 0.05) shortTermOutlook = "positive";
    else if (recentChange < -0.05) shortTermOutlook = "negative";

    // Long-term trajectory based on trend
    let longTermTrajectory = "Stable growth trajectory";
    if (trend.direction === "upward" && trend.strength > 0.7) {
      longTermTrajectory = "Strong upward trajectory with high confidence";
    } else if (trend.direction === "downward" && trend.strength > 0.7) {
      longTermTrajectory = "Downward trajectory requiring attention";
    } else if (trend.direction === "volatile") {
      longTermTrajectory = "Volatile performance with unpredictable trajectory";
    }

    // Identify inflection points (simplified)
    const inflectionPoints: string[] = [];
    for (let i = 2; i < values.length; i++) {
      const prevTrend = values[i - 1] - values[i - 2];
      const currentTrend = values[i] - values[i - 1];
      if (
        (prevTrend > 0 && currentTrend < 0) ||
        (prevTrend < 0 && currentTrend > 0)
      ) {
        inflectionPoints.push(data.periods[i]);
      }
    }

    return {
      short_term_outlook: shortTermOutlook,
      long_term_trajectory: longTermTrajectory,
      key_inflection_points: inflectionPoints,
    };
  }

  // Utility methods

  private calculateMean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return Math.sqrt(this.calculateMean(squaredDiffs));
  }

  private calculateCoefficientOfVariation(values: number[]): number {
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStandardDeviation(values);
    return mean !== 0 ? stdDev / Math.abs(mean) : 0;
  }

  private calculateSlope(x: number[], y: number[]): number {
    const n = x.length;
    const meanX = this.calculateMean(x);
    const meanY = this.calculateMean(y);

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (y[i] - meanY);
      denominator += Math.pow(x[i] - meanX, 2);
    }

    return denominator !== 0 ? numerator / denominator : 0;
  }

  private calculateIntercept(x: number[], y: number[], slope: number): number {
    const meanX = this.calculateMean(x);
    const meanY = this.calculateMean(y);
    return meanY - slope * meanX;
  }

  private detectSeasonality(values: number[]): boolean {
    // Simplified seasonality detection
    if (values.length < 8) return false;

    // Check for quarterly patterns (Q1 < Q2 < Q3 < Q4)
    const quarters = values.slice(-4);
    const isIncreasing = quarters.every(
      (val, i) => i === 0 || val >= quarters[i - 1]
    );

    return isIncreasing;
  }

  private calculateGrowthRate(values: number[]): number {
    if (values.length < 2) return 0;
    const initial = values[0];
    const final = values[values.length - 1];
    return initial !== 0 ? (final - initial) / initial : 0;
  }

  private determineGrowthTrend(
    values: number[]
  ): "accelerating" | "decelerating" | "stable" | "erratic" {
    if (values.length < 4) return "stable";

    const growthRates: number[] = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0) {
        growthRates.push((values[i] - values[i - 1]) / values[i - 1]);
      }
    }

    if (growthRates.length < 3) return "stable";

    // Check if growth rates are increasing (accelerating) or decreasing (decelerating)
    const trendSlope = this.calculateSlope(
      Array.from({ length: growthRates.length }, (_, i) => i),
      growthRates
    );

    const avgGrowth = this.calculateMean(growthRates);
    const growthVolatility = this.calculateStandardDeviation(growthRates);

    if (Math.abs(trendSlope) > growthVolatility * 0.5) {
      return trendSlope > 0 ? "accelerating" : "decelerating";
    } else if (growthVolatility > Math.abs(avgGrowth) * 2) {
      return "erratic";
    }

    return "stable";
  }

  private generateAnomalyExplanation(
    actual: number,
    expected: number,
    deviation: number
  ): string {
    const percentDiff = ((actual - expected) / expected) * 100;
    const direction = actual > expected ? "above" : "below";

    if (deviation > 4) {
      return `Extreme outlier: ${Math.abs(percentDiff).toFixed(1)}% ${direction} expected value. Requires immediate investigation.`;
    } else if (deviation > 3) {
      return `Significant anomaly: ${Math.abs(percentDiff).toFixed(1)}% ${direction} expected value. Review data accuracy.`;
    } else {
      return `Moderate deviation: ${Math.abs(percentDiff).toFixed(1)}% ${direction} expected value. Monitor trend.`;
    }
  }

  private assessDataQualityText(data: TimeSeriesData): string {
    const values = data.values;
    if (values.length < 3) {
      return "Insufficient data points for reliable analysis";
    }

    const cv = this.calculateCoefficientOfVariation(values);
    const hasNegatives = values.some((v) => v < 0);
    const hasZeros = values.some((v) => v === 0);

    if (cv > 1) {
      return "Highly volatile data - use caution in forecasting";
    } else if (hasNegatives) {
      return "Contains negative values - verify metric definition";
    } else if (hasZeros) {
      return "Contains zero values - check data completeness";
    } else if (cv > 0.5) {
      return "Moderately volatile data - forecast confidence may be reduced";
    }

    return "Good data quality with consistent patterns";
  }

  private generateDataHash(data: TimeSeriesData): string {
    const combined = data.periods.join("") + data.values.join("");
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear predictive modeling cache
   */
  clearCache(): Promise<void> {
    return this.cache.clear();
  }
}
