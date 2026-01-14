/**
 * useInteractionRouter Hook
 *
 * Command and input handling for ChatCanvasLayout.
 * Routes user interactions to appropriate handlers and manages command state.
 */

import { useCallback } from "react";
import { ExtractedNotes } from "../../Modals";
import { EmailAnalysis } from "../../../services/EmailAnalysisService";
import { MappedValueCase } from "../../../services/CRMFieldMapper";
import { CRMDeal } from "../../../mcp-crm/types";
import { CallAnalysis } from "../../../services/CallAnalysisService";
import { valueCaseService } from "../../../services/ValueCaseService";
import { toUserFriendlyError } from "../../../utils/errorHandling";
import { useToast } from "../../Common/Toast";
import { logger } from "../../../lib/logger";

export interface UseInteractionRouterOptions {
  onCaseSelect?: (caseId: string) => void;
  readOnly?: boolean;
}

export interface UseInteractionRouterReturn {
  // Upload handlers
  handleUploadNotes: (notes: ExtractedNotes) => Promise<void>;

  // Analysis handlers
  handleEmailAnalysis: (analysis: EmailAnalysis) => Promise<void>;
  handleCRMImport: (deals: CRMDeal[]) => Promise<void>;
  handleSalesCallAnalysis: (analysis: CallAnalysis) => Promise<void>;

  // Export handlers
  handleExport: (caseId: string) => Promise<void>;
  handleCRMSync: (caseId: string) => Promise<void>;
}

