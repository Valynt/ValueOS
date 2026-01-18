<<<<<<< HEAD
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
=======
import { createContext, useContext, ReactNode } from "react";

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
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
    );
  }
  return context;
}

<<<<<<< HEAD
export function useSessionManager(): ISessionManager {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error(
      'useSessionManager must be called within <BatchThreeProviders>. ' +
      'Wrap your app with <BatchThreeProviders> at the root level. ' +
      'Services wired in Batch 4 after stabilization.'
=======
export function useSessionManager() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error(
      "useSessionManager must be called within <BatchThreeProviders>. " +
        "Wrap your app with <BatchThreeProviders> at the root level."
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
    );
  }
  return context;
}

<<<<<<< HEAD
export function useWorkflowState(): IWorkflowStateService {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error(
      'useWorkflowState must be called within <BatchThreeProviders>. ' +
      'Wrap your app with <BatchThreeProviders> at the root level. ' +
      'Services wired in Batch 4 after stabilization.'
=======
export function useWorkflowState() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error(
      "useWorkflowState must be called within <BatchThreeProviders>. " +
        "Wrap your app with <BatchThreeProviders> at the root level."
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
    );
  }
  return context;
}

<<<<<<< HEAD
// Provider component - services null for now (Batch 4 integration)
=======
// Provider component
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
interface BatchThreeProvidersProps {
  children: ReactNode;
}

export function BatchThreeProviders({ children }: BatchThreeProvidersProps) {
<<<<<<< HEAD
  // NOTE: Services instantiation deferred to Batch 4
  // Current focus: establish context structure & component integration
  // Next phase: wire AgentRegistry, SessionManager, WorkflowStateService
  
  return (
    <AgentRegistryContext.Provider value={null}>
      <SessionContext.Provider value={null}>
        <WorkflowContext.Provider value={null}>
          {children}
        </WorkflowContext.Provider>
=======
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
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
      </SessionContext.Provider>
    </AgentRegistryContext.Provider>
  );
}

export default BatchThreeProviders;
