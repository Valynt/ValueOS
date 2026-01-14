/**
 * useModalManager Hook
 *
 * Modal state management for ChatCanvasLayout.
 * Handles opening, closing, and state coordination of all modals.
 */

import { useState, useCallback } from "react";
import { logger } from "../../../lib/logger";

export type ModalType =
  | "upload"
  | "emailAnalysis"
  | "crmImport"
  | "salesCall"
  | "export"
  | "crmSync";

export interface ModalState {
  upload: boolean;
  emailAnalysis: boolean;
  crmImport: boolean;
  salesCall: boolean;
  export: boolean;
  crmSync: boolean;
}

export interface UseModalManagerReturn {
  // State
  modals: ModalState;

  // Individual modal states
  showUploadModal: boolean;
  showEmailModal: boolean;
  showCRMModal: boolean;
  showSalesCallModal: boolean;
  showExportModal: boolean;
  showCRMSyncModal: boolean;

  // Actions
  openModal: (type: ModalType) => void;
  closeModal: (type: ModalType) => void;
  closeAllModals: () => void;
  toggleModal: (type: ModalType) => void;

  // Computed
  hasOpenModal: boolean;
  openModalCount: number;
}

export function useModalManager(): UseModalManagerReturn {
  const [modals, setModals] = useState<ModalState>({
    upload: false,
    emailAnalysis: false,
    crmImport: false,
    salesCall: false,
    export: false,
    crmSync: false,
  });

  const openModal = useCallback((type: ModalType) => {
    logger.debug("Opening modal", { type });
    setModals((prev) => ({ ...prev, [type]: true }));
  }, []);

  const closeModal = useCallback((type: ModalType) => {
    logger.debug("Closing modal", { type });
    setModals((prev) => ({ ...prev, [type]: false }));
  }, []);

  const closeAllModals = useCallback(() => {
    logger.debug("Closing all modals");
    setModals({
      upload: false,
      emailAnalysis: false,
      crmImport: false,
      salesCall: false,
      export: false,
      crmSync: false,
    });
  }, []);

  const toggleModal = useCallback((type: ModalType) => {
    setModals((prev) => {
      const newState = !prev[type];
      logger.debug("Toggling modal", { type, newState });
      return { ...prev, [type]: newState };
    });
  }, []);

  // Computed values
  const hasOpenModal = Object.values(modals).some(Boolean);
  const openModalCount = Object.values(modals).filter(Boolean).length;

  return {
    // State
    modals,

    // Individual modal states (for convenience)
    showUploadModal: modals.upload,
    showEmailModal: modals.emailAnalysis,
    showCRMModal: modals.crmImport,
    showSalesCallModal: modals.salesCall,
    showExportModal: modals.export,
    showCRMSyncModal: modals.crmSync,

    // Actions
    openModal,
    closeModal,
    closeAllModals,
    toggleModal,

    // Computed
    hasOpenModal,
    openModalCount,
  };
}
