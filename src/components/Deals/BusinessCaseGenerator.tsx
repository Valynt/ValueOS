/**
 * Business Case Generator
 * 
 * Orchestrates multi-agent workflow to generate buyer-facing business cases.
 * Shows real-time agent progress with streaming updates.
 * 
 * PERFORMANCE: Implements streaming UI pattern for sub-800ms feedback
 * EXPLAINABILITY: Shows which agent is running and current reasoning step
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getUnifiedAgentAPI } from '@/services/UnifiedAgentAPI';
import { logger } from '@/lib/logger';
import { AlertCircle, Brain, CheckCircle2, DollarSign, Loader2, Sparkles, Target, TrendingUp } from 'lucide-react';
import type { ValueCase } from '@/services/ValueCaseService';

interface BusinessCaseGeneratorProps {
  valueCase: ValueCase;
  onComplete: (businessCase: any) => void;
  onError: (error: string) => void;
}

interface AgentProgress {
  agent: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  progress: number;
  currentStep?: string;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

const agentSteps = [
  {
    key: 'opportunity',
    name: 'Opportunity Analysis',
    description: 'Analyzing pain points and business objectives',
    icon: Brain,
    color: 'text-blue-600'
  },
  {
    key: 'target',
    name: 'Value Modeling',
    description: 'Building ROI model and value drivers',
    icon: Target,
    color: 'text-purple-600'
  },
  {
    key: 'financial',
    name: 'Financial Calculation',
    description: 'Computing NPV, IRR, and payback period',
    icon: DollarSign,
    color: 'text-green-600'
  },
  {
    key: 'narrative',
    name: 'Executive Summary',
    description: 'Generating buyer-facing narrative',
    icon: TrendingUp,
    color: 'text-orange-600'
  }
];

export function BusinessCaseGenerator({ valueCase, onComplete, onError }: BusinessCaseGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [agentProgress, setAgentProgress] = useState<Record<string, AgentProgress>>({});
  const [overallProgress, setOverallProgress] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);

  const updateAgentProgress = (agentKey: string, update: Partial<AgentProgress>) => {
    setAgentProgress(prev => ({
      ...prev,
      [agentKey]: { ...prev[agentKey], ...update } as AgentProgress
    }));
  };

  const calculateOverallProgress = (progress: Record<string, AgentProgress>) => {
    const total = Object.values(progress).reduce((sum, p) => sum + (p.progress || 0), 0);
    return total / agentSteps.length;
  };

  const estimateTimeRemaining = (progress: Record<string, AgentProgress>) => {
    const completedSteps = Object.values(progress).filter(p => p.status === 'complete');
    if (completedSteps.length === 0) return null;

    const avgTime = completedSteps.reduce((sum, p) => {
      if (p.startTime && p.endTime) {
        return sum + (p.endTime - p.startTime);
      }
      return sum;
    }, 0) / completedSteps.length;

    const remainingSteps = agentSteps.length - completedSteps.length;
    return Math.round((avgTime * remainingSteps) / 1000); // Convert to seconds
  };

  const generateBusinessCase = async () => {
    setGenerating(true);
    setAgentProgress({});
    setOverallProgress(0);
    setEstimatedTimeRemaining(null);

    const startTime = Date.now();

    try {
      const api = getUnifiedAgentAPI();

      // Initialize all agent progress
      agentSteps.forEach(step => {
        updateAgentProgress(step.key, {
          agent: step.name,
          status: 'pending',
          progress: 0
        });
      });

      // Step 1: Opportunity Analysis
      updateAgentProgress('opportunity', {
        status: 'running',
        progress: 10,
        currentStep: 'Analyzing discovery data...',
        startTime: Date.now()
      });

      const opportunityResult = await api.invoke({
        agent: 'opportunity',
        query: `Analyze opportunity for ${valueCase.company}`,
        context: {
          valueCaseId: valueCase.id,
          company: valueCase.company,
          description: valueCase.description
        }
      });

      updateAgentProgress('opportunity', {
        status: 'complete',
        progress: 100,
        result: opportunityResult,
        endTime: Date.now()
      });

      const currentProgress = calculateOverallProgress(agentProgress);
      setOverallProgress(currentProgress);
      setEstimatedTimeRemaining(estimateTimeRemaining(agentProgress));

      // Step 2: Value Modeling
      updateAgentProgress('target', {
        status: 'running',
        progress: 10,
        currentStep: 'Building value tree...',
        startTime: Date.now()
      });

      const targetResult = await api.invoke({
        agent: 'target',
        query: `Build value model for ${valueCase.company}`,
        context: {
          valueCaseId: valueCase.id,
          opportunityAnalysis: opportunityResult
        }
      });

      updateAgentProgress('target', {
        status: 'complete',
        progress: 100,
        result: targetResult,
        endTime: Date.now()
      });

      setOverallProgress(calculateOverallProgress(agentProgress));
      setEstimatedTimeRemaining(estimateTimeRemaining(agentProgress));

      // Step 3: Financial Calculation
      updateAgentProgress('financial', {
        status: 'running',
        progress: 10,
        currentStep: 'Calculating ROI metrics...',
        startTime: Date.now()
      });

      const financialResult = await api.invoke({
        agent: 'financial-modeling',
        query: `Calculate financial metrics for ${valueCase.company}`,
        context: {
          valueCaseId: valueCase.id,
          valueModel: targetResult
        }
      });

      updateAgentProgress('financial', {
        status: 'complete',
        progress: 100,
        result: financialResult,
        endTime: Date.now()
      });

      setOverallProgress(calculateOverallProgress(agentProgress));
      setEstimatedTimeRemaining(estimateTimeRemaining(agentProgress));

      // Step 4: Narrative Generation
      updateAgentProgress('narrative', {
        status: 'running',
        progress: 10,
        currentStep: 'Generating executive summary...',
        startTime: Date.now()
      });

      const narrativeResult = await api.invoke({
        agent: 'communicator',
        query: `Generate executive summary for ${valueCase.company}`,
        context: {
          valueCaseId: valueCase.id,
          opportunityAnalysis: opportunityResult,
          valueModel: targetResult,
          financialMetrics: financialResult
        }
      });

      updateAgentProgress('narrative', {
        status: 'complete',
        progress: 100,
        result: narrativeResult,
        endTime: Date.now()
      });

      setOverallProgress(100);
      setEstimatedTimeRemaining(0);

      // Compile complete business case
      const businessCase = {
        valueCaseId: valueCase.id,
        company: valueCase.company,
        generatedAt: new Date().toISOString(),
        generationTime: Date.now() - startTime,
        opportunity: opportunityResult,
        valueModel: targetResult,
        financial: financialResult,
        narrative: narrativeResult
      };

      logger.info('Business case generated successfully', {
        valueCaseId: valueCase.id,
        generationTime: businessCase.generationTime
      });

      onComplete(businessCase);
    } catch (error) {
      logger.error('Business case generation failed', error as Error);
      
      // Mark current running agent as error
      const runningAgent = Object.entries(agentProgress).find(([_, p]) => p.status === 'running');
      if (runningAgent) {
        updateAgentProgress(runningAgent[0], {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      onError(error instanceof Error ? error.message : 'Failed to generate business case');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Draft Business Case
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              AI agents will analyze your opportunity and build a buyer-facing business case
            </p>
          </div>
          <Button
            onClick={generateBusinessCase}
            disabled={generating}
            aria-label={generating ? "Drafting business case" : "Draft business case"}
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {generating ? "Drafting..." : "Draft Business Case"}
          </Button>
        </div>

        {/* Overall Progress */}
        {generating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">
                {Math.round(overallProgress)}%
                {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
                  <span className="ml-2">• ~{estimatedTimeRemaining}s remaining</span>
                )}
              </span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
        )}

        {/* Agent Steps */}
        <div className="space-y-3">
          {agentSteps.map((step) => {
            const progress = agentProgress[step.key];
            const Icon = step.icon;

            if (!progress) return null;

            return (
              <div
                key={step.key}
                className={`p-4 rounded-lg border-2 transition-all ${
                  progress.status === 'running'
                    ? 'border-primary bg-primary/5'
                    : progress.status === 'complete'
                    ? 'border-green-200 bg-green-50'
                    : progress.status === 'error'
                    ? 'border-red-200 bg-red-50'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    progress.status === 'complete'
                      ? 'bg-green-100'
                      : progress.status === 'error'
                      ? 'bg-red-100'
                      : 'bg-primary/10'
                  }`}>
                    {progress.status === 'complete' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : progress.status === 'error' ? (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    ) : progress.status === 'running' ? (
                      <Loader2 className={`w-5 h-5 ${step.color} animate-spin`} />
                    ) : (
                      <Icon className={`w-5 h-5 ${step.color}`} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{step.name}</h4>
                      {progress.status === 'running' && (
                        <Badge variant="secondary" className="text-xs">
                          Running
                        </Badge>
                      )}
                      {progress.status === 'complete' && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                          Complete
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {progress.currentStep || step.description}
                    </p>
                    {progress.status === 'error' && progress.error && (
                      <p className="text-sm text-red-600 mt-1">{progress.error}</p>
                    )}
                    {progress.status === 'running' && progress.progress > 0 && (
                      <Progress value={progress.progress} className="h-1 mt-2" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
