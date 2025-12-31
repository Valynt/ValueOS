import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface WorkflowProgress {
  executionId: string;
  currentStage: string;
  lastAgentAction: string;
  agentName?: string;
  confidence?: number;
  hallucinationCheck?: boolean;
  isLoading: boolean;
  estimatedTimeRemaining?: number;
  progress: number; // 0-100
  status: 'initiated' | 'in_progress' | 'completed' | 'failed';
}

export const useWorkflowProgress = (executionId?: string) => {
  const [progress, setProgress] = useState<WorkflowProgress | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  const updateProgress = useCallback((data: any) => {
    setProgress(prev => ({
      executionId: data.execution_id || executionId || '',
      currentStage: data.current_stage || prev?.currentStage || 'Unknown',
      lastAgentAction: data.last_action || prev?.lastAgentAction || '',
      agentName: data.agent_name || prev?.agentName,
      confidence: data.confidence,
      hallucinationCheck: data.hallucination_check,
      isLoading: data.status === 'in_progress',
      estimatedTimeRemaining: data.eta_ms,
      progress: data.progress || 0,
      status: data.status || 'initiated',
    }));
  }, [executionId]);

  useEffect(() => {
    if (!executionId) return;

    // Subscribe to workflow progress updates
    const progressChannel = supabase
      .channel(`workflow-progress-${executionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions',
          filter: `id=eq.${executionId}`,
        },
        (payload) => {
          updateProgress(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_execution_logs',
          filter: `execution_id=eq.${executionId}`,
        },
        (payload) => {
          // Update with latest log entry
          updateProgress({
            ...payload.new,
            last_action: payload.new.stage_id,
            agent_name: payload.new.agent_id,
          });
        }
      )
      .subscribe();

    setChannel(progressChannel);

    // Initial fetch
    const fetchInitialProgress = async () => {
      const { data } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('id', executionId)
        .single();

      if (data) {
        updateProgress(data);
      }
    };

    fetchInitialProgress();

    return () => {
      progressChannel.unsubscribe();
    };
  }, [executionId, updateProgress]);

  const sendProgressUpdate = useCallback(async (update: Partial<WorkflowProgress>) => {
    if (!executionId) return;

    await supabase
      .from('workflow_executions')
      .update({
        current_stage: update.currentStage,
        context: {
          last_action: update.lastAgentAction,
          agent_name: update.agentName,
          confidence: update.confidence,
          hallucination_check: update.hallucinationCheck,
          eta_ms: update.estimatedTimeRemaining,
          progress: update.progress,
        },
      })
      .eq('id', executionId);
  }, [executionId]);

  return {
    progress,
    updateProgress: sendProgressUpdate,
    isConnected: !!channel,
  };
};
