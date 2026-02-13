export interface Repository {
  owner: string;
  name: string;
  fullName: string;
  id: number;
  private: boolean;
  defaultBranch: string;
  url: string;
}

export interface GitHubEvent {
  action: string;
  repository: Repository;
  sender: {
    login: string;
    id: number;
    type: string;
  };
  installation?: {
    id: number;
  };
}

export interface CodeAnalysis {
  file: string;
  line: number;
  column?: number;
  severity: 'info' | 'warning' | 'error';
  message: string;
  rule?: string;
  suggestion?: string;
}

export interface Optimization {
  id: string;
  file: string;
  type: 'performance' | 'complexity' | 'readability' | 'security' | 'maintainability';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  estimatedGain: number; // percentage improvement
  originalCode: string;
  suggestedCode: string;
  lineStart: number;
  lineEnd: number;
  status?: 'approved' | 'rejected' | 'pending';
  aiAnalysis?: string;
  benchmarkResults?: BenchmarkResult;
  testCases?: TestCase[];
}

export interface BenchmarkResult {
  original: {
    executionTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  optimized: {
    executionTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  improvement: {
    executionTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface TestCase {
  input: unknown;
  expectedOutput: unknown;
  description: string;
}

export interface PullRequestData {
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
}

export interface BotConfig {
  enabled: boolean;
  thresholds: {
    performanceGain: number;
    maxFiles: number;
    maxFileSize: number;
  };
  languages: string[];
  blacklist: string[];
  ai: {
    model: string;
    maxTokens: number;
  };
}

export interface AnalysisJob {
  id: string;
  repository: Repository;
  commitSha: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  optimizations: Optimization[];
  error?: string;
}
