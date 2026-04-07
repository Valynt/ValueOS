import { useCallback } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useEventSource } from '@/hooks/useEventSource';

import type { 
  WarmthTransitionEvent, 
  AgentUpdateEvent, 
  CollaborativeEditEvent,
  WorkspaceEvent 
} from './types';

/**
 * Hook to subscribe to workspace events for a specific case
 * 
 * Handles:
 * - Warmth transitions (invalidate case cache, announce to screen readers)
 * - Agent updates (update copilot state)
 * - Collaborative edits (merge remote changes)
 * 
 * @param caseId - The case ID to subscribe to
 */
export function useWorkspaceEvents(caseId: string | undefined) {
  const queryClient = useQueryClient();

  const handleEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as WorkspaceEvent;
      
      switch (data.type) {
        case 'WARMTH_TRANSITION': {
          handleWarmthTransition(data, queryClient, caseId);
          break;
        }
        
        case 'AGENT_UPDATE': {
          handleAgentUpdate(data, queryClient, caseId);
          break;
        }
        
        case 'COLLABORATIVE_EDIT': {
          handleCollaborativeEdit(data, queryClient, caseId);
          break;
        }
        
        case 'CHECKPOINT_REMINDER': {
          // Could show a toast or notification
          // For now, just log - implement based on notification system
          // eslint-disable-next-line no-console
          console.log('Checkpoint reminder:', data);
          break;
        }
        
        default: {
          // Unknown event type - log for debugging
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log('Unknown workspace event:', data);
          }
        }
      }
    } catch (error) {
      // Invalid event data
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse workspace event:', error);
      }
    }
  }, [caseId, queryClient]);

  const { status, reconnectAttempts } = useEventSource({
    url: caseId ? `/api/cases/${caseId}/events` : '',
    onMessage: handleEvent,
    reconnectDelay: 5000,
    maxReconnectAttempts: 10,
  });

  return {
    connectionStatus: status,
    reconnectAttempts,
    isConnected: status === 'open',
  };
}

/**
 * Handle warmth transition event
 */
function handleWarmthTransition(
  event: WarmthTransitionEvent,
  queryClient: ReturnType<typeof useQueryClient>,
  caseId: string | undefined
) {
  // Invalidate case cache to trigger refetch with new warmth
  if (caseId) {
    queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    queryClient.invalidateQueries({ queryKey: ['warmth-history', caseId] });
  }
  
  // Announce to screen readers (accessibility)
  announceWarmthChange(event.previous.state, event.current.state, event.triggeredBy);
}

/**
 * Handle agent update event
 */
function handleAgentUpdate(
  event: AgentUpdateEvent,
  queryClient: ReturnType<typeof useQueryClient>,
  caseId: string | undefined
) {
  // Update agent state in cache
  if (caseId) {
    queryClient.setQueryData(['agent-state', caseId], event.payload);
  }
}

/**
 * Handle collaborative edit event
 */
function handleCollaborativeEdit(
  event: CollaborativeEditEvent,
  queryClient: ReturnType<typeof useQueryClient>,
  caseId: string | undefined
) {
  // Merge remote changes into graph cache
  if (caseId) {
    queryClient.setQueryData(['graph', caseId], (oldGraph: unknown) => {
      if (!oldGraph || typeof oldGraph !== 'object') return oldGraph;
      
      const graph = oldGraph as { nodes?: Record<string, unknown> };
      const updatedNodes = { ...graph.nodes };
      
      // Apply each change
      event.changes.forEach((change) => {
        if (updatedNodes[change.nodeId]) {
          updatedNodes[change.nodeId] = {
            ...updatedNodes[change.nodeId],
            [change.field]: change.newValue,
          };
        }
      });
      
      return {
        ...graph,
        nodes: updatedNodes,
      };
    });
  }
}

/**
 * Announce warmth change to screen readers
 */
function announceWarmthChange(
  previous: string,
  current: string,
  triggeredBy: string
) {
  if (typeof window === 'undefined') return;
  
  const messages: Record<string, string> = {
    forming: 'Case is forming',
    firm: 'Case is now firm',
    verified: 'Case is verified and ready',
  };
  
  const message = messages[current] || `Case is now ${current}`;
  const triggeredByText = triggeredBy === 'user' ? 'by you' : 
                          triggeredBy === 'agent' ? 'by copilot' : 'automatically';
  
  // Dispatch custom event for screen reader announcement
  window.dispatchEvent(
    new CustomEvent('a11y-announce', {
      detail: { message: `${message}, changed ${triggeredByText}` },
    })
  );
}
