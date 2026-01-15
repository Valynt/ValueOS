/**
 * Component Fallback UI
 * 
 * Provides graceful degradation when SDUI components fail to load
 */

import React from 'react';
import { SDUIComponentSection } from '../schema';

interface ComponentFallbackProps {
  section: SDUIComponentSection;
  error?: Error;
  onRetry?: () => void;
}

export function ComponentFallback({ section, error, onRetry }: ComponentFallbackProps) {
  return (
    <div className="component-fallback" data-component={section.component}>
      <div className="component-fallback__content">
        <div className="component-fallback__icon">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        
        <h4 className="component-fallback__title">
          Component Unavailable
        </h4>
        
        <p className="component-fallback__message">
          The <strong>{section.component}</strong> component could not be loaded.
        </p>

        {error && process.env.NODE_ENV === 'development' && (
          <details className="component-fallback__details">
            <summary>Technical Details</summary>
            <pre>{error.message}</pre>
          </details>
        )}

        {onRetry && (
          <button
            onClick={onRetry}
            className="component-fallback__retry"
            type="button"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Data Binding Fallback
 */
export function DataBindingFallback({ path, error }: { path: string; error?: Error }) {
  return (
    <div className="data-binding-fallback">
      <span className="data-binding-fallback__icon">⚠️</span>
      <span className="data-binding-fallback__text">
        Data unavailable: <code>{path}</code>
      </span>
      {error && process.env.NODE_ENV === 'development' && (
        <span className="data-binding-fallback__error">
          {error.message}
        </span>
      )}
    </div>
  );
}

/**
 * Schema Validation Fallback
 */
export function SchemaValidationFallback({ 
  component, 
  errors 
}: { 
  component: string; 
  errors: string[] 
}) {
  return (
    <div className="schema-validation-fallback">
      <div className="schema-validation-fallback__header">
        <span className="schema-validation-fallback__icon">🔍</span>
        <h4>Invalid Component Data</h4>
      </div>
      
      <p>
        The <strong>{component}</strong> component received invalid data.
      </p>

      {process.env.NODE_ENV === 'development' && (
        <details className="schema-validation-fallback__errors">
          <summary>Validation Errors ({errors.length})</summary>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Loading Fallback
 */
export function LoadingFallback({ component }: { component?: string }) {
  return (
    <div className="loading-fallback">
      <div className="loading-fallback__spinner" />
      <span className="loading-fallback__text">
        Loading {component || 'component'}...
      </span>
    </div>
  );
}
