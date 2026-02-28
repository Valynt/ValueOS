import { createContext, ReactNode, useContext } from "react";

// Import services
import { AgentRegistry } from "../services/AgentRegistry";
import { SessionManager } from "../services/SessionManager";
import { WorkflowStateService } from "../services/WorkflowStateService";
import { supabase } from "../lib/supabase";

/**
 * Batch 4 Providers - Service Integration
 *
 * Provides services to components via context hooks.
 * Services now wired with dependencies (Supabase client).
 *
 * Services included:
 * - AgentRegistry: Agent discovery and routing
 * - SessionManager: Session lifecycle management
 * - WorkflowStateService: Workflow state tracking
 */

// Context declarations
const AgentRegistryContext = createContext<AgentRegistry | null>(null);
const SessionContext = createContext<SessionManager | null>(null);
const WorkflowContext = createContext<WorkflowStateService | null>(null);

// Export hooks for component usage
export function useAgentRegistry() {
  const context = useContext(AgentRegistryContext);
  if (!context) {
    throw new Error(
      "useAgentRegistry must be called within <BatchThreeProviders>. " +
        "Wrap your app with <BatchThreeProviders> at the root level."
    );
  }
  return context;
}

export function useSessionManager() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error(
      "useSessionManager must be called within <BatchThreeProviders>. " +
        "Wrap your app with <BatchThreeProviders> at the root level."
    );
  }
  return context;
}

export function useWorkflowState() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error(
      "useWorkflowState must be called within <BatchThreeProviders>. " +
        "Wrap your app with <BatchThreeProviders> at the root level."
    );
  }
  return context;
}

// Provider component
interface BatchThreeProvidersProps {
  children: ReactNode;
}

export function BatchThreeProviders({ children }: BatchThreeProvidersProps) {
  // Guard: Supabase must be configured
  if (!supabase) {
    throw new Error(
      "Supabase client not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
  }

  // Instantiate services with dependencies
  const agentRegistry = new AgentRegistry();
  const sessionManager = new SessionManager();
  const workflowService = new WorkflowStateService(supabase);

  return (
    <AgentRegistryContext.Provider value={agentRegistry}>
      <SessionContext.Provider value={sessionManager}>
        <WorkflowContext.Provider value={workflowService}>{children}</WorkflowContext.Provider>
      </SessionContext.Provider>
    </AgentRegistryContext.Provider>
  );
}

export default BatchThreeProviders;
