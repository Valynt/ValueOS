/**
 * Agent Service
 *
 * Client-side service for invoking backend agents.
 * Maps to /api/agents endpoints.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export type AgentId =
  | 'research-company'
  | 'crm-import'
  | 'call-analyzer'
  | 'value-modeler'
  | 'roi-calculator'
  | 'coordinator';

export interface AgentInvokeRequest {
  query: string;
  context?: string;
  parameters?: Record<string, unknown>;
  sessionId?: string;
}

export interface AgentInvokeResponse {
  success: boolean;
  data?: {
    jobId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    agentId: string;
    estimatedDuration?: string;
    message?: string;
  };
  error?: string;
}

export interface AgentJobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  agentId?: string;
  result?: unknown;
  error?: string;
  latency?: number;
  queuedAt?: string;
  completedAt?: string;
}

/**
 * Invoke an agent asynchronously
 */
export async function invokeAgent(
  agentId: AgentId,
  request: AgentInvokeRequest
): Promise<AgentInvokeResponse> {
  try {
    const response = await fetch(`${API_BASE}/agents/${agentId}/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || 'Agent invocation failed',
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get agent job status
 */
export async function getJobStatus(jobId: string): Promise<AgentJobStatus | null> {
  try {
    const response = await fetch(`${API_BASE}/agents/jobs/${jobId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch {
    return null;
  }
}

/**
 * Poll for job completion
 */
export async function waitForJob(
  jobId: string,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    onProgress?: (status: AgentJobStatus) => void;
  } = {}
): Promise<AgentJobStatus | null> {
  const { maxAttempts = 60, intervalMs = 1000, onProgress } = options;

  for (let i = 0; i < maxAttempts; i++) {
    const status = await getJobStatus(jobId);

    if (!status) {
      return null;
    }

    onProgress?.(status);

    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}

/**
 * Research a company by name or domain
 */
export async function researchCompany(
  companyIdentifier: string,
  sessionId?: string
): Promise<AgentInvokeResponse> {
  return invokeAgent('research-company', {
    query: `Research company: ${companyIdentifier}`,
    parameters: {
      companyIdentifier,
      includeFinancials: true,
      includeIndustryBenchmarks: true,
    },
    sessionId,
  });
}

/**
 * Import opportunity from CRM
 */
export async function importFromCRM(
  opportunityId: string,
  crmType: 'salesforce' | 'hubspot',
  sessionId?: string
): Promise<AgentInvokeResponse> {
  return invokeAgent('crm-import', {
    query: `Import opportunity ${opportunityId} from ${crmType}`,
    parameters: {
      opportunityId,
      crmType,
    },
    sessionId,
  });
}

/**
 * Analyze a sales call transcript
 */
export async function analyzeCall(
  transcriptOrUrl: string,
  sessionId?: string
): Promise<AgentInvokeResponse> {
  return invokeAgent('call-analyzer', {
    query: 'Analyze sales call for value drivers and objections',
    parameters: {
      transcript: transcriptOrUrl,
    },
    sessionId,
  });
}
