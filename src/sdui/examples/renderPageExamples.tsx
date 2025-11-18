/**
 * Comprehensive examples demonstrating renderPage() usage
 */

import React from 'react';
import { renderPage, RenderPageOptions } from '../renderPage';
import { SDUIPageDefinition } from '../schema';

// ============================================================================
// Example 1: Basic Usage - Simple Page Rendering
// ============================================================================

export function Example1_BasicUsage() {
  const pageDefinition: SDUIPageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'InfoBanner',
        version: 1,
        props: {
          title: 'Welcome to SDUI',
          description: 'This is a server-driven UI example',
          tone: 'info',
        },
      },
      {
        type: 'component',
        component: 'DiscoveryCard',
        version: 1,
        props: {
          title: 'Getting Started',
          questions: [
            'What is your primary goal?',
            'What challenges are you facing?',
            'How can we help?',
          ],
        },
      },
    ],
  };

  const result = renderPage(pageDefinition);

  return (
    <div>
      <h2>Example 1: Basic Usage</h2>
      {result.element}
      <div className="mt-4 text-sm text-gray-600">
        <p>Components rendered: {result.metadata.componentCount}</p>
        <p>Warnings: {result.warnings.length}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Example 2: With Data Hydration
// ============================================================================

export function Example2_WithHydration() {
  const pageDefinition: SDUIPageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'InfoBanner',
        version: 1,
        props: {
          title: 'User Profile',
        },
        // Hydrate from API endpoints
        hydrateWith: ['/api/user/profile', '/api/user/settings'],
      },
      {
        type: 'component',
        component: 'ValueTreeCard',
        version: 1,
        props: {
          title: 'Value Drivers',
        },
        hydrateWith: ['/api/value-tree'],
      },
    ],
  };

  const options: RenderPageOptions = {
    onHydrationComplete: (componentName, data) => {
      console.log(`Hydrated ${componentName}:`, data);
    },
    onHydrationError: (error, endpoint) => {
      console.error(`Failed to hydrate from ${endpoint}:`, error);
    },
    hydrationTimeout: 5000,
    enableHydrationRetry: true,
    retryAttempts: 3,
  };

  const result = renderPage(pageDefinition, options);

  return (
    <div>
      <h2>Example 2: With Data Hydration</h2>
      {result.element}
      <div className="mt-4 text-sm text-gray-600">
        <p>Hydrated components: {result.metadata.hydratedComponentCount}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Example 3: With Error Handling
// ============================================================================

export function Example3_ErrorHandling() {
  const pageDefinition: SDUIPageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'InfoBanner',
        version: 1,
        props: {
          title: 'Valid Component',
        },
      },
      {
        type: 'component',
        component: 'NonExistentComponent', // This will fail
        version: 1,
        props: {},
      },
      {
        type: 'component',
        component: 'DiscoveryCard',
        version: 1,
        props: {
          questions: [], // Missing required data
        },
      },
    ],
  };

  const options: RenderPageOptions = {
    onRenderError: (error, componentName) => {
      console.error(`Render error in ${componentName}:`, error);
      // Send to error tracking service
      // trackError(error, { component: componentName });
    },
    unknownComponentFallback: ({ componentName }) => (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-900">
          Component "{componentName}" is not available
        </p>
      </div>
    ),
  };

  const result = renderPage(pageDefinition, options);

  return (
    <div>
      <h2>Example 3: Error Handling</h2>
      {result.element}
    </div>
  );
}

// ============================================================================
// Example 4: With Fallback Components
// ============================================================================

export function Example4_WithFallbacks() {
  const pageDefinition: SDUIPageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'ValueTreeCard',
        version: 1,
        props: {
          title: 'Value Tree',
        },
        hydrateWith: ['/api/value-tree'], // This might fail
        fallback: {
          message: 'Value tree data is temporarily unavailable',
          component: 'InfoBanner',
          props: {
            title: 'Data Unavailable',
            description: 'Please try again later',
            tone: 'warning',
          },
        },
      },
    ],
  };

  const options: RenderPageOptions = {
    onHydrationError: (error, endpoint) => {
      console.warn(`Hydration failed for ${endpoint}, using fallback`);
    },
  };

  const result = renderPage(pageDefinition, options);

  return (
    <div>
      <h2>Example 4: With Fallback Components</h2>
      {result.element}
    </div>
  );
}

// ============================================================================
// Example 5: Debug Mode
// ============================================================================

export function Example5_DebugMode() {
  const pageDefinition: SDUIPageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'InfoBanner',
        version: 1,
        props: {
          title: 'Debug Mode Example',
          description: 'Component metadata will be shown below each component',
        },
      },
      {
        type: 'component',
        component: 'DiscoveryCard',
        version: 1,
        props: {
          questions: ['Question 1', 'Question 2'],
        },
        hydrateWith: ['/api/questions'],
      },
    ],
    metadata: {
      debug: true, // Enable debug mode
    },
  };

  const options: RenderPageOptions = {
    debug: true, // Can also enable via options
    onComponentRender: (componentName, props) => {
      console.log(`Rendering ${componentName} with props:`, props);
    },
  };

  const result = renderPage(pageDefinition, options);

  return (
    <div>
      <h2>Example 5: Debug Mode</h2>
      {result.element}
    </div>
  );
}

// ============================================================================
// Example 6: Custom Data Fetcher
// ============================================================================

