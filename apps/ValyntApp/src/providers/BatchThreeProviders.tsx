import { createContext, useContext, ReactNode } from 'react';

/**
 * Batch 3 Minimal Providers - Bootstrap Mode
 * 
 * Provides minimal context for component integration.
 * Services deferred to Batch 4 (blocked by Batch 2 service quality issues).
 * 
 * This provider establishes the context structure and hooks interface
 * that components can use once services are stabilized.
 */

// Type stubs for future service integration
interface IAgentRegistry {
  register: (agentId: string, agent: unknown) => void;
}

interface ISessionManager {
  createSession: (userId: string) => Promise<string>;
}

interface IWorkflowStateService {
  getState: (sessionId: string) => Promise<unknown>;
}

// Context declarations (initial null - services to be wired in Batch 4)
const AgentRegistryContext = createContext<IAgentRegistry | null>(null);
const SessionContext = createContext<ISessionManager | null>(null);
const WorkflowContext = createContext<IWorkflowStateService | null>(null);

// Export hooks for component usage (safe - throw only if component uses them)
export function useAgentRegistry(): IAgentRegistry {
  const context = useContext(AgentRegistryContext);
  if (!context) {
    throw new Error(
      'useAgentRegistry must be called within <BatchThreeProviders>. ' +
      'Wrap your app with <BatchThreeProviders> at the root level. ' +
      'Services wired in Batch 4 after stabilization.'
    );
  }
  return context;
}

export function useSessionManager(): ISessionManager {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error(
      'useSessionManager must be called within <BatchThreeProviders>. ' +
      'Wrap your app with <BatchThreeProviders> at the root level. ' +
      'Services wired in Batch 4 after stabilization.'
    );
  }
  return context;
}

export function useWorkflowState(): IWorkflowStateService {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error(
      'useWorkflowState must be called within <BatchThreeProviders>. ' +
      'Wrap your app with <BatchThreeProviders> at the root level. ' +
      'Services wired in Batch 4 after stabilization.'
    );
  }
  return context;
}

// Provider component - services null for now (Batch 4 integration)
interface BatchThreeProvidersProps {
  children: ReactNode;
}

export function BatchThreeProviders({ children }: BatchThreeProvidersProps) {
  // NOTE: Services instantiation deferred to Batch 4
  // Current focus: establish context structure & component integration
  // Next phase: wire AgentRegistry, SessionManager, WorkflowStateService
  
  return (
    <AgentRegistryContext.Provider value={null}>
      <SessionContext.Provider value={null}>
        <WorkflowContext.Provider value={null}>
          {children}
        </WorkflowContext.Provider>
      </SessionContext.Provider>
    </AgentRegistryContext.Provider>
  );
}

export default BatchThreeProviders;
