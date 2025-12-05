/**
 * Workflow Types
 * 
 * Type definitions for the enhanced workflow container
 */

import type { AgentType } from '../../services/agent-types';

export type WorkflowStage = 'opportunity' | 'target' | 'expansion' | 'integrity' | 'realization';

export interface WorkflowStageConfig {
  id: WorkflowStage;
  label: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
  estimatedMinutes: number;
  agentType: AgentType;
  capabilities: string[];
  validationRules?: Array<(data: any) => boolean | string>;
}

export interface AgentHealthStatus {
  agent: AgentType;
  available: boolean;
  circuitBreaker: {
    state: 'open' | 'closed' | 'half-open';
    failureCount: number;
    lastFailureTime: string | null;
  };
  lastError?: string;
  responseTime?: number;
}

export interface BusinessWorkflowState {
  id: string;
  sessionId: string;
  currentStage: WorkflowStage;
  completedStages: WorkflowStage[];
  stageData: Record<WorkflowStage, any>;
  validationStatus: Record<WorkflowStage, boolean>;
  agentResponses: Record<WorkflowStage, any>;
  
  // Business-specific fields
  businessContext?: {
    industry: string;
    companySize: 'startup' | 'smb' | 'mid-market' | 'enterprise';
    annualRevenue?: number;
    employeeCount?: number;
    markets?: string[];
  };
  
  valueDrivers?: {
    revenue: Record<string, number>;
    cost: Record<string, number>;
    efficiency: Record<string, number>;
    customer: Record<string, number>;
  };
  
  financialMetrics?: {
    currentState: {
      revenue: number;
      costs: number;
      margin: number;
      cashFlow: number;
    };
    projectedState: {
      revenue: number;
      costs: number;
      margin: number;
      cashFlow: number;
    };
    roi: number;
    paybackPeriod: number;
    npv: number;
    irr: number;
  };
  
  stakeholders?: Array<{
    id: string;
    name: string;
    role: string;
    department: string;
    influence: 'high' | 'medium' | 'low';
    supportLevel: number; // 0-100
    concerns: string[];
    benefits: string[];
  }>;
  
  risks?: Array<{
    id: string;
    category: 'technical' | 'financial' | 'operational' | 'market' | 'regulatory';
    description: string;
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;
  
  implementation?: {
    phases: Array<{
      name: string;
      duration: number;
      resources: string[];
      deliverables: string[];
      dependencies: string[];
    }>;
    timeline: string;
    budget: number;
    team: string[];
  };
  
  // Metadata
  lastSaved: number;
  createdAt: number;
  updatedAt: number;
  userId: string;
  organizationId?: string;
}

export interface WorkflowProgressProps {
  stages: WorkflowStageConfig[];
  currentStage: WorkflowStage;
  completedStages: WorkflowStage[];
  onStageClick: (stage: WorkflowStage) => void;
}

export interface WorkflowNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
  onComplete: () => void;
  canProceed: boolean;
  isFirstStage: boolean;
  isLastStage: boolean;
  currentStage?: string;
  nextStage?: string;
}

export interface WorkflowValidationProps {
  errors: string[];
  warnings?: string[];
}
