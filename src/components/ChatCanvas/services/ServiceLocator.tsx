/**
 * Service Locator Pattern Implementation
 *
 * Provides a centralized registry for services with dependency injection
 * capabilities for better testability and modularity.
 */

import { AgentChatService } from '../../services/AgentChatService';
import { WorkflowStateService } from '../../services/WorkflowStateService';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

// ============================================================================
// Service Registry Interface
// ============================================================================

export interface ServiceRegistry {
  // Core Services
  getAgentChatService(): AgentChatService;
  getWorkflowStateService(): WorkflowStateService;

  // Utility Services
  getLogger(): typeof logger;
  getSupabaseClient(): typeof supabase;

  // Registration
  register<T>(key: string, service: T): void;
  unregister(key: string): void;

  // Testing utilities
  clear(): void;
  isRegistered(key: string): boolean;
}

// ============================================================================
// Service Locator Implementation
// ============================================================================

class ServiceLocatorImpl implements ServiceRegistry {
  private services = new Map<string, unknown>();
  private singletons = new Map<string, unknown>();

  // Default service factories
  private serviceFactories = new Map<string, () => unknown>([
    ['agentChatService', () => new AgentChatService()],
    ['workflowStateService', () => new WorkflowStateService(supabase)],
    ['logger', () => logger],
    ['supabase', () => supabase],
  ]);

  getAgentChatService(): AgentChatService {
    return this.get('agentChatService') as AgentChatService;
  }

  getWorkflowStateService(): WorkflowStateService {
    return this.get('workflowStateService') as WorkflowStateService;
  }

  getLogger(): typeof logger {
    return this.get('logger') as typeof logger;
  }

  getSupabaseClient(): typeof supabase {
    return this.get('supabase') as typeof supabase;
  }

  register<T>(key: string, service: T): void {
    this.services.set(key, service);
    logger.debug(`Service registered: ${key}`);
  }

  unregister(key: string): void {
    this.services.delete(key);
    this.singletons.delete(key);
    logger.debug(`Service unregistered: ${key}`);
  }

  clear(): void {
    this.services.clear();
    this.singletons.clear();
    logger.debug('All services cleared');
  }

  isRegistered(key: string): boolean {
    return this.services.has(key) || this.serviceFactories.has(key);
  }

  private get<T>(key: string): T {
    // Check for explicitly registered service first
    if (this.services.has(key)) {
      return this.services.get(key) as T;
    }

    // Check for singleton instance
    if (this.singletons.has(key)) {
      return this.singletons.get(key) as T;
    }

    // Create from factory if available
    const factory = this.serviceFactories.get(key);
    if (factory) {
      const instance = factory();
      this.singletons.set(key, instance);
      return instance as T;
    }

    throw new Error(`Service not found: ${key}`);
  }

  // Advanced registration methods
  registerSingleton<T>(key: string, factory: () => T): void {
    this.serviceFactories.set(key, factory);
  }

  registerFactory<T>(key: string, factory: () => T): void {
    this.serviceFactories.set(key, factory);
  }
}

// ============================================================================
// Global Service Locator Instance
// ============================================================================

export const serviceLocator = new ServiceLocatorImpl();

// ============================================================================
// Service Provider Hook
// ============================================================================

import { useContext, createContext, ReactNode, useMemo } from 'react';

interface ServiceProviderContextValue {
  services: ServiceRegistry;
  registerService: <T>(key: string, service: T) => void;
  unregisterService: (key: string) => void;
}

const ServiceProviderContext = createContext<ServiceProviderContextValue | null>(null);

interface ServiceProviderProps {
  children: ReactNode;
  services?: Partial<ServiceRegistry>;
}

export function ServiceProvider({ children, services: customServices }: ServiceProviderProps) {
  const contextValue = useMemo(() => {
    // Register custom services if provided
    if (customServices) {
      Object.entries(customServices).forEach(([key, service]) => {
        serviceLocator.register(key, service);
      });
    }

    return {
      services: serviceLocator,
      registerService: <T,>(key: string, service: T) => serviceLocator.register(key, service),
      unregisterService: (key: string) => serviceLocator.unregister(key),
    };
  }, [customServices]);

  return (
    <ServiceProviderContext.Provider value={contextValue}>
      {children}
    </ServiceProviderContext.Provider>
  );
}

export function useServiceLocator(): ServiceProviderContextValue {
  const context = useContext(ServiceProviderContext);
  if (!context) {
    throw new Error('useServiceLocator must be used within a ServiceProvider');
  }
  return context;
}

// ============================================================================
// Service Hooks for Specific Services
// ============================================================================

export function useAgentChatService(): AgentChatService {
  const { services } = useServiceLocator();
  return services.getAgentChatService();
}

export function useWorkflowStateService(): WorkflowStateService {
  const { services } = useServiceLocator();
  return services.getWorkflowStateService();
}

export function useLogger(): typeof logger {
  const { services } = useServiceLocator();
  return services.getLogger();
}

