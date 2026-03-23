/**
 * API client for communicating with the FastAPI backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface AnalyzeRequest {
  url: string;
  competitor_urls?: string[];
  industry_hints?: string[];
}

export interface AnalyzeResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface ProgressUpdate {
  status: string;
  progress: number;
  message: string;
  entities_found?: number;
  relationships_found?: number;
  current_source?: string;
}

export interface Entity {
  id: string;
  type: string;
  name: string;
  description?: string;
  properties: Record<string, any>;
  confidence: number;
  sources: string[];
}

export interface Relationship {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  confidence: number;
  evidence?: string;
}

export interface Insight {
  id: string;
  type: 'gap' | 'opportunity' | 'risk' | 'competitive' | 'trend';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation?: string;
  confidence: number;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relationships: Relationship[];
}

export interface AnalysisResult {
  job_id: string;
  url: string;
  completed_at: string;
  processing_time_seconds: number;
  graph: KnowledgeGraph;
  insights: Insight[];
  sources_crawled: number;
  warnings: string[];
}

/**
 * Start a new ontology analysis.
 */
export async function startAnalysis(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get analysis results.
 */
export async function getResults(jobId: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE}/api/results/${jobId}`);

  if (!response.ok) {
    throw new Error(`Failed to get results: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a WebSocket connection for real-time progress updates.
 */
export function createProgressWebSocket(
  jobId: string,
  onProgress: (update: ProgressUpdate) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): WebSocket {
  const wsUrl = API_BASE.replace('http', 'ws');
  const ws = new WebSocket(`${wsUrl}/api/ws/${jobId}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'heartbeat') {
      return;
    }

    onProgress(data);

    if (data.status === 'completed' || data.status === 'failed') {
      onComplete();
      ws.close();
    }
  };

  ws.onerror = (event) => {
    onError(new Error('WebSocket error'));
  };

  return ws;
}
