/**
 * App Wrapper for Service Locator Pattern
 *
 * This demonstrates how to integrate the new service locator
 * with the existing application structure.
 */

import React from 'react';
import { ServiceProvider } from './services/ServiceLocator';

interface AppWrapperProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that provides the service locator context
 * to the entire application tree.
 *
 * Usage:
 * ```tsx
 * <AppWrapper>
 *   <ChatCanvasLayout />
 * </AppWrapper>
 * ```
 */
export function AppWrapper({ children }: AppWrapperProps) {
  return (
    <ServiceProvider>
      {children}
    </ServiceProvider>
  );
}

/**
 * Enhanced wrapper with custom services for testing or special configurations
 */
export function AppWrapperWithServices({
  children,
  services
}: AppWrapperProps & {
  services?: Record<string, unknown>
}) {
  return (
    <ServiceProvider services={services}>
      {children}
    </ServiceProvider>
  );
}

/**
 * Development wrapper with debug services
 */
export function DevAppWrapper({ children }: AppWrapperProps) {
  // Add development-specific services here
  const devServices = {
    // You could add mock services or debug versions here
  };

  return (
    <AppWrapperWithServices services={devServices}>
      {children}
    </AppWrapperWithServices>
  );
}

/**
 * Testing wrapper with mock services
 */
export function TestAppWrapper({
  children,
  mockServices
}: AppWrapperProps & {
  mockServices?: Record<string, unknown>
}) {
  return (
    <AppWrapperWithServices services={mockServices}>
      {children}
    </AppWrapperWithServices>
  );
}
