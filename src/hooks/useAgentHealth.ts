/**
 * Agent Health Hook
 * 
 * Monitors current agent activity and provides status information.
 * Integrates with existing agent orchestration system.
 */

import { useState, useEffect } from 'react';
import { agentChatService } from '../services/AgentChatService';
import { logger } from '../lib/logger';

export type AgentStatus = 'idle' | 'working' | 'warning' | 'error';

interface AgentHealthState {
  status: AgentStatus;
  currentAgent: string | null;
  latency: number | null;
  cost: number | null;
  message: string | null;
}

export function useAgentHealth() {
  const [state, setState] = useState<AgentHealthState>({
    status: 'idle',
    currentAgent: null,
    latency: null,
    cost: null,
    message: null,
  });

  useEffect(() => {
    // Subscribe to agent chat service events
    const handleAgentStart = (data: any) => {
      setState(prev => ({
        ...prev,
        status: 'working',
        currentAgent: data.agentName || 'Agent',
        message: data.message || 'Processing...',
      }));
    };

    const handleAgentComplete = (data: any) => {
      setState(prev => ({
        ...prev,
        status: 'idle',
        currentAgent: null,
        latency: data.latency || null,
        cost: data.cost || null,
        message: null,
      }));
    };

    const handleAgentError = (data: any) => {
      setState(prev => ({
        ...prev,
        status: 'error',
        message: data.error || 'Agent failed',
      }));

      // Auto-reset to idle after 5 seconds
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          status: 'idle',
          currentAgent: null,
          message: null,
        }));
      }, 5000);
    };

    // Listen to agent events
    // Note: This assumes agentChatService has event emitter capabilities
    // If not, we'll need to add them or use a different approach
    
    try {
      // Check if service has event subscription
      if (typeof agentChatService.on === 'function') {
        agentChatService.on('agent:start', handleAgentStart);
        agentChatService.on('agent:complete', handleAgentComplete);
        agentChatService.on('agent:error', handleAgentError);

        return () => {
          agentChatService.off('agent:start', handleAgentStart);
          agentChatService.off('agent:complete', handleAgentComplete);
          agentChatService.off('agent:error', handleAgentError);
        };
      } else {
        // Fallback: Poll agent status
        const interval = setInterval(() => {
          // Check if there's an active agent session
          const isActive = agentChatService.isProcessing?.();
          
          if (isActive) {
            setState(prev => ({
              ...prev,
              status: 'working',
              currentAgent: 'Agent',
              message: 'Processing...',
            }));
          } else if (state.status === 'working') {
            setState(prev => ({
              ...prev,
              status: 'idle',
              currentAgent: null,
              message: null,
            }));
          }
        }, 1000);

        return () => clearInterval(interval);
      }
    } catch (error) {
      logger.error('Failed to setup agent health monitoring', { error });
    }
  }, [state.status]);

  return state;
}
