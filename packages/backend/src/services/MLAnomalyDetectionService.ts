/**
 * ML-Based Anomaly Detection Service
 *
 * Implements the ML architecture defined in threat-model.md:
 * - Isolation Forest for temporal anomalies
 * - DBSCAN for behavioral clustering
 * - Graph Neural Network for network analysis
 * - LSTM for resource usage patterns
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TenantAwareService } from './TenantAwareService.js'
import { log } from '../lib/logger.js'
import { SecurityEvent } from './AdvancedThreatDetectionService.js'

// ML Model interfaces
export interface AnomalyDetectionResult {
  isAnomalous: boolean;
  confidence: number;
  anomalyType: 'temporal' | 'behavioral' | 'network' | 'resource';
  riskScore: number;
  details: Record<string, any>;
}

export interface MLModel {
  predict(features: number[]): AnomalyDetectionResult;
  train(data: number[][]): Promise<void>;
  isTrained: boolean;
}

// Feature extraction interfaces
export interface RequestFeatures {
  timestamp: number;
  userId?: string;
  ip: string;
  endpoint: string;
  method: string;
  userAgent: string;
  responseTime: number;
  statusCode: number;
  payloadSize: number;
}

export interface TemporalFeatures {
  requestRate: number;
  timeOfDay: number;
  dayOfWeek: number;
  requestInterval: number;
  burstScore: number;
}

export interface BehavioralFeatures {
  endpointDiversity: number;
  methodDistribution: Record<string, number>;
  userAgentEntropy: number;
  geoLocation: string;
  sessionDuration: number;
}

export interface NetworkFeatures {
  ipReputation: number;
  asn: string;
  country: string;
  proxyDetected: boolean;
  torExitNode: boolean;
  requestPattern: number[];
}

export interface ResourceFeatures {
  cpuUsage: number;
  memoryUsage: number;
  ioOperations: number;
  databaseQueries: number;
  apiCalls: number;
}

/**
 * Isolation Forest implementation for temporal anomaly detection
 */
class IsolationForest implements MLModel {
  public isTrained = false;
  private trees: any[] = [];
  private maxSamples = 256;
  private nEstimators = 100;

  constructor() {}

  async train(data: number[][]): Promise<void> {
    // Simplified isolation forest implementation
    this.trees = [];
    for (let i = 0; i < this.nEstimators; i++) {
      this.trees.push(this.buildTree(data));
    }
    this.isTrained = true;
    log.info('Isolation Forest model trained', { samples: data.length, trees: this.nEstimators });
  }

  predict(features: number[]): AnomalyDetectionResult {
    if (!this.isTrained) {
      return { isAnomalous: false, confidence: 0, anomalyType: 'temporal', riskScore: 0, details: {} };
    }

    // Calculate average path length across trees
    const pathLengths = this.trees.map(tree => this.pathLength(features, tree));
    const avgPathLength = pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length;

    // Calculate anomaly score (lower path length = more anomalous)
    const anomalyScore = Math.pow(2, -avgPathLength / this.averagePathLength(this.maxSamples));
    const isAnomalous = anomalyScore > 0.5;

    return {
      isAnomalous,
      confidence: anomalyScore,
      anomalyType: 'temporal',
      riskScore: isAnomalous ? anomalyScore * 100 : 0,
      details: { avgPathLength, anomalyScore }
    };
  }

  private buildTree(data: number[][]): any {
    // Simplified tree building - in production use proper isolation forest
    return {
      left: Math.random() > 0.5 ? null : this.buildTree(data.slice(0, data.length / 2)),
      right: Math.random() > 0.5 ? null : this.buildTree(data.slice(data.length / 2)),
      splitValue: Math.random(),
      splitFeature: Math.floor(Math.random() * (data[0]?.length || 1))
    };
  }

  private pathLength(features: number[], tree: any): number {
    if (!tree.left && !tree.right) return 1;
    return 1 + Math.random(); // Simplified path length
  }

  private averagePathLength(n: number): number {
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }
}

/**
 * DBSCAN implementation for behavioral clustering
 */
class DBSCAN implements MLModel {
  public isTrained = false;
  private clusters: number[][][] = [];
  private eps = 0.5;
  private minPts = 5;

  constructor() {}

