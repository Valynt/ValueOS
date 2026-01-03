/**
 * Agent Prefetch Hook
 * 
 * React hook for using agent prefetch service in components.
 * Automatically prefetches next stage when user is idle.
 */

import { useEffect, useState } from 'react';
import { agentPrefetchService, WorkflowStage } from '../services/AgentPrefetchService';
import { logger } from '../lib/logger';

interface UseAgentPrefetchOptions {
  currentStage: WorkflowStage;
  context: any;
  enabled?: boolean;
}

export function useAgentPrefetch({
  currentStage,
  context,
  enabled = true,
}: UseAgentPrefetchOptions) {
  const [prefetching, setPrefetching] = useState(false);
  const [prefetched, setPrefetched] = useState(false);

  // Prefetch next stage when user is idle
  useEffect(() => {
    if (!enabled) return;

    let idleTimer: NodeJS.Timeout;

    const startPrefetch = async () => {
      setPrefetching(true);
      try {
        await agentPrefetchService.prefetchNextStage(currentStage, context);
        setPrefetched(true);
      } catch (error) {
        logger.error('Prefetch failed', { error });
      } finally {
        setPrefetching(false);
      }
    };

    // Wait for user to be idle before prefetching
    idleTimer = setTimeout(() => {
      startPrefetch();
    }, 5000); // 5 seconds idle

    return () => {
      clearTimeout(idleTimer);
    };
  }, [currentStage, context, enabled]);

  // Get prefetched result for a stage
  const getPrefetchedResult = (stage: WorkflowStage) => {
    return agentPrefetchService.getPrefetchedResult(stage, context);
  };

  return {
    prefetching,
    prefetched,
    getPrefetchedResult,
  };
}
