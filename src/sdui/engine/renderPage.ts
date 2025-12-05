/**
 * SDUI Page Rendering Engine
 * 
 * Handles rendering of SDUI pages including layout directives from CoordinatorAgent.
 */

import { logger } from '../../lib/logger';
import React from 'react';
import type { SDUIPageDefinition, SDUISection, SDUILayoutDirective } from '../schema';

export interface RenderContext {
  userId?: string;
  sessionId?: string;
  businessCaseId?: string;
  [key: string]: any;
}

export interface RenderOptions {
  context?: RenderContext;
  onError?: (error: Error, section: SDUISection) => void;
  componentRegistry?: Map<string, React.ComponentType<any>>;
}

/**
 * Render a complete SDUI page
 */
export function renderPage(
  page: SDUIPageDefinition,
  options?: RenderOptions
): React.ReactElement {
  const { context, onError, componentRegistry } = options || {};

  try {
    // Render all sections
    const renderedSections = page.sections.map((section, index) => {
      try {
        return renderSection(section, index, context, componentRegistry);
      } catch (error) {
        if (onError) {
          onError(error as Error, section);
        }
        return renderErrorFallback(section, error as Error, index);
      }
    });

    // Wrap in page container
    return React.createElement(
      'div',
      {
        key: 'sdui-page',
        className: 'sdui-page',
        'data-version': page.version,
      },
      renderedSections
    );
  } catch (error) {
    logger.error('Failed to render SDUI page:', error);
    return React.createElement(
      'div',
      { className: 'sdui-error' },
      'Failed to render page'
    );
  }
}

/**
 * Render a single section (component or layout directive)
 */
function renderSection(
  section: SDUISection,
  index: number,
  context?: RenderContext,
  componentRegistry?: Map<string, React.ComponentType<any>>
): React.ReactElement {
  if (section.type === 'layout.directive') {
    return renderLayoutDirective(section, index, context, componentRegistry);
  }

  // Regular component section
  return renderComponent(section, index, context, componentRegistry);
}

/**
 * Render a layout directive from CoordinatorAgent
 */
function renderLayoutDirective(
  directive: SDUILayoutDirective,
  index: number,
  context?: RenderContext,
  componentRegistry?: Map<string, React.ComponentType<any>>
): React.ReactElement {
  const { intent, component, props, layout, metadata } = directive;

  // Get component from registry
  const Component = componentRegistry?.get(component);

  if (!Component) {
    logger.warn(`Component not found in registry: ${component}`);
    return renderMissingComponent(component, index);
  }

  // Merge context into props
  const mergedProps = {
    ...props,
    context,
    intent,
    metadata,
  };

  // Apply layout wrapper if specified
  const element = React.createElement(Component, {
    key: `directive-${index}`,
    ...mergedProps,
  });

  if (layout) {
    return wrapWithLayout(element, layout, index, context, componentRegistry);
  }

  return element;
}

/**
 * Render a regular component section
 */
function renderComponent(
  section: SDUISection,
  index: number,
  context?: RenderContext,
  componentRegistry?: Map<string, React.ComponentType<any>>
): React.ReactElement {
  if (section.type !== 'component') {
    throw new Error(`Invalid section type: ${(section as any).type}`);
  }

  const { component, props, version, fallback } = section;

  // Get component from registry
  const Component = componentRegistry?.get(component);

  if (!Component) {
    logger.warn(`Component not found in registry: ${component}`);
    
    // Use fallback if provided
    if (fallback?.component) {
      const FallbackComponent = componentRegistry?.get(fallback.component);
      if (FallbackComponent) {
        return React.createElement(FallbackComponent, {
          key: `fallback-${index}`,
          ...fallback.props,
          context,
        });
      }
    }

    return renderMissingComponent(component, index);
  }

  // Merge context into props
  const mergedProps = {
    ...props,
    context,
    version,
  };

  return React.createElement(Component, {
    key: `component-${index}`,
    ...mergedProps,
  });
}

/**
 * Wrap element with layout container (supports nested layouts)
 */
