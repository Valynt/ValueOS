/**
 * useInteractionRouter Hook
 *
 * Extracted from ChatCanvasLayout.tsx (lines 1235-1616)
 * Handles command processing, keyboard shortcuts, and modal triggers
 *
 * Responsibilities:
 * - Command handling (⌘K, keyboard shortcuts)
 * - Starter actions (upload, analyze, import)
 * - Modal triggers
 * - User interaction routing
 */

import { useCallback, useEffect } from 'react';
import { ValueCase } from '../services/ValueCaseService';
import { WorkflowState } from '../repositories/WorkflowStateRepository';
import { ExtractedNotes } from '../components/Modals';
import { logger } from '../lib/logger';

export interface InteractionRouterReturn {
  // Command handling
  isCommandBarOpen: boolean;
  openCommandBar: () => void;
  closeCommandBar: () => void;
  handleCommand: (query: string) => Promise<void>;

  // Keyboard shortcuts
  keyboardBindings: KeyboardShortcutMap;

  // Starter actions
  handleStarterAction: (action: string, data?: { files?: File[] }) => void;

  // Modal triggers
  modalTriggers: {
    newCase: () => void;
    uploadNotes: (file?: File) => void;
    analyzeEmail: () => void;
    importCRM: () => void;
    uploadCall: () => void;
  };

  // Modal state setters (for parent component)
  setModalStates: {
    setIsNewCaseModalOpen: (open: boolean) => void;
    setIsUploadNotesModalOpen: (open: boolean) => void;
    setIsEmailAnalysisModalOpen: (open: boolean) => void;
    setIsCRMImportModalOpen: (open: boolean) => void;
    setIsSalesCallModalOpen: (open: boolean) => void;
  };
}

export interface KeyboardShortcutMap {
  'cmd+k': () => void;
  'cmd+z': () => void;
  'cmd+shift+z': () => void;
}

export interface ModalStateSetters {
  setIsNewCaseModalOpen: (open: boolean) => void;
  setIsUploadNotesModalOpen: (open: boolean) => void;
  setIsEmailAnalysisModalOpen: (open: boolean) => void;
  setIsCRMImportModalOpen: (open: boolean) => void;
  setIsSalesCallModalOpen: (open: boolean) => void;
}

export const useInteractionRouter = (
  selectedCaseId: string | null,
  workflowState: WorkflowState | null,
  selectedCase: ValueCase | null,
  onCreateCase: (company: string, website?: string) => Promise<void>,
  onNotesComplete: (notes: ExtractedNotes) => void,
  modalStateSetters: ModalStateSetters,
  canvasOperations: {
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
  }
): InteractionRouterReturn => {
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);

  // Modal state setters from parent
  const {
    setIsNewCaseModalOpen,
    setIsUploadNotesModalOpen,
    setIsEmailAnalysisModalOpen,
    setIsCRMImportModalOpen,
    setIsSalesCallModalOpen,
  } = modalStateSetters;

  // Open command bar
  const openCommandBar = useCallback(() => {
    setIsCommandBarOpen(true);
  }, []);

  // Close command bar
  const closeCommandBar = useCallback(() => {
    setIsCommandBarOpen(false);
  }, []);

  // Handle command submission
  const handleCommand = useCallback(async (query: string) => {
    if (!selectedCaseId) {
      // No case selected, prompt user to create one first
      setIsNewCaseModalOpen(true);
      return;
    }

    // Initialize workflow state if not set
    if (!workflowState && selectedCase) {
      // This would be handled by the parent component
      logger.info('Command requires workflow state initialization');
    }

    // This would delegate to the streaming orchestrator
    logger.info('Processing command', { query, caseId: selectedCaseId });

    // Close command bar after processing
    closeCommandBar();
  }, [selectedCaseId, workflowState, selectedCase, closeCommandBar]);

  // Handle starter card actions
  const handleStarterAction = useCallback(
    (action: string, data?: { files?: File[] }) => {
      switch (action) {
        case "upload_notes":
          const file = data?.files?.[0];
          if (file) {
            // Set pending file and open modal
            setIsUploadNotesModalOpen(true);
          }
          break;
        case "analyze_email":
          setIsEmailAnalysisModalOpen(true);
          break;
        case "import_crm":
          setIsCRMImportModalOpen(true);
          break;
        case "upload_call":
          setIsSalesCallModalOpen(true);
          break;
        default:
          setIsNewCaseModalOpen(true);
      }
    },
    [
      setIsNewCaseModalOpen,
      setIsUploadNotesModalOpen,
      setIsEmailAnalysisModalOpen,
      setIsCRMImportModalOpen,
      setIsSalesCallModalOpen,
    ]
  );

  // Modal trigger functions
  const modalTriggers = {
    newCase: useCallback(() => setIsNewCaseModalOpen(true), [setIsNewCaseModalOpen]),
    uploadNotes: useCallback((file?: File) => {
      // This would handle file preparation
      setIsUploadNotesModalOpen(true);
    }, [setIsUploadNotesModalOpen]),
    analyzeEmail: useCallback(() => setIsEmailAnalysisModalOpen(true), [setIsEmailAnalysisModalOpen]),
    importCRM: useCallback(() => setIsCRMImportModalOpen(true), [setIsCRMImportModalOpen]),
    uploadCall: useCallback(() => setIsSalesCallModalOpen(true), [setIsSalesCallModalOpen]),
  };

  // Keyboard shortcuts
  const keyboardBindings: KeyboardShortcutMap = {
    'cmd+k': openCommandBar,
    'cmd+z': () => {
      if (canvasOperations.canUndo()) {
        canvasOperations.undo();
      }
    },
    'cmd+shift+z': () => {
      if (canvasOperations.canRedo()) {
        canvasOperations.redo();
      }
    },
  };

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command/Ctrl key combinations
      if ((e.metaKey || e.ctrlKey)) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            openCommandBar();
            return;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              if (canvasOperations.canRedo()) {
                canvasOperations.redo();
              }
            } else {
              if (canvasOperations.canUndo()) {
                canvasOperations.undo();
              }
            }
            return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCommandBar, canvasOperations]);

  // Set modal state setters for parent component
  const setModalStates = modalStateSetters;

  return {
    // Command handling
    isCommandBarOpen,
    openCommandBar,
    closeCommandBar,
    handleCommand,

    // Keyboard shortcuts
    keyboardBindings,

    // Starter actions
    handleStarterAction,

    // Modal triggers
    modalTriggers,

    // Modal state setters
    setModalStates,
  };
};