export function useInteractionRouter(
  options: UseInteractionRouterOptions = {}
): UseInteractionRouterReturn {
  const { onCaseSelect, readOnly = false } = options;
  const { toast } = useToast();

  const handleUploadNotes = useCallback(
    async (notes: ExtractedNotes) => {
      if (readOnly) {
        toast({
          title: "Read-only mode",
          description: "Cannot upload notes in read-only mode.",
          variant: "destructive",
        });
        return;
      }

      try {
        logger.info("Uploading notes", { title: notes.title });

        const newCase = await valueCaseService.createValueCase({
          name: notes.title,
          description: notes.summary,
          metadata: { source: "upload", notes },
        });

        logger.info("Created new case from notes", { caseId: newCase.id });

        toast({
          title: "Notes uploaded successfully",
          description: "New case created from your notes.",
        });

        onCaseSelect?.(newCase.id);
      } catch (err) {
        const friendlyError = toUserFriendlyError(err);
        logger.error("Failed to upload notes", { error: friendlyError });

        toast({
          title: "Upload failed",
          description: friendlyError,
          variant: "destructive",
        });
        throw err;
      }
    },
    [onCaseSelect, readOnly, toast]
  );

  const handleEmailAnalysis = useCallback(
    async (analysis: EmailAnalysis) => {
      if (readOnly) {
        toast({
          title: "Read-only mode",
          description: "Cannot perform email analysis in read-only mode.",
          variant: "destructive",
        });
        return;
      }

      try {
        logger.info("Processing email analysis", {
          emailCount: analysis.emails?.length,
        });

        // Create case from email analysis
        const newCase = await valueCaseService.createValueCase({
          name: `Email Analysis - ${new Date().toLocaleDateString()}`,
          description: `Analysis of ${analysis.emails?.length || 0} emails`,
          metadata: { source: "email_analysis", analysis },
        });

        logger.info("Created case from email analysis", { caseId: newCase.id });

        toast({
          title: "Email analysis complete",
          description: "New case created from email analysis.",
        });

        onCaseSelect?.(newCase.id);
      } catch (err) {
        const friendlyError = toUserFriendlyError(err);
        logger.error("Failed to process email analysis", {
          error: friendlyError,
        });

        toast({
          title: "Email analysis failed",
          description: friendlyError,
          variant: "destructive",
        });
        throw err;
      }
    },
    [onCaseSelect, readOnly, toast]
  );

  const handleCRMImport = useCallback(
    async (deals: CRMDeal[]) => {
      if (readOnly) {
        toast({
          title: "Read-only mode",
          description: "Cannot import CRM data in read-only mode.",
          variant: "destructive",
        });
        return;
      }

      try {
        logger.info("Processing CRM import", { dealCount: deals.length });

        // Create case from CRM data
        const newCase = await valueCaseService.createValueCase({
          name: `CRM Import - ${new Date().toLocaleDateString()}`,
          description: `Analysis of ${deals.length} CRM deals`,
          metadata: { source: "crm_import", deals },
        });

        logger.info("Created case from CRM import", { caseId: newCase.id });

        toast({
          title: "CRM data imported",
          description: "New case created from CRM analysis.",
        });

        onCaseSelect?.(newCase.id);
      } catch (err) {
        const friendlyError = toUserFriendlyError(err);
        logger.error("Failed to process CRM import", { error: friendlyError });

        toast({
          title: "CRM import failed",
          description: friendlyError,
          variant: "destructive",
        });
        throw err;
      }
    },
    [onCaseSelect, readOnly, toast]
  );

  const handleSalesCallAnalysis = useCallback(
    async (analysis: CallAnalysis) => {
      if (readOnly) {
        toast({
          title: "Read-only mode",
          description: "Cannot perform call analysis in read-only mode.",
          variant: "destructive",
        });
        return;
      }

      try {
        logger.info("Processing sales call analysis", {
          callId: analysis.callId,
        });

        // Create case from call analysis
        const newCase = await valueCaseService.createValueCase({
          name: `Call Analysis - ${analysis.callId}`,
          description: analysis.summary,
          metadata: { source: "sales_call", analysis },
        });

        logger.info("Created case from call analysis", { caseId: newCase.id });

        toast({
          title: "Call analysis complete",
          description: "New case created from call analysis.",
        });

        onCaseSelect?.(newCase.id);
      } catch (err) {
        const friendlyError = toUserFriendlyError(err);
        logger.error("Failed to process call analysis", {
          error: friendlyError,
        });

        toast({
          title: "Call analysis failed",
          description: friendlyError,
          variant: "destructive",
        });
        throw err;
      }
    },
    [onCaseSelect, readOnly, toast]
  );

  const handleExport = useCallback(
    async (caseId: string) => {
      if (readOnly) {
        toast({
          title: "Read-only mode",
          description: "Cannot export in read-only mode.",
          variant: "destructive",
        });
        return;
      }

      try {
        logger.info("Exporting case", { caseId });

        // Export logic will be handled by ExportPreviewModal
        toast({
          title: "Export initiated",
          description: "Preparing export preview...",
        });
      } catch (err) {
        const friendlyError = toUserFriendlyError(err);
        logger.error("Failed to initiate export", {
          caseId,
          error: friendlyError,
        });

        toast({
          title: "Export failed",
          description: friendlyError,
          variant: "destructive",
        });
        throw err;
      }
    },
    [readOnly, toast]
  );

  const handleCRMSync = useCallback(
    async (caseId: string) => {
      if (readOnly) {
        toast({
          title: "Read-only mode",
          description: "Cannot sync with CRM in read-only mode.",
          variant: "destructive",
        });
        return;
      }

      try {
        logger.info("Initiating CRM sync", { caseId });

        // CRM sync logic will be handled by CRMSyncModal
        toast({
          title: "CRM sync initiated",
          description: "Preparing CRM synchronization...",
        });
      } catch (err) {
        const friendlyError = toUserFriendlyError(err);
        logger.error("Failed to initiate CRM sync", {
          caseId,
          error: friendlyError,
        });

        toast({
          title: "CRM sync failed",
          description: friendlyError,
          variant: "destructive",
        });
        throw err;
      }
    },
    [readOnly, toast]
  );

  return {
    handleUploadNotes,
    handleEmailAnalysis,
    handleCRMImport,
    handleSalesCallAnalysis,
    handleExport,
    handleCRMSync,
  };
}
