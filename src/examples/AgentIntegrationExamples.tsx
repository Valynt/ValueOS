/**
 * Agent-UI Integration Examples
 * 
 * Demonstrates complete integration of agents with UI including:
 * - AgentAPI service usage
 * - useHydratePage hook
 * - Error boundaries
 * - Audit logging
 * - Circuit breaker handling
 */

import React, { useState } from 'react';
import { useHydratePage } from '../hooks/useHydratePage';
import {
  AgentErrorBoundary,
  AgentLoadingFallback,
  AgentValidationErrorFallback,
} from '../components/Agent';
import { AgentType } from '../services/AgentAPI';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

// ============================================================================
// Example 1: Basic Agent-Driven Page
// ============================================================================

export function Example1_BasicAgentPage() {
  const [result, actions] = useHydratePage({
    agent: 'opportunity',
    onHydrationSuccess: (page) => {
      console.log('Page hydrated successfully:', page);
    },
    onHydrationError: (error) => {
      console.error('Hydration failed:', error);
    },
  });

  const handleGenerate = () => {
    actions.hydrate('Generate an opportunity discovery page for a SaaS company');
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Example 1: Basic Agent-Driven Page</h1>

      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={result.state === 'loading'}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          Generate Page
        </button>
        {result.state === 'error' && (
          <button
            onClick={actions.retry}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Retry
          </button>
        )}
      </div>

      <AgentErrorBoundary
        agent="opportunity"
        circuitBreakerOpen={result.circuitBreakerOpen}
        onRetry={actions.retry}
      >
        {result.state === 'loading' && (
          <AgentLoadingFallback agent="opportunity" />
        )}

        {result.state === 'error' && result.validationErrors.length > 0 && (
          <AgentValidationErrorFallback
            errors={result.validationErrors}
            onRetry={actions.retry}
          />
        )}

        {result.state === 'success' && result.rendered && (
          <div>
            {result.rendered.element}
            {result.confidence && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-900">
                  Agent Confidence: {(result.confidence * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </div>
        )}
      </AgentErrorBoundary>
    </div>
  );
}

// ============================================================================
// Example 2: Multi-Agent Workflow
// ============================================================================

export function Example2_MultiAgentWorkflow() {
  const [currentAgent, setCurrentAgent] = useState<AgentType>('opportunity');

  const [opportunityResult, opportunityActions] = useHydratePage({
    agent: 'opportunity',
  });

  const [targetResult, targetActions] = useHydratePage({
    agent: 'target',
  });

  const [realizationResult, realizationActions] = useHydratePage({
    agent: 'realization',
  });

  const agents = [
    { type: 'opportunity' as AgentType, result: opportunityResult, actions: opportunityActions },
    { type: 'target' as AgentType, result: targetResult, actions: targetActions },
    { type: 'realization' as AgentType, result: realizationResult, actions: realizationActions },
  ];

  const currentAgentData = agents.find((a) => a.type === currentAgent);

  const handleGenerate = () => {
    const query = `Generate ${currentAgent} page`;
    currentAgentData?.actions.hydrate(query);
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Example 2: Multi-Agent Workflow</h1>

      {/* Agent Selector */}
      <div className="flex gap-2">
        {agents.map(({ type, result }) => (
          <button
            key={type}
            onClick={() => setCurrentAgent(type)}
            className={`px-4 py-2 rounded-md transition-colors ${
              currentAgent === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {type}
            {result.state === 'success' && (
              <CheckCircle className="inline-block ml-2 h-4 w-4" />
            )}
          </button>
        ))}
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={currentAgentData?.result.state === 'loading'}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        Generate {currentAgent} Page
      </button>

      {/* Content */}
      <AgentErrorBoundary
        agent={currentAgent}
        circuitBreakerOpen={currentAgentData?.result.circuitBreakerOpen}
        onRetry={currentAgentData?.actions.retry}
      >
        {currentAgentData?.result.state === 'loading' && (
          <AgentLoadingFallback agent={currentAgent} />
        )}

        {currentAgentData?.result.state === 'success' &&
          currentAgentData?.result.rendered && (
            <div>{currentAgentData.result.rendered.element}</div>
          )}
      </AgentErrorBoundary>
    </div>
  );
}

// ============================================================================
// Example 3: With Circuit Breaker Monitoring
// ============================================================================

export function Example3_CircuitBreakerMonitoring() {
  const [result, actions] = useHydratePage({
    agent: 'opportunity',
    enableRetry: true,
    maxRetries: 3,
  });

  const handleGenerate = () => {
    actions.hydrate('Generate opportunity page');
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Example 3: Circuit Breaker Monitoring</h1>

      {/* Circuit Breaker Status */}
      {result.circuitBreakerOpen && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center gap-2 text-orange-900">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-semibold">Circuit Breaker is Open</p>
          </div>
          <p className="text-sm text-orange-800 mt-2">
            The service is temporarily unavailable. You can reset the circuit breaker or
            wait for automatic recovery.
          </p>
          <button
            onClick={actions.resetCircuitBreaker}
            className="mt-3 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
          >
            Reset Circuit Breaker
          </button>
        </div>
      )}

      {/* Retry Counter */}
      {result.retryCount > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            Retry attempt {result.retryCount} of 3...
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={result.state === 'loading' || result.circuitBreakerOpen}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          Generate Page
        </button>
        {result.state === 'error' && !result.circuitBreakerOpen && (
          <button
            onClick={actions.retry}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Manual Retry
          </button>
        )}
      </div>

      {/* Content */}
      <AgentErrorBoundary
        agent="opportunity"
        circuitBreakerOpen={result.circuitBreakerOpen}
        onRetry={actions.retry}
      >
        {result.state === 'loading' && (
          <AgentLoadingFallback agent="opportunity" />
        )}

        {result.state === 'success' && result.rendered && (
          <div>{result.rendered.element}</div>
        )}
      </AgentErrorBoundary>
    </div>
  );
}

// ============================================================================
// Example 4: With Metadata Display
// ============================================================================

export function Example4_WithMetadata() {
  const [result, actions] = useHydratePage({
    agent: 'opportunity',
    onHydrationSuccess: (page) => {
      console.log('Hydration successful:', page);
    },
  });

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Example 4: With Metadata Display</h1>

      <button
        onClick={() => actions.hydrate('Generate opportunity page')}
        disabled={result.state === 'loading'}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        Generate Page
      </button>

      {/* Metadata Display */}
      {result.metadata && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">Agent</p>
            <p className="text-lg font-semibold text-gray-900">{result.metadata.agent}</p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">Duration</p>
            <p className="text-lg font-semibold text-gray-900">
              {result.metadata.duration}ms
            </p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">Confidence</p>
            <p className="text-lg font-semibold text-gray-900">
              {result.confidence ? `${(result.confidence * 100).toFixed(0)}%` : 'N/A'}
            </p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600">Timestamp</p>
            <p className="text-lg font-semibold text-gray-900">
              {new Date(result.metadata.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-semibold text-yellow-900 mb-2">Warnings:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-800">
            {result.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Content */}
      <AgentErrorBoundary agent="opportunity" onRetry={actions.retry}>
        {result.state === 'loading' && (
          <AgentLoadingFallback agent="opportunity" />
        )}

        {result.state === 'success' && result.rendered && (
          <div>{result.rendered.element}</div>
        )}
      </AgentErrorBoundary>
    </div>
  );
}

// ============================================================================
// Example 5: Auto-Hydration on Mount
// ============================================================================

export function Example5_AutoHydration() {
  const [result, actions] = useHydratePage({
    agent: 'opportunity',
    autoHydrate: true,
    initialQuery: 'Generate opportunity discovery page for enterprise software',
  });

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Example 5: Auto-Hydration on Mount</h1>

      <p className="text-gray-600">
        This page automatically generates content when mounted.
      </p>

      {result.state === 'error' && (
        <button
          onClick={actions.retry}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      )}

      <AgentErrorBoundary agent="opportunity" onRetry={actions.retry}>
        {result.state === 'loading' && (
          <AgentLoadingFallback
            agent="opportunity"
            message="Generating content automatically..."
          />
        )}

        {result.state === 'success' && result.rendered && (
          <div>{result.rendered.element}</div>
        )}
      </AgentErrorBoundary>
    </div>
  );
}

// ============================================================================
// All Examples Component
// ============================================================================

export function AllAgentIntegrationExamples() {
  const [activeExample, setActiveExample] = useState(1);

  const examples = [
    { id: 1, title: 'Basic Agent Page', component: Example1_BasicAgentPage },
    { id: 2, title: 'Multi-Agent Workflow', component: Example2_MultiAgentWorkflow },
    { id: 3, title: 'Circuit Breaker', component: Example3_CircuitBreakerMonitoring },
    { id: 4, title: 'With Metadata', component: Example4_WithMetadata },
    { id: 5, title: 'Auto-Hydration', component: Example5_AutoHydration },
  ];

  const ActiveComponent = examples.find((ex) => ex.id === activeExample)?.component;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold mb-4">Agent-UI Integration Examples</h1>
          <div className="flex gap-2 flex-wrap">
            {examples.map((example) => (
              <button
                key={example.id}
                onClick={() => setActiveExample(example.id)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeExample === example.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {example.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}