export function useSupabaseClient(): typeof supabase {
  const { services } = useServiceLocator();
  return services.getSupabaseClient();
}

// ============================================================================
// Mock Service Factory for Testing
// ============================================================================

export interface MockServices {
  agentChatService?: Partial<AgentChatService>;
  workflowStateService?: Partial<WorkflowStateService>;
  logger?: Partial<typeof logger>;
  supabase?: Partial<typeof supabase>;
}

export function createMockServices(overrides: MockServices = {}): ServiceRegistry {
  const mockRegistry = new ServiceLocatorImpl();

  // Register mock services
  if (overrides.agentChatService) {
    mockRegistry.register('agentChatService', overrides.agentChatService);
  }

  if (overrides.workflowStateService) {
    mockRegistry.register('workflowStateService', overrides.workflowStateService);
  }

  if (overrides.logger) {
    mockRegistry.register('logger', overrides.logger);
  }

  if (overrides.supabase) {
    mockRegistry.register('supabase', overrides.supabase);
  }

  return mockRegistry;
}

// ============================================================================
// Test Utilities
// ============================================================================

export class ServiceLocatorTestHelper {
  private originalServices = new Map<string, unknown>();

  setupMockServices(overrides: MockServices): void {
    // Store original services
    ['agentChatService', 'workflowStateService', 'logger', 'supabase'].forEach(key => {
      if (serviceLocator.isRegistered(key)) {
        try {
          const original = (serviceLocator as any)[key]();
          this.originalServices.set(key, original);
        } catch (error) {
          // Service might not have a getter method
        }
      }
    });

    // Register mock services
    const mockServices = createMockServices(overrides);
    ['agentChatService', 'workflowStateService', 'logger', 'supabase'].forEach(key => {
      if (mockServices.isRegistered(key)) {
        try {
          const mockService = (mockServices as any)[key]();
          serviceLocator.register(key, mockService);
        } catch (error) {
          // Service might not have a getter method
        }
      }
    });
  }

  restoreOriginalServices(): void {
    this.originalServices.forEach((service, key) => {
      serviceLocator.register(key, service);
    });
    this.originalServices.clear();
    serviceLocator.clear();
  }

  createTestServiceProvider(overrides: MockServices = {}): React.FC<{ children: ReactNode }> {
    return ({ children }) => (
      <ServiceProvider services={createMockServices(overrides)}>
        {children}
      </ServiceProvider>
    );
  }
}

// ============================================================================
// Service Health Check
// ============================================================================

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheck: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export async function checkServiceHealth(): Promise<ServiceHealth[]> {
  const healthChecks: ServiceHealth[] = [];

  // Check Agent Chat Service
  try {
    const service = serviceLocator.getAgentChatService();
    // Basic health check - service exists and has required methods
    const hasChatMethod = typeof service.chat === 'function';
    healthChecks.push({
      name: 'agentChatService',
      status: hasChatMethod ? 'healthy' : 'unhealthy',
      lastCheck: Date.now(),
      metadata: { hasChatMethod },
    });
  } catch (error) {
    healthChecks.push({
      name: 'agentChatService',
      status: 'unhealthy',
      lastCheck: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Check Workflow State Service
  try {
    const service = serviceLocator.getWorkflowStateService();
    const hasLoadMethod = typeof service.loadOrCreateSession === 'function';
    const hasSaveMethod = typeof service.saveWorkflowState === 'function';
    healthChecks.push({
      name: 'workflowStateService',
      status: (hasLoadMethod && hasSaveMethod) ? 'healthy' : 'unhealthy',
      lastCheck: Date.now(),
      metadata: { hasLoadMethod, hasSaveMethod },
    });
  } catch (error) {
    healthChecks.push({
      name: 'workflowStateService',
      status: 'unhealthy',
      lastCheck: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Check Logger
  try {
    const logger = serviceLocator.getLogger();
    const hasInfoMethod = typeof logger.info === 'function';
    const hasErrorMethod = typeof logger.error === 'function';
    healthChecks.push({
      name: 'logger',
      status: (hasInfoMethod && hasErrorMethod) ? 'healthy' : 'unhealthy',
      lastCheck: Date.now(),
      metadata: { hasInfoMethod, hasErrorMethod },
    });
  } catch (error) {
    healthChecks.push({
      name: 'logger',
      status: 'unhealthy',
      lastCheck: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Check Supabase Client
  try {
    const supabase = serviceLocator.getSupabaseClient();
    const hasAuth = typeof supabase.auth === 'object';
    const hasFrom = typeof supabase.from === 'function';
    healthChecks.push({
      name: 'supabase',
      status: (hasAuth && hasFrom) ? 'healthy' : 'unhealthy',
      lastCheck: Date.now(),
      metadata: { hasAuth, hasFrom },
    });
  } catch (error) {
    healthChecks.push({
      name: 'supabase',
      status: 'unhealthy',
      lastCheck: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return healthChecks;
}

// ============================================================================
// Export Default Instance
// ============================================================================

export default serviceLocator;
