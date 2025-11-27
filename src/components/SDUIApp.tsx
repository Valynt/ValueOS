/**
 * SDUI App Component
 * 
 * Main application component that uses SDUI engine to render UI.
 * Replaces traditional React routing with server-driven UI composition.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { renderPage } from '../sdui/renderPage';
import { SDUIPageDefinition } from '../sdui/schema';
import { canvasSchemaService } from '../services/CanvasSchemaService';
import { actionRouter } from '../services/ActionRouter';
import {
  WorkspaceContext,
  CanonicalAction,
  ActionContext,
} from '../types/sdui-integration';
import { LifecycleStage } from '../types/workflow';
import { logger } from '../lib/logger';

/**
 * SDUI App Props
 */
export interface SDUIAppProps {
  workspaceId: string;
  userId: string;
  initialStage?: LifecycleStage;
  sessionId?: string;
  debug?: boolean;
}

/**
 * Loading view component
 */
const LoadingView: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading workspace...</p>
    </div>
  </div>
);

/**
 * Error view component
 */
const ErrorView: React.FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
      <div className="text-red-600 mb-4">
        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">
        Failed to Load Workspace
      </h2>
      <p className="text-gray-600 mb-4 text-center">{error}</p>
      <button
        onClick={onRetry}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Retry
      </button>
    </div>
  </div>
);

/**
 * SDUI App Component
 */
export const SDUIApp: React.FC<SDUIAppProps> = ({
  workspaceId,
  userId,
  initialStage = 'opportunity',
  sessionId,
  debug = false,
}) => {
  const [schema, setSchema] = useState<SDUIPageDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<LifecycleStage>(initialStage);

  /**
   * Load schema for workspace
   */
  const loadSchema = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('Loading SDUI schema', { workspaceId, currentStage });

      const context: WorkspaceContext = {
        workspaceId,
        userId,
        lifecycleStage: currentStage,
        sessionId,
      };

      const newSchema = await canvasSchemaService.generateSchema(workspaceId, context);
      setSchema(newSchema);

      logger.info('SDUI schema loaded', {
        workspaceId,
        componentCount: newSchema.sections.length,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to load SDUI schema', { workspaceId, error: errorMessage });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, userId, currentStage, sessionId]);

  /**
   * Handle action from UI
   */
  const handleAction = useCallback(
    async (action: CanonicalAction) => {
      try {
        logger.info('Handling action', { actionType: action.type, workspaceId });

        const context: ActionContext = {
          workspaceId,
          userId,
          sessionId,
          timestamp: Date.now(),
        };

        // Route action through ActionRouter
        const result = await actionRouter.routeAction(action, context);

        if (!result.success) {
          logger.error('Action failed', {
            actionType: action.type,
            error: result.error,
          });

          // Show error to user
          // TODO: Implement error notification system
          alert(`Action failed: ${result.error}`);
          return;
        }

        logger.info('Action completed', { actionType: action.type });

        // Handle stage navigation
        if (action.type === 'navigateToStage') {
          setCurrentStage(action.stage);
          return;
        }

        // Update schema based on action result
        const newSchema = await canvasSchemaService.updateSchema(
          workspaceId,
          action,
          result
        );
        setSchema(newSchema);

        logger.info('Schema updated after action', {
          actionType: action.type,
          componentCount: newSchema.sections.length,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Failed to handle action', {
          actionType: action.type,
          error: errorMessage,
        });

        // Show error to user
        alert(`Failed to handle action: ${errorMessage}`);
      }
    },
    [workspaceId, userId, sessionId]
  );

  /**
   * Load schema on mount and when stage changes
   */
  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  /**
   * Render loading state
   */
  if (loading) {
    return <LoadingView />;
  }

  /**
   * Render error state
   */
  if (error) {
    return <ErrorView error={error} onRetry={loadSchema} />;
  }

  /**
   * Render schema not loaded state
   */
  if (!schema) {
    return <LoadingView />;
  }

  /**
   * Render SDUI page
   */
  try {
    const renderResult = renderPage(schema, {
      debug,
      onRenderError: (error, componentName) => {
        logger.error('Component render error', {
          componentName,
          error: error.message,
        });
      },
      onHydrationError: (error, endpoint) => {
        logger.error('Hydration error', {
          endpoint,
          error: error.message,
        });
      },
      onComponentRender: debug
        ? (componentName, props) => {
            logger.debug('Component rendered', { componentName, props });
          }
        : undefined,
    });

    return (
      <div className="sdui-app">
        {renderResult.element}
      </div>
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Failed to render SDUI page', { error: errorMessage });
    return <ErrorView error={errorMessage} onRetry={loadSchema} />;
  }
};

export default SDUIApp;
