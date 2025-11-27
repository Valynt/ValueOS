/**
 * Enhanced Workflow Container
 * 
 * Fully integrated workflow orchestrator that connects UI to backend agents
 * Provides agent invocation, session management, and circuit breaker monitoring
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { getAgentAPI } from '../../services/AgentAPI';
import { AgentQueryService } from '../../services/AgentQueryService';
import { WorkflowProgress } from './WorkflowProgress';
import { WorkflowNavigation } from './WorkflowNavigation';
import { WorkflowValidation } from './WorkflowValidation';
import { AgentStatusIndicator } from './AgentStatusIndicator';
import { BusinessMetricsPanel } from './BusinessMetricsPanel';
import { StageContent } from './StageContent';
import { 
  AlertCircle, Save, Clock, Users
} from 'lucide-react';
import type { AgentType, AgentContext } from '../../services/agent-types';
import type { 
  WorkflowStage, 
  BusinessWorkflowState, 
  AgentHealthStatus 
} from './types';
import { BUSINESS_WORKFLOW_STAGES } from './config';

interface EnhancedWorkflowContainerProps {
  workflowId: string;
  userId: string;
  organizationId?: string;
  initialStage?: WorkflowStage;
  onComplete?: (state: BusinessWorkflowState) => void;
  onExit?: () => void;
  autoSaveInterval?: number;
}

export const EnhancedWorkflowContainer: React.FC<EnhancedWorkflowContainerProps> = ({
  workflowId,
  userId,
  organizationId,
  initialStage = 'opportunity',
  onComplete,
  onExit,
  autoSaveInterval = 30000
}) => {
  // Services
  const agentAPI = getAgentAPI();
  const agentQueryService = new AgentQueryService(supabase);

  // State
  const [workflowState, setWorkflowState] = useState<BusinessWorkflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agentHealth, setAgentHealth] = useState<Record<AgentType, AgentHealthStatus>>({} as any);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [agentProcessing, setAgentProcessing] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  
  // Refs for cleanup
  const healthMonitorTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isComponentMounted = React.useRef(true);

  // Initialize workflow
  useEffect(() => {
    isComponentMounted.current = true;
    initializeWorkflow();
    monitorAgentHealth();
    
    // Cleanup on unmount
    return () => {
      isComponentMounted.current = false;
      if (healthMonitorTimeoutRef.current) {
        clearTimeout(healthMonitorTimeoutRef.current);
        healthMonitorTimeoutRef.current = null;
      }
    };
  }, [workflowId]);

  const initializeWorkflow = async () => {
    try {
      setLoading(true);
      
      // Try to restore existing session
      const existingSession = await agentQueryService.getSession(workflowId);
      
      if (existingSession) {
        logger.info('Restored existing workflow session', { workflowId });
        
        const restoredState: BusinessWorkflowState = {
          id: workflowId,
          sessionId: existingSession.id,
          currentStage: existingSession.workflow_state.currentStage as WorkflowStage,
          completedStages: existingSession.workflow_state.completedStages as WorkflowStage[],
          stageData: existingSession.workflow_state.context.stageData || {},
          validationStatus: existingSession.workflow_state.context.validationStatus || {},
          agentResponses: existingSession.workflow_state.context.agentResponses || {},
          businessContext: existingSession.workflow_state.context.businessContext,
          valueDrivers: existingSession.workflow_state.context.valueDrivers,
          financialMetrics: existingSession.workflow_state.context.financialMetrics,
          stakeholders: existingSession.workflow_state.context.stakeholders,
          risks: existingSession.workflow_state.context.risks,
          implementation: existingSession.workflow_state.context.implementation,
          lastSaved: Date.now(),
          createdAt: new Date(existingSession.created_at).getTime(),
          updatedAt: new Date(existingSession.updated_at).getTime(),
          userId,
          organizationId
        };
        
        setWorkflowState(restoredState);
      } else {
        // Create new workflow session
        logger.info('Creating new workflow session', { workflowId });
        
        const newState: BusinessWorkflowState = {
          id: workflowId,
          sessionId: '',
          currentStage: initialStage,
          completedStages: [],
          stageData: {},
          validationStatus: {},
          agentResponses: {},
          lastSaved: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          userId,
          organizationId
        };
        
        // Create session in backend
        const queryResult = await agentQueryService.handleQuery(
          'Initialize business value model workflow',
          userId,
          undefined,
          {
            initialStage,
            initialContext: {
              workflowId,
              organizationId,
              type: 'business-value-model'
            }
          }
        );
        
        newState.sessionId = queryResult.sessionId;
        setWorkflowState(newState);
      }
    } catch (error) {
      logger.error('Failed to initialize workflow', error as Error);
      setValidationErrors(['Failed to initialize workflow. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  const monitorAgentHealth = async () => {
    // Don't continue if component is unmounted
    if (!isComponentMounted.current) return;
    
    const agents = BUSINESS_WORKFLOW_STAGES.map(s => s.agentType);
    const healthStatus: Record<AgentType, AgentHealthStatus> = {} as any;
    
    for (const agent of agents) {
      const circuitBreakerStatus = agentAPI.getCircuitBreakerStatus(agent);
      
      healthStatus[agent] = {
        agent,
        available: circuitBreakerStatus?.state !== 'open',
        circuitBreaker: circuitBreakerStatus || {
          state: 'closed',
          failureCount: 0,
          lastFailureTime: null
        }
      };
    }
    
    // Only update state if component is still mounted
    if (isComponentMounted.current) {
      setAgentHealth(healthStatus);
      
      // Schedule next check and store the timeout ID
      healthMonitorTimeoutRef.current = setTimeout(() => {
        monitorAgentHealth();
      }, 30000);
    }
  };

  const validateStage = (stage: WorkflowStage): boolean | string[] => {
    if (!workflowState) return false;
    
    const stageConfig = BUSINESS_WORKFLOW_STAGES.find(s => s.id === stage);
    if (!stageConfig) return false;
    
    const stageData = workflowState.stageData[stage];
    const errors: string[] = [];
    
    if (stageConfig.validationRules) {
      for (const rule of stageConfig.validationRules) {
        const result = rule(stageData);
        if (result !== true) {
          errors.push(typeof result === 'string' ? result : 'Validation failed');
        }
      }
    }
    
    return errors.length === 0 ? true : errors;
  };

  const handleStageChange = async (newStage: WorkflowStage) => {
    if (!workflowState) return;
    
    const currentIndex = BUSINESS_WORKFLOW_STAGES.findIndex(s => s.id === workflowState.currentStage);
    const newIndex = BUSINESS_WORKFLOW_STAGES.findIndex(s => s.id === newStage);
    
    if (newIndex > currentIndex) {
      const validation = validateStage(workflowState.currentStage);
      if (validation !== true) {
        setValidationErrors(validation as string[]);
        return;
      }
    }
    
    const stageConfig = BUSINESS_WORKFLOW_STAGES.find(s => s.id === newStage);
    if (stageConfig) {
      const agentStatus = agentHealth[stageConfig.agentType];
      if (agentStatus && !agentStatus.available) {
        setValidationErrors([
          `${stageConfig.label} service is temporarily unavailable. Please try again later.`
        ]);
        return;
      }
    }
    
    const completedStages = [...workflowState.completedStages];
    if (!completedStages.includes(workflowState.currentStage) && newIndex > currentIndex) {
      completedStages.push(workflowState.currentStage);
    }
    
    const updatedState = {
      ...workflowState,
      currentStage: newStage,
      completedStages,
      updatedAt: Date.now()
    };
    
    setWorkflowState(updatedState);
    setValidationErrors([]);
    await saveWorkflow(updatedState);
    
    if (!updatedState.stageData[newStage] && stageConfig) {
      await invokeStageAgent(newStage, {});
    }
  };

  const invokeStageAgent = async (stage: WorkflowStage, input: any) => {
    if (!workflowState) return;
    
    const stageConfig = BUSINESS_WORKFLOW_STAGES.find(s => s.id === stage);
    if (!stageConfig) return;
    
    setAgentProcessing(true);
    
    try {
      const context: AgentContext = {
        userId,
        organizationId,
        sessionId: workflowState.sessionId,
        metadata: {
          stage,
          workflowId,
          businessContext: workflowState.businessContext,
          valueDrivers: workflowState.valueDrivers,
          financialMetrics: workflowState.financialMetrics,
          previousStages: workflowState.completedStages,
          stageData: workflowState.stageData
        }
      };
      
      let response;
      switch (stage) {
        case 'opportunity':
          response = await agentAPI.generateValueCase(JSON.stringify(input), context);
          break;
        case 'target':
          response = await agentAPI.generateROIModel(
            JSON.stringify(input),
            workflowState.stageData.opportunity || {},
            context
          );
          break;
        case 'expansion':
          response = await agentAPI.generateExpansionOpportunities(JSON.stringify(input), context);
          break;
        case 'integrity':
          response = await agentAPI.validateIntegrity(workflowState, context);
          break;
        case 'realization':
          response = await agentAPI.generateRealizationDashboard(JSON.stringify(input), context);
          break;
      }
      
      if (response?.success && response.data) {
        const updatedState = {
          ...workflowState,
          stageData: {
            ...workflowState.stageData,
            [stage]: response.data
          },
          agentResponses: {
            ...workflowState.agentResponses,
            [stage]: response
          },
          validationStatus: {
            ...workflowState.validationStatus,
            [stage]: true
          },
          updatedAt: Date.now()
        };
        
        if (stage === 'opportunity' && response.data.businessContext) {
          updatedState.businessContext = response.data.businessContext;
        }
        if (stage === 'target' && response.data.financialMetrics) {
          updatedState.financialMetrics = response.data.financialMetrics;
          updatedState.valueDrivers = response.data.valueDrivers;
        }
        
        setWorkflowState(updatedState);
        await saveWorkflow(updatedState);
        
        logger.info('Agent invocation successful', {
          stage,
          agent: stageConfig.agentType,
          confidence: response.confidence
        });
      } else {
        throw new Error(response?.error || 'Agent failed to process request');
      }
    } catch (error) {
      logger.error('Agent invocation failed', error as Error);
      setValidationErrors([`Failed to process ${stageConfig.label}. Please try again.`]);
    } finally {
      setAgentProcessing(false);
    }
  };

  const saveWorkflow = useCallback(async (state: BusinessWorkflowState) => {
    if (saving) return;
    
    setSaving(true);
    
    try {
      await supabase
        .from('workflow_sessions')
        .update({
          workflow_state: {
            currentStage: state.currentStage,
            completedStages: state.completedStages,
            status: state.completedStages.length === BUSINESS_WORKFLOW_STAGES.length 
              ? 'completed' 
              : 'active',
            context: {
              stageData: state.stageData,
              validationStatus: state.validationStatus,
              agentResponses: state.agentResponses,
              businessContext: state.businessContext,
              valueDrivers: state.valueDrivers,
              financialMetrics: state.financialMetrics,
              stakeholders: state.stakeholders,
              risks: state.risks,
              implementation: state.implementation
            }
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', state.sessionId);
      
      setWorkflowState({ ...state, lastSaved: Date.now() });
      logger.info('Workflow saved successfully', { workflowId: state.id });
    } catch (error) {
      logger.error('Failed to save workflow', error as Error);
      setValidationErrors(['Failed to save workflow. Your changes may be lost.']);
    } finally {
      setSaving(false);
    }
  }, [saving]);

  // Auto-save
  useEffect(() => {
    if (!workflowState || !autoSaveInterval) return;
    
    const interval = setInterval(() => {
      saveWorkflow(workflowState);
    }, autoSaveInterval);
    
    return () => clearInterval(interval);
  }, [workflowState, autoSaveInterval, saveWorkflow]);

  const handleNext = () => {
    if (!workflowState) return;
    
    const currentIndex = BUSINESS_WORKFLOW_STAGES.findIndex(s => s.id === workflowState.currentStage);
    
    if (currentIndex < BUSINESS_WORKFLOW_STAGES.length - 1) {
      handleStageChange(BUSINESS_WORKFLOW_STAGES[currentIndex + 1].id);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (!workflowState) return;
    
    const currentIndex = BUSINESS_WORKFLOW_STAGES.findIndex(s => s.id === workflowState.currentStage);
    
    if (currentIndex > 0) {
      handleStageChange(BUSINESS_WORKFLOW_STAGES[currentIndex - 1].id);
    }
  };

  const handleComplete = async () => {
    if (!workflowState) return;
    
    const requiredStages = BUSINESS_WORKFLOW_STAGES.filter(s => s.required);
    const allValid = requiredStages.every(stage => validateStage(stage.id) === true);
    
    if (!allValid) {
      setValidationErrors(['Please complete all required stages before finishing']);
      return;
    }
    
    const completedState = {
      ...workflowState,
      completedStages: BUSINESS_WORKFLOW_STAGES.map(s => s.id),
      updatedAt: Date.now()
    };
    
    await saveWorkflow(completedState);
    await agentQueryService.abandonSession(workflowState.sessionId);
    
    if (onComplete) {
      onComplete(completedState);
    }
  };

  const updateStageData = (data: any) => {
    if (!workflowState) return;
    
    setWorkflowState({
      ...workflowState,
      stageData: {
        ...workflowState.stageData,
        [workflowState.currentStage]: data
      },
      updatedAt: Date.now()
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (!workflowState) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium mb-2">Failed to load workflow</p>
          <button
            onClick={initializeWorkflow}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentStageIndex = BUSINESS_WORKFLOW_STAGES.findIndex(s => s.id === workflowState.currentStage);
  const currentStage = BUSINESS_WORKFLOW_STAGES[currentStageIndex];
  const isFirstStage = currentStageIndex === 0;
  const isLastStage = currentStageIndex === BUSINESS_WORKFLOW_STAGES.length - 1;
  const canProceed = validateStage(workflowState.currentStage) === true;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Business Value Model Builder</h1>
              <p className="text-sm text-gray-600 mt-1">{currentStage?.description}</p>
            </div>

            <div className="flex items-center space-x-4 mr-4">
              <AgentStatusIndicator
                agent={currentStage?.agentType}
                status={agentHealth[currentStage?.agentType]}
              />
            </div>

            <div className="flex items-center space-x-4">
              {saving && (
                <div className="flex items-center space-x-2 text-gray-600">
                  <Clock className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Saving...</span>
                </div>
              )}
              {!saving && workflowState.lastSaved && (
                <div className="flex items-center space-x-2 text-green-600">
                  <Save className="h-4 w-4" />
                  <span className="text-sm">
                    Saved {new Date(workflowState.lastSaved).toLocaleTimeString()}
                  </span>
                </div>
              )}
              
              <button
                onClick={() => saveWorkflow(workflowState)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Save
              </button>
              
              <button
                onClick={() => setShowMetrics(!showMetrics)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Users className="h-4 w-4 inline mr-2" />
                Metrics
              </button>
            </div>
          </div>

          <div className="mt-4">
            <WorkflowProgress
              stages={BUSINESS_WORKFLOW_STAGES}
              currentStage={workflowState.currentStage}
              completedStages={workflowState.completedStages}
              onStageClick={handleStageChange}
            />
          </div>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <WorkflowValidation errors={validationErrors} />
        </div>
      )}

      {showMetrics && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <BusinessMetricsPanel
            businessContext={workflowState.businessContext}
            valueDrivers={workflowState.valueDrivers}
            financialMetrics={workflowState.financialMetrics}
            stakeholders={workflowState.stakeholders}
            risks={workflowState.risks}
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {agentProcessing && (
            <div className="p-6 border-b border-gray-200 bg-blue-50">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-blue-700">
                  {currentStage?.agentType} agent is processing your request...
                </span>
              </div>
            </div>
          )}

          <div className="p-6">
            <StageContent
              stage={workflowState.currentStage}
              data={workflowState.stageData[workflowState.currentStage]}
              onUpdate={updateStageData}
              onInvokeAgent={() => invokeStageAgent(
                workflowState.currentStage, 
                workflowState.stageData[workflowState.currentStage]
              )}
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <WorkflowNavigation
            onPrevious={handlePrevious}
            onNext={handleNext}
            onComplete={handleComplete}
            canProceed={canProceed && !agentProcessing}
            isFirstStage={isFirstStage}
            isLastStage={isLastStage}
            currentStage={currentStage?.label}
            nextStage={!isLastStage ? BUSINESS_WORKFLOW_STAGES[currentStageIndex + 1]?.label : undefined}
          />
        </div>
      </div>
    </div>
  );
};