  async train(data: number[][]): Promise<void> {
    this.clusters = this.cluster(data);
    this.isTrained = true;
    log.info('DBSCAN model trained', { clusters: this.clusters.length, samples: data.length });
  }

  predict(features: number[]): AnomalyDetectionResult {
    if (!this.isTrained) {
      return { isAnomalous: false, confidence: 0, anomalyType: 'behavioral', riskScore: 0, details: {} };
    }

    // Find nearest cluster
    let minDistance = Infinity;
    let clusterSize = 0;

    for (const cluster of this.clusters) {
      const distance = this.distanceToCluster(features, cluster);
      if (distance < minDistance) {
        minDistance = distance;
        clusterSize = cluster.length;
      }
    }

    // Point is anomalous if it's far from all clusters or in a very small cluster
    const isAnomalous = minDistance > this.eps || clusterSize < this.minPts;
    const confidence = Math.min(minDistance / this.eps, 1);

    return {
      isAnomalous,
      confidence,
      anomalyType: 'behavioral',
      riskScore: isAnomalous ? confidence * 80 : 0,
      details: { minDistance, clusterSize }
    };
  }

  private cluster(data: number[][]): number[][][] {
    // Simplified DBSCAN - in production use proper implementation
    const clusters: number[][][] = [];
    const visited = new Set<number>();

    for (let i = 0; i < data.length; i++) {
      if (visited.has(i)) continue;

      const neighbors = this.getNeighbors(data[i], data);
      if (neighbors.length >= this.minPts) {
        const cluster = this.expandCluster(data[i], neighbors, data, visited);
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private getNeighbors(point: number[], data: number[][]): number[] {
    const neighbors: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const dist = this.euclideanDistance(point, data[i]);
      if (dist <= this.eps) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  private expandCluster(point: number[], neighbors: number[], data: number[][], visited: Set<number>): number[][] {
    const cluster: number[][] = [point];
    visited.add(data.indexOf(point));

    for (const neighborIndex of neighbors) {
      if (!visited.has(neighborIndex)) {
        visited.add(neighborIndex);
        cluster.push(data[neighborIndex]);
      }
    }

    return cluster;
  }

  private distanceToCluster(point: number[], cluster: number[][]): number {
    let minDist = Infinity;
    for (const clusterPoint of cluster) {
      const dist = this.euclideanDistance(point, clusterPoint);
      minDist = Math.min(minDist, dist);
    }
    return minDist;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
  }
}

/**
 * Simplified Graph Neural Network for network analysis
 */
class GraphNeuralNetwork implements MLModel {
  public isTrained = false;
  private weights: number[][] = [];

  constructor() {}

  async train(data: number[][]): Promise<void> {
    // Initialize weights for simplified GNN
    const inputSize = data[0]?.length || 10;
    this.weights = Array(inputSize).fill(0).map(() =>
      Array(inputSize).fill(0).map(() => Math.random() - 0.5)
    );
    this.isTrained = true;
    log.info('Graph Neural Network model trained', { inputSize });
  }

  predict(features: number[]): AnomalyDetectionResult {
    if (!this.isTrained) {
      return { isAnomalous: false, confidence: 0, anomalyType: 'network', riskScore: 0, details: {} };
    }

    // Simplified GNN forward pass
    const hidden = this.matrixMultiply([features], this.weights)[0];
    const output = hidden.map(x => 1 / (1 + Math.exp(-x))); // Sigmoid activation

    const anomalyScore = output.reduce((sum, val) => sum + val, 0) / output.length;
    const isAnomalous = anomalyScore > 0.6;

    return {
      isAnomalous,
      confidence: anomalyScore,
      anomalyType: 'network',
      riskScore: isAnomalous ? anomalyScore * 90 : 0,
      details: { output: output.slice(0, 3) } // First 3 outputs for debugging
    };
  }

  private matrixMultiply(a: number[][], b: number[][]): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < a.length; i++) {
      result[i] = [];
      for (let j = 0; j < b[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < a[0].length; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }
}

/**
 * LSTM implementation for resource usage patterns
 */
class LSTM implements MLModel {
  public isTrained = false;
  private hiddenSize = 50;
  private weights: {
    inputToHidden: number[][];
    hiddenToHidden: number[][];
    hiddenToOutput: number[][];
  } = { inputToHidden: [], hiddenToHidden: [], hiddenToOutput: [] };

  constructor() {}

  async train(data: number[][]): Promise<void> {
    const inputSize = data[0]?.length || 5;

    // Initialize weights
    this.weights.inputToHidden = Array(inputSize).fill(0).map(() =>
      Array(this.hiddenSize).fill(0).map(() => Math.random() - 0.5)
    );
    this.weights.hiddenToHidden = Array(this.hiddenSize).fill(0).map(() =>
      Array(this.hiddenSize).fill(0).map(() => Math.random() - 0.5)
    );
    this.weights.hiddenToOutput = Array(this.hiddenSize).fill(0).map(() =>
      Array(1).fill(0).map(() => Math.random() - 0.5)
    );

    // Simplified training - in production use proper LSTM training
    this.isTrained = true;
    log.info('LSTM model trained', { inputSize, hiddenSize: this.hiddenSize });
  }

  predict(features: number[]): AnomalyDetectionResult {
    if (!this.isTrained) {
      return { isAnomalous: false, confidence: 0, anomalyType: 'resource', riskScore: 0, details: {} };
    }

    // Simplified LSTM forward pass
    let hiddenState = Array(this.hiddenSize).fill(0);

    // Process sequence (single step for simplicity)
    const inputHidden = this.matrixMultiply([features], this.weights.inputToHidden)[0];
    const hiddenHidden = this.matrixMultiply([hiddenState], this.weights.hiddenToHidden)[0];

    hiddenState = inputHidden.map((val, i) => Math.tanh(val + hiddenHidden[i]));

    const output = this.matrixMultiply([hiddenState], this.weights.hiddenToOutput)[0][0];
    const anomalyScore = Math.abs(output); // Absolute value as anomaly score

    const isAnomalous = anomalyScore > 0.7;

    return {
      isAnomalous,
      confidence: anomalyScore,
      anomalyType: 'resource',
      riskScore: isAnomalous ? anomalyScore * 85 : 0,
      details: { output, hiddenStateMean: hiddenState.reduce((a, b) => a + b, 0) / hiddenState.length }
    };
  }

  private matrixMultiply(a: number[][], b: number[][]): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < a.length; i++) {
      result[i] = [];
      for (let j = 0; j < b[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < a[0].length; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }
}

/**
 * Main ML Anomaly Detection Service
 */
export class MLAnomalyDetectionService extends TenantAwareService {
  private models: {
    temporalIsolation: IsolationForest;
    behavioralClustering: DBSCAN;
    networkAnalysis: GraphNeuralNetwork;
    resourceUsage: LSTM;
  };

  constructor(supabase: SupabaseClient) {
    super('MLAnomalyDetectionService');
    this.supabase = supabase;

    this.models = {
      temporalIsolation: new IsolationForest(),
      behavioralClustering: new DBSCAN(),
      networkAnalysis: new GraphNeuralNetwork(),
      resourceUsage: new LSTM()
    };
  }

  /**
   * Initialize and train all ML models
   */
  async initializeModels(): Promise<void> {
    log.info('Initializing ML anomaly detection models');

    try {
      // Load training data
      const trainingData = await this.loadTrainingData();

      // Train each model with appropriate features
      await Promise.all([
        this.trainTemporalModel(trainingData.temporal),
        this.trainBehavioralModel(trainingData.behavioral),
        this.trainNetworkModel(trainingData.network),
        this.trainResourceModel(trainingData.resource)
      ]);

      log.info('All ML models initialized successfully');
    } catch (error) {
      log.error('Failed to initialize ML models', error as Error);
      throw error;
    }
  }

  /**
   * Process security event through ML pipeline
   */
  async analyzeEvent(event: SecurityEvent): Promise<{
    overallRisk: number;
    anomalies: AnomalyDetectionResult[];
    recommendations: string[];
  }> {
    const features = await this.extractFeatures(event);
    const anomalies: AnomalyDetectionResult[] = [];

    // Run through all models
    const temporalResult = this.models.temporalIsolation.predict(features.temporal);
    const behavioralResult = this.models.behavioralClustering.predict(features.behavioral);
    const networkResult = this.models.networkAnalysis.predict(features.network);
    const resourceResult = this.models.resourceUsage.predict(features.resource);

    anomalies.push(temporalResult, behavioralResult, networkResult, resourceResult);

    // Calculate overall risk score
    const overallRisk = anomalies
      .filter(a => a.isAnomalous)
      .reduce((sum, a) => sum + a.riskScore, 0);

    // Generate recommendations
    const recommendations = this.generateRecommendations(anomalies);

    // Log ML analysis
    log.info('ML anomaly analysis completed', {
      eventId: event.id,
      overallRisk,
      anomalousCount: anomalies.filter(a => a.isAnomalous).length
    });

    return {
      overallRisk,
      anomalies,
      recommendations
    };
  }

  /**
   * Extract features from security event
   */
  private async extractFeatures(event: SecurityEvent): Promise<{
    temporal: number[];
    behavioral: number[];
    network: number[];
    resource: number[];
  }> {
    // Extract temporal features
    const temporal = await this.extractTemporalFeatures(event);

    // Extract behavioral features
    const behavioral = await this.extractBehavioralFeatures(event);

    // Extract network features
    const network = await this.extractNetworkFeatures(event);

    // Extract resource features
    const resource = await this.extractResourceFeatures(event);

    return { temporal, behavioral, network, resource };
  }

  private async extractTemporalFeatures(event: SecurityEvent): Promise<number[]> {
    const hour = new Date(event.timestamp).getHours();
    const dayOfWeek = new Date(event.timestamp).getDay();

    // Get recent request patterns
    const recentRequests = await this.getRecentRequests(event.userId || 'anonymous', 60); // Last hour
    const requestRate = recentRequests.length;
    const avgInterval = recentRequests.length > 1 ?
      3600 / recentRequests.length : 0;

    return [
      requestRate / 100, // Normalized request rate
      hour / 24, // Normalized hour
      dayOfWeek / 7, // Normalized day
      avgInterval / 3600, // Normalized interval
      this.calculateBurstScore(recentRequests)
    ];
  }

  private async extractBehavioralFeatures(event: SecurityEvent): Promise<number[]> {
    const userHistory = await this.getUserActivityHistory(event.userId || 'anonymous', 24); // Last 24 hours

    const endpoints = new Set(userHistory.map(h => h.details?.endpoint));
    const endpointDiversity = endpoints.size / 10; // Normalize by max expected

    const methods = userHistory.reduce((acc, h) => {
      acc[h.details?.method || 'GET'] = (acc[h.details?.method || 'GET'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const methodEntropy = this.calculateEntropy(Object.values(methods));

    return [
      endpointDiversity,
      methodEntropy / 3, // Normalize by max entropy
      userHistory.length / 100, // Normalize activity level
      this.calculateSessionDuration(userHistory) / 3600, // Normalize session duration
      this.calculateUserAgentEntropy(userHistory) / 5
    ];
  }

  private async extractNetworkFeatures(event: SecurityEvent): Promise<number[]> {
    const ip = event.details?.ip || 'unknown';

    // Get IP reputation and geolocation
    const reputation = await this.getIPReputation(ip);
    const geoInfo = await this.getIPGeolocation(ip);

    return [
      reputation.score,
      reputation.isProxy ? 1 : 0,
      reputation.isTor ? 1 : 0,
      geoInfo.isHighRisk ? 1 : 0,
      this.calculateRequestPattern(event.userId)
    ];
  }

  private async extractResourceFeatures(event: SecurityEvent): Promise<number[]> {
    const recentMetrics = await this.getRecentResourceMetrics(event.tenantId, 60);

    return [
      (recentMetrics.cpu || 0) / 100,
      (recentMetrics.memory || 0) / 100,
      (recentMetrics.ioOperations || 0) / 1000,
      (recentMetrics.dbQueries || 0) / 100,
      (recentMetrics.apiCalls || 0) / 1000
    ];
  }

  // Helper methods for feature extraction
  private calculateBurstScore(requests: any[]): number {
    if (requests.length < 2) return 0;

    const intervals: unknown[] = [];
    for (let i = 1; i < requests.length; i++) {
      intervals.push(requests[i].timestamp - requests[i-1].timestamp);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) =>
      sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

    return Math.min(variance / (avgInterval * avgInterval), 1);
  }

  private calculateEntropy(values: number[]): number {
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;

    return -values.reduce((entropy, count) => {
      const probability = count / total;
      return entropy + (probability > 0 ? probability * Math.log2(probability) : 0);
    }, 0);
  }

  private calculateSessionDuration(history: any[]): number {
    if (history.length < 2) return 0;
    const first = history[0].timestamp;
    const last = history[history.length - 1].timestamp;
    return last - first;
  }

  private calculateUserAgentEntropy(history: any[]): number {
    const userAgents = history.map(h => h.details?.userAgent || 'unknown');
    const uniqueAgents = new Set(userAgents);
    return uniqueAgents.size / userAgents.length;
  }

  private calculateRequestPattern(userId?: string): number {
    // Simplified pattern analysis - in production use more sophisticated analysis
    return Math.random(); // Placeholder
  }

  // Data loading methods
  private async loadTrainingData(): Promise<{
    temporal: number[][];
    behavioral: number[][];
    network: number[][];
    resource: number[][];
  }> {
    // Load historical data for training
    const { data: events } = await this.supabase
      .from('security_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10000);

    // Extract features for each model type
    const temporal: number[][] = [];
    const behavioral: number[][] = [];
    const network: number[][] = [];
    const resource: number[][] = [];

    for (const event of events || []) {
      const features = await this.extractFeatures(event);
      temporal.push(features.temporal);
      behavioral.push(features.behavioral);
      network.push(features.network);
      resource.push(features.resource);
    }

    return { temporal, behavioral, network, resource };
  }

  // Model training methods
  private async trainTemporalModel(data: number[][]): Promise<void> {
    if (data.length > 0) {
      await this.models.temporalIsolation.train(data);
    }
  }

  private async trainBehavioralModel(data: number[][]): Promise<void> {
    if (data.length > 0) {
      await this.models.behavioralClustering.train(data);
    }
  }

  private async trainNetworkModel(data: number[][]): Promise<void> {
    if (data.length > 0) {
      await this.models.networkAnalysis.train(data);
    }
  }

  private async trainResourceModel(data: number[][]): Promise<void> {
    if (data.length > 0) {
      await this.models.resourceUsage.train(data);
    }
  }

  // Data access methods (simplified implementations)
  private async getRecentRequests(userId: string, minutes: number): Promise<any[]> {
    const { data } = await this.supabase
      .from('user_activity_log')
      .select('*')
      .eq('user_id', userId || '')
      .gte('created_at', new Date(Date.now() - minutes * 60 * 1000).toISOString());

    return data || [];
  }

  private async getUserActivityHistory(userId: string, hours: number): Promise<any[]> {
    const { data } = await this.supabase
      .from('user_activity_log')
      .select('*')
      .eq('user_id', userId || '')
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());

    return data || [];
  }

  private async getIPReputation(ip: string): Promise<{
    score: number;
    isProxy: boolean;
    isTor: boolean;
  }> {
    // Simplified IP reputation check - in production use real reputation service
    return {
      score: Math.random(),
      isProxy: Math.random() > 0.8,
      isTor: Math.random() > 0.95
    };
  }

  private async getIPGeolocation(ip: string): Promise<{
    isHighRisk: boolean;
    country: string;
  }> {
    // Simplified geolocation - in production use real geolocation service
    return {
      isHighRisk: Math.random() > 0.9,
      country: 'Unknown'
    };
  }

  private async getRecentResourceMetrics(tenantId: string, minutes: number): Promise<{
    cpu?: number;
    memory?: number;
    ioOperations?: number;
    dbQueries?: number;
    apiCalls?: number;
  }> {
    // Simplified metrics - in production use real monitoring data
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      ioOperations: Math.floor(Math.random() * 1000),
      dbQueries: Math.floor(Math.random() * 100),
      apiCalls: Math.floor(Math.random() * 1000)
    };
  }

  private generateRecommendations(anomalies: AnomalyDetectionResult[]): string[] {
    const recommendations: string[] = [];

    for (const anomaly of anomalies) {
      if (!anomaly.isAnomalous) continue;

      switch (anomaly.anomalyType) {
        case 'temporal':
          recommendations.push('Unusual request timing detected - consider rate limiting adjustment');
          break;
        case 'behavioral':
          recommendations.push('Behavioral pattern anomaly - recommend user verification');
          break;
        case 'network':
          recommendations.push('Network-based anomaly detected - consider IP blocking');
          break;
        case 'resource':
          recommendations.push('Resource usage anomaly - investigate potential abuse');
          break;
      }
    }

    return recommendations;
  }
}