function wrapWithLayout(
  element: React.ReactElement,
  layout: string | { type: string; children?: any[] },
  index: number,
  context?: RenderContext,
  componentRegistry?: Map<string, React.ComponentType<any>>
): React.ReactElement {
  // Handle nested layout objects
  if (typeof layout === 'object' && layout.type) {
    return renderNestedLayout(layout, element, index, context, componentRegistry);
  }

  // Handle simple string layout types
  const layoutClasses: Record<string, string> = {
    default: 'sdui-layout-default',
    full_width: 'sdui-layout-full-width',
    two_column: 'sdui-layout-two-column',
    dashboard: 'sdui-layout-dashboard',
    single_column: 'sdui-layout-single-column',
    grid: 'sdui-layout-grid',
    flex: 'sdui-layout-flex',
    nested: 'sdui-layout-nested',
  };

  const className = layoutClasses[layout as string] || layoutClasses.default;

  return React.createElement(
    'div',
    {
      key: `layout-${index}`,
      className,
      'data-layout': layout,
    },
    element
  );
}

/**
 * Render nested layout with recursive child rendering
 */
function renderNestedLayout(
  layout: { type: string; children?: any[]; props?: any },
  primaryElement: React.ReactElement,
  index: number,
  context?: RenderContext,
  componentRegistry?: Map<string, React.ComponentType<any>>
): React.ReactElement {
  const { type, children, props } = layout;

  // Render child sections recursively
  const renderedChildren = children
    ? children.map((child, childIndex) => {
        if (child.type === 'component' || child.type === 'layout.directive') {
          return renderSection(child, `${index}-${childIndex}` as any, context, componentRegistry);
        }
        return null;
      }).filter(Boolean)
    : [];

  // Combine primary element with rendered children
  const allChildren = [primaryElement, ...renderedChildren];

  return React.createElement(
    'div',
    {
      key: `nested-layout-${index}`,
      className: `sdui-nested-layout sdui-nested-layout-${type}`,
      'data-layout-type': type,
      ...props,
    },
    allChildren
  );
}

/**
 * Render error fallback with error boundary
 */
function renderErrorFallback(
  section: SDUISection,
  error: Error,
  index: number
): React.ReactElement {
  // Log error for monitoring
  logger.error('SDUI render error', {
    component: (section as any).component,
    sectionType: section.type,
    error: error.message,
    stack: error.stack,
  });

  return React.createElement(
    'div',
    {
      key: `error-${index}`,
      className: 'sdui-error-fallback',
      'data-error-type': 'render-failure',
      'data-component': (section as any).component,
    },
    React.createElement(
      'div',
      { className: 'sdui-error-header' },
      React.createElement('h3', null, '⚠️ Component Render Failed')
    ),
    React.createElement(
      'div',
      { className: 'sdui-error-details' },
      React.createElement('p', { className: 'sdui-error-message' }, error.message),
      process.env.NODE_ENV === 'development' &&
        React.createElement(
          'details',
          { className: 'sdui-error-debug' },
          React.createElement('summary', null, 'Debug Information'),
          React.createElement(
            'pre',
            { className: 'sdui-error-section' },
            JSON.stringify(section, null, 2)
          ),
          React.createElement(
            'pre',
            { className: 'sdui-error-stack' },
            error.stack
          )
        )
    )
  );
}

/**
 * Render missing component placeholder
 */
function renderMissingComponent(
  componentName: string,
  index: number
): React.ReactElement {
  return React.createElement(
    'div',
    {
      key: `missing-${index}`,
      className: 'sdui-missing-component',
    },
    React.createElement('h3', null, 'Component Not Found'),
    React.createElement('p', null, `Component "${componentName}" is not registered`)
  );
}

/**
 * Validate page before rendering
 */
export function validatePageForRendering(page: SDUIPageDefinition): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!page.sections || page.sections.length === 0) {
    errors.push('Page must have at least one section');
  }

  for (const section of page.sections) {
    if (section.type === 'layout.directive') {
      if (!section.intent) {
        errors.push('Layout directive must have an intent');
      }
      if (!section.component) {
        errors.push('Layout directive must specify a component');
      }
    } else if (section.type === 'component') {
      if (!section.component) {
        errors.push('Component section must specify a component');
      }
    } else {
      errors.push(`Unknown section type: ${(section as any).type}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Extract metadata from page
 */
export function extractPageMetadata(page: SDUIPageDefinition): {
  componentCount: number;
  directiveCount: number;
  hasHydration: boolean;
  cacheEnabled: boolean;
} {
  const componentCount = page.sections.filter((s) => s.type === 'component').length;
  const directiveCount = page.sections.filter((s) => s.type === 'layout.directive').length;
  
  const hasHydration = page.sections.some(
    (s) => s.type === 'component' && s.hydrateWith && s.hydrateWith.length > 0
  );

  const cacheEnabled = !!page.metadata?.cacheTtlSeconds;

  return {
    componentCount,
    directiveCount,
    hasHydration,
    cacheEnabled,
  };
}

export default renderPage;
