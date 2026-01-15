/**
 * useCanvasController Hook
 *
 * State coordination and canvas management for ChatCanvasLayout.
 * Handles case selection, loading states, errors, and SDUI page rendering.
 */

import { useState, useCallback } from "react";
import { SDUIPageDefinition } from '@sdui/schema";
import { renderPage } from '@sdui/renderPage";
import { valueCaseService } from "../../../services/ValueCaseService";
import { toUserFriendlyError } from "../../../utils/errorHandling";
import { useCanvasStore } from '@sdui/canvas/CanvasStore";
import { logger } from "../../../lib/logger";

export interface ValueCase {
  id: string;
  name: string;
  description?: string;
  status: "in_progress" | "completed" | "archived";
  created_at: string;
  updated_at: string;
  workflow_state?: any; // WorkflowState
  metadata?: Record<string, any>;
}

export interface UseCanvasControllerOptions {
  onCaseSelect?: (caseId: string) => void;
  readOnly?: boolean;
}

export interface UseCanvasControllerReturn {
  // State
  selectedCase: ValueCase | null;
  isLoading: boolean;
  error: string | null;
  currentPage: SDUIPageDefinition | null;
  isRendering: boolean;

  // Actions
  selectCase: (caseId: string) => Promise<void>;
  setError: (error: string | null) => void;
  setCurrentPage: (page: SDUIPageDefinition | null) => void;
  setRendering: (rendering: boolean) => void;
}

export function useCanvasController(
  options: UseCanvasControllerOptions = {}
): UseCanvasControllerReturn {
  const { onCaseSelect, readOnly = false } = options;

  // Core state
  const [selectedCase, setSelectedCase] = useState<ValueCase | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<SDUIPageDefinition | null>(
    null
  );
  const [isRendering, setIsRendering] = useState(false);

  // Canvas store integration
  const canvasStore = useCanvasStore();

  const selectCase = useCallback(
    async (caseId: string) => {
      try {
        setIsLoading(true);
        setError(null);
        setIsRendering(true);

        logger.info("Selecting case", { caseId });

        const valueCase = await valueCaseService.getValueCase(caseId);
        setSelectedCase(valueCase);

        if (valueCase.workflow_state) {
          const page = await renderPage(valueCase.workflow_state);
          setCurrentPage(page);
          logger.info("Rendered SDUI page for case", {
            caseId,
            pageId: page?.id,
          });
        } else {
          setCurrentPage(null);
          logger.info("No workflow state for case, clearing page", { caseId });
        }

        onCaseSelect?.(caseId);
      } catch (err) {
        const friendlyError = toUserFriendlyError(err);
        setError(friendlyError);
        logger.error("Failed to select case", { caseId, error: friendlyError });
        throw err; // Re-throw for error handling
      } finally {
        setIsLoading(false);
        setIsRendering(false);
      }
    },
    [onCaseSelect]
  );

  const setRendering = useCallback((rendering: boolean) => {
    setIsRendering(rendering);
  }, []);

  return {
    // State
    selectedCase,
    isLoading,
    error,
    currentPage,
    isRendering,

    // Actions
    selectCase,
    setError,
    setCurrentPage,
    setRendering,
  };
}
