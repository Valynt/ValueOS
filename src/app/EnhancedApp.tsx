/**
 * Main App Integration Example
 *
 * This demonstrates how to integrate the new architecture
 * with the existing ValueOS application structure.
 */

import React from 'react';
import { AppWrapper } from '../components/ChatCanvas/AppWrapper';
import ChatCanvasLayout from '../components/ChatCanvas/ChatCanvasLayout';
import { ServiceProvider } from '../components/ChatCanvas/services/ServiceLocator';

/**
 * Enhanced App with Service Locator Integration
 *
 * This shows how to wrap the existing application with the new
 * service locator pattern for better testability and dependency injection.
 */
export function EnhancedApp() {
  return (
    <ServiceProvider>
      <AppWrapper>
        <ChatCanvasLayout />
      </AppWrapper>
    </ServiceProvider>
  );
}

/**
 * Development App with Debug Services
 *
 * For development environment with enhanced debugging
 */
export function DevApp() {
  // Add development-specific services here if needed
  const devServices = {
    // Example: Mock services for development
    // agentChatService: createMockAgentService(),
    // workflowStateService: createMockWorkflowService(),
  };

  return (
    <ServiceProvider services={devServices}>
      <AppWrapper>
        <ChatCanvasLayout />
      </AppWrapper>
    </ServiceProvider>
  );
}

/**
 * Testing App with Mock Services
 *
 * For testing environment with complete service mocking
 */
export function TestApp() {
  // Mock services for testing
  const mockServices = {
    // These would be created by your testing framework
    // agentChatService: mockAgentChatService,
    // workflowStateService: mockWorkflowStateService,
    // logger: mockLogger,
    // supabase: mockSupabase,
  };

  return (
    <ServiceProvider services={mockServices}>
      <AppWrapper>
        <ChatCanvasLayout />
      </AppWrapper>
    </ServiceProvider>
  );
}

/**
 * Production App with Optimized Services
 *
 * For production with performance optimizations
 */
export function ProductionApp() {
  // Production-specific configurations
  const prodServices = {
    // Example: Optimized service instances
    // agentChatService: optimizedAgentChatService,
    // workflowStateService: cachedWorkflowStateService,
  };

  return (
    <ServiceProvider services={prodServices}>
      <AppWrapper>
        <ChatCanvasLayout />
      </AppWrapper>
    </ServiceProvider>
  );
}

/**
 * Migration Helper: Gradual App Wrapper
 *
 * Use this to gradually migrate existing apps
 */
export function MigratingApp({ useNewArchitecture = false }: { useNewArchitecture?: boolean }) {
  if (useNewArchitecture) {
    return (
      <EnhancedApp />
    );
  }

  // Return existing app without new architecture
  return <ChatCanvasLayout />;
}

/**
 * Environment-specific App Selector
 *
 * Automatically selects the appropriate app based on environment
 */
export function EnvironmentAwareApp() {
  const environment = process.env.NODE_ENV || 'development';

  switch (environment) {
    case 'development':
      return <DevApp />;
    case 'test':
      return <TestApp />;
    case 'production':
      return <ProductionApp />;
    default:
      return <EnhancedApp />;
  }
}

/**
 * Feature Flag Controlled App
 *
 * Use feature flags to control architecture migration
 */
export function FeatureFlaggedApp({
  enableNewArchitecture = false,
  enableServiceLocator = false
}: {
  enableNewArchitecture?: boolean;
  enableServiceLocator?: boolean;
}) {
  if (enableNewArchitecture && enableServiceLocator) {
    return <EnhancedApp />;
  }

  if (enableNewArchitecture) {
    return (
      <AppWrapper>
        <ChatCanvasLayout />
      </AppWrapper>
    );
  }

  // Default to existing app
  return <ChatCanvasLayout />;
}

// Export default app for backward compatibility
export default EnhancedApp;
