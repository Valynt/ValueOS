/**
 * useModalManager Hook
 *
 * Extracted from ChatCanvasLayout.tsx (lines 532-579, 1974-2122)
 * Handles modal state coordination and lifecycle management
 *
 * Responsibilities:
 * - Modal state coordination
 * - Modal lifecycle management
 * - Modal data handling
 * - Modal orchestration
 */

import { useState, useCallback } from 'react';
import { ExtractedNotes } from '../components/Modals';
import { logger } from '../lib/logger';

export interface ModalManagerReturn {
  // Modal state
  modals: {
    newCase: { isOpen: boolean; data: NewCaseData };
    uploadNotes: { isOpen: boolean; data: UploadNotesData };
    emailAnalysis: { isOpen: boolean; data: EmailAnalysisData };
    crmImport: { isOpen: boolean; data: CRMImportData };
    salesCall: { isOpen: boolean; data: SalesCallData };
    betaHub: { isOpen: boolean; data: BetaHubData };
    sync: { isOpen: boolean; data: SyncData };
    export: { isOpen: boolean; data: ExportData };
  };

  // Actions
  openModal: <K extends keyof ModalManagerReturn['modals']>(modal: K, data?: ModalManagerReturn['modals'][K]['data']) => void;
  closeModal: <K extends keyof ModalManagerReturn['modals']>(modal: K) => void;
  updateModalData: <K extends keyof ModalManagerReturn['modals']>(modal: K, data: Partial<ModalManagerReturn['modals'][K]['data']>) => void;
  closeAllModals: () => void;

  // Modal component render props
  ModalComponents: React.ComponentType<any>[];
}

// Modal data interfaces
export interface NewCaseData {
  company: string;
  website: string;
}

export interface UploadNotesData {
  pendingFile: File | null;
}

export interface EmailAnalysisData {
  // No specific data needed
}

export interface CRMImportData {
  // No specific data needed
}

export interface SalesCallData {
  // No specific data needed
}

export interface BetaHubData {
  // No specific data needed
}

export interface SyncData {
  // No specific data needed
}

export interface ExportData {
  // No specific data needed
}

export const useModalManager = (): ModalManagerReturn => {
  // New case modal state
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [newCaseCompany, setNewCaseCompany] = useState("");
  const [newCaseWebsite, setNewCaseWebsite] = useState("");

  // Upload notes modal state
  const [isUploadNotesModalOpen, setIsUploadNotesModalOpen] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);

  // Email analysis modal state
  const [isEmailAnalysisModalOpen, setIsEmailAnalysisModalOpen] = useState(false);

  // CRM import modal state
  const [isCRMImportModalOpen, setIsCRMImportModalOpen] = useState(false);

  // Sales call modal state
  const [isSalesCallModalOpen, setIsSalesCallModalOpen] = useState(false);

  // Beta hub modal state
  const [isBetaHubOpen, setIsBetaHubOpen] = useState(false);

  // Sync & Export modal state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Consolidated modal state
  const modals = {
    newCase: {
      isOpen: isNewCaseModalOpen,
      data: { company: newCaseCompany, website: newCaseWebsite }
    },
    uploadNotes: {
      isOpen: isUploadNotesModalOpen,
      data: { pendingFile: pendingUploadFile }
    },
    emailAnalysis: {
      isOpen: isEmailAnalysisModalOpen,
      data: {}
    },
    crmImport: {
      isOpen: isCRMImportModalOpen,
      data: {}
    },
    salesCall: {
      isOpen: isSalesCallModalOpen,
      data: {}
    },
    betaHub: {
      isOpen: isBetaHubOpen,
      data: {}
    },
    sync: {
      isOpen: isSyncModalOpen,
      data: {}
    },
    export: {
      isOpen: isExportModalOpen,
      data: {}
    },
  };

  // Open modal with optional data
  const openModal = useCallback(<K extends keyof typeof modals>(
    modal: K,
    data?: typeof modals[K]['data']
  ) => {
    switch (modal) {
      case 'newCase':
        if (data) {
          setNewCaseCompany(data.company || "");
          setNewCaseWebsite(data.website || "");
        }
        setIsNewCaseModalOpen(true);
        break;

      case 'uploadNotes':
        if (data) {
          setPendingUploadFile(data.pendingFile || null);
        }
        setIsUploadNotesModalOpen(true);
        break;

      case 'emailAnalysis':
        setIsEmailAnalysisModalOpen(true);
        break;

      case 'crmImport':
        setIsCRMImportModalOpen(true);
        break;

      case 'salesCall':
        setIsSalesCallModalOpen(true);
        break;

      case 'betaHub':
        setIsBetaHubOpen(true);
        break;

      case 'sync':
        setIsSyncModalOpen(true);
        break;

      case 'export':
        setIsExportModalOpen(true);
        break;
    }

    logger.info('Modal opened', { modal, hasData: !!data });
  }, []);

  // Close modal
  const closeModal = useCallback(<K extends keyof typeof modals>(modal: K) => {
    switch (modal) {
      case 'newCase':
        setIsNewCaseModalOpen(false);
        setNewCaseCompany("");
        setNewCaseWebsite("");
        break;

      case 'uploadNotes':
        setIsUploadNotesModalOpen(false);
        setPendingUploadFile(null);
        break;

      case 'emailAnalysis':
        setIsEmailAnalysisModalOpen(false);
        break;

      case 'crmImport':
        setIsCRMImportModalOpen(false);
        break;

      case 'salesCall':
        setIsSalesCallModalOpen(false);
        break;

      case 'betaHub':
        setIsBetaHubOpen(false);
        break;

      case 'sync':
        setIsSyncModalOpen(false);
        break;

      case 'export':
        setIsExportModalOpen(false);
        break;
    }

    logger.info('Modal closed', { modal });
  }, []);

  // Update modal data
  const updateModalData = useCallback(<K extends keyof typeof modals>(
    modal: K,
    data: Partial<typeof modals[K]['data']>
  ) => {
    switch (modal) {
      case 'newCase':
        if ('company' in data) setNewCaseCompany(data.company || "");
        if ('website' in data) setNewCaseWebsite(data.website || "");
        break;

      case 'uploadNotes':
        if ('pendingFile' in data) setPendingUploadFile(data.pendingFile || null);
        break;

      // Other modals don't have updatable data
    }

    logger.info('Modal data updated', { modal, data });
  }, []);

  // Close all modals
  const closeAllModals = useCallback(() => {
    setIsNewCaseModalOpen(false);
    setIsUploadNotesModalOpen(false);
    setIsEmailAnalysisModalOpen(false);
    setIsCRMImportModalOpen(false);
    setIsSalesCallModalOpen(false);
    setIsBetaHubOpen(false);
    setIsSyncModalOpen(false);
    setIsExportModalOpen(false);

    // Reset all data
    setNewCaseCompany("");
    setNewCaseWebsite("");
    setPendingUploadFile(null);

    logger.info('All modals closed');
  }, []);

  // Modal component render props would be implemented by the parent component
  // This is a placeholder for the structure
  const ModalComponents: React.ComponentType<any>[] = [];

  return {
    // Modal state
    modals,

    // Actions
    openModal,
    closeModal,
    updateModalData,
    closeAllModals,

    // Modal components (render props)
    ModalComponents,
  };
};