export function Example6_CustomDataFetcher() {
  // Custom fetcher that adds authentication headers
  const authenticatedFetcher = async (endpoint: string) => {
    const token = localStorage.getItem('auth_token');

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  };

  const pageDefinition: SDUIPageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'InfoBanner',
        version: 1,
        props: {
          title: 'Protected Data',
        },
        hydrateWith: ['/api/protected/user-data'],
      },
    ],
  };

  const options: RenderPageOptions = {
    dataFetcher: authenticatedFetcher,
    onHydrationError: (error, endpoint) => {
      if (error.message.includes('401')) {
        // Redirect to login
        window.location.href = '/login';
      }
    },
  };

  const result = renderPage(pageDefinition, options);

  return (
    <div>
      <h2>Example 6: Custom Data Fetcher</h2>
      {result.element}
    </div>
  );
}

// ============================================================================
// Example 7: Custom Loading Component
// ============================================================================

export function Example7_CustomLoading() {
  const CustomLoader: React.FC<{ componentName: string }> = ({ componentName }) => (
    <div className="flex items-center justify-center p-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />
        <p className="mt-2 text-sm font-medium text-gray-700">
          Loading {componentName}...
        </p>
      </div>
    </div>
  );

  const pageDefinition: SDUIPageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'ValueTreeCard',
        version: 1,
        props: {
          title: 'Value Tree',
        },
        hydrateWith: ['/api/value-tree'],
      },
    ],
  };

  const options: RenderPageOptions = {
    loadingComponent: CustomLoader,
  };

  const result = renderPage(pageDefinition, options);

  return (
    <div>
      <h2>Example 7: Custom Loading Component</h2>
      {result.element}
    </div>
  );
}

// ============================================================================
// Example 8: Validation Error Handling
// ============================================================================

export function Example8_ValidationErrors() {
  const invalidPageDefinition = {
    type: 'page',
    version: 1,
    sections: [], // Invalid: must have at least one section
  };

  const options: RenderPageOptions = {
    onValidationError: (errors) => {
      console.error('Validation failed:', errors);
      // Show user-friendly error message
      // showNotification('Invalid page configuration', 'error');
    },
  };

  try {
    const result = renderPage(invalidPageDefinition, options);
    return result.element;
  } catch (error) {
    return (
      <div>
        <h2>Example 8: Validation Error Handling</h2>
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-900">
            Failed to render page: {(error as Error).message}
          </p>
        </div>
      </div>
    );
  }
}

// ============================================================================
// Example 9: React Component Wrapper
// ============================================================================

export function Example9_ComponentWrapper() {
  const [pageDefinition, setPageDefinition] = React.useState<SDUIPageDefinition>({
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'InfoBanner',
        version: 1,
        props: {
          title: 'Dynamic Page',
          description: 'This page can be updated dynamically',
        },
      },
    ],
  });

  const updatePage = () => {
    setPageDefinition({
      type: 'page',
      version: 1,
      sections: [
        {
          type: 'component',
          component: 'InfoBanner',
          version: 1,
          props: {
            title: 'Updated Page',
            description: 'The page has been updated!',
            tone: 'success',
          },
        },
        {
          type: 'component',
          component: 'DiscoveryCard',
          version: 1,
          props: {
            questions: ['New question 1', 'New question 2'],
          },
        },
      ],
    });
  };

  const result = renderPage(pageDefinition, {
    debug: false,
  });

  return (
    <div>
      <h2>Example 9: Dynamic Updates</h2>
      <button
        onClick={updatePage}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Update Page
      </button>
      {result.element}
    </div>
  );
}

// ============================================================================
// Example 10: Performance Monitoring
// ============================================================================

export function Example10_PerformanceMonitoring() {
  const pageDefinition: SDUIPageDefinition = {
    type: 'page',
    version: 1,
    sections: [
      {
        type: 'component',
        component: 'InfoBanner',
        version: 1,
        props: { title: 'Component 1' },
      },
      {
        type: 'component',
        component: 'DiscoveryCard',
        version: 1,
        props: { questions: ['Q1', 'Q2'] },
        hydrateWith: ['/api/questions'],
      },
      {
        type: 'component',
        component: 'ValueTreeCard',
        version: 1,
        props: { title: 'Value Tree' },
        hydrateWith: ['/api/value-tree'],
      },
    ],
  };

  const [metrics, setMetrics] = React.useState<any>(null);

  const options: RenderPageOptions = {
    onComponentRender: (componentName, props) => {
      console.log(`[Perf] Rendered ${componentName}`);
    },
    onHydrationComplete: (componentName, data) => {
      console.log(`[Perf] Hydrated ${componentName}`);
    },
  };

  const result = renderPage(pageDefinition, options);

  React.useEffect(() => {
    setMetrics(result.metadata);
  }, [result]);

  return (
    <div>
      <h2>Example 10: Performance Monitoring</h2>
      {result.element}
      {metrics && (
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <h3 className="font-semibold mb-2">Performance Metrics</h3>
          <ul className="text-sm space-y-1">
            <li>Total Components: {metrics.componentCount}</li>
            <li>Hydrated Components: {metrics.hydratedComponentCount}</li>
            <li>Version: {metrics.version}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// All Examples Component
// ============================================================================

export function AllRenderPageExamples() {
  return (
    <div className="space-y-8 p-8">
      <h1 className="text-3xl font-bold mb-8">renderPage() Examples</h1>

      <div className="space-y-12">
        <Example1_BasicUsage />
        <Example2_WithHydration />
        <Example3_ErrorHandling />
        <Example4_WithFallbacks />
        <Example5_DebugMode />
        <Example6_CustomDataFetcher />
        <Example7_CustomLoading />
        <Example8_ValidationErrors />
        <Example9_ComponentWrapper />
        <Example10_PerformanceMonitoring />
      </div>
    </div>
  );
}
