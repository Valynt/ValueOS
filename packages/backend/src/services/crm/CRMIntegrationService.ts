/**
 * CRM Integration Service
 *
 * Orchestrates the synchronization of Value Case data back to the CRM.
 * Currently supports HubSpot via the HubSpot Module Note API.
 */

import { HubSpotModule } from "@mcp/crm/modules/HubSpotModule";
import { CRMDeal } from "@mcp/crm/types";

import { logger } from "../../lib/logger.js"
import { integrationControlService } from "../IntegrationControlService.js"

// Create a singleton instance for now, assuming connection management is handled globally or we pass it
const crmModule = new HubSpotModule();

export interface CRMSyncResult {
  success: boolean;
  message: string;
}

interface ValueHypothesis {
  title: string;
  description: string;
  confidence: number;
}

interface KeyMetric {
  label: string;
  value: string | number;
  trend: string;
}

interface AnalysisData {
  analysisSummary?: string;
  valueHypotheses?: ValueHypothesis[];
  keyMetrics?: KeyMetric[];
  [key: string]: unknown;
}

export class CRMIntegrationService {
  /**
   * Fetches deals from the connected CRM
   */
  async fetchDeals(tenantId: string): Promise<CRMDeal[]> {
    const enabled = await integrationControlService.areIntegrationsEnabled(tenantId);
    if (!enabled) {
      logger.warn("Integrations are disabled for this tenant", { tenantId });
      return [];
    }

    // Check connection status
    const isConnected = crmModule.isConnected();

    if (!isConnected) {
      logger.warn("CRM deal fetch blocked: provider not connected", { tenantId });
      throw new Error("CRM provider is not connected");
    }

    try {
      const result = await crmModule.searchDeals({ limit: 50 });
      return result.deals;
    } catch (error: unknown) {
      logger.error("Failed to fetch CRM deals", error);
      throw error;
    }
  }

  /**
   * Syncs the current analysis state back to the linked Deal in CRM
   */
  async syncAnalysisToDeal(
    dealId: string,
    analysisData: AnalysisData,
    tenantId?: string // Optional for now to maintain compat, but required for enforcement
  ): Promise<CRMSyncResult> {
    logger.info("Starting CRM Sync", { dealId });

    if (tenantId) {
        const enabled = await integrationControlService.areIntegrationsEnabled(tenantId);
        if (!enabled) {
            logger.warn("Integrations are disabled for this tenant", { tenantId });
            return {
                success: false,
                message: "Integrations are currently disabled for your organization."
            };
        }
    }

    try {
      // 1. Format the analysis into a readable Note body
      const noteBody = this.formatAnalysisAsNote(analysisData);

      // 2. Push to CRM
      // In a real env, we'd ensure valid connection/token here.
      // For the demo, we assume the user just imported from CRM and has a session.
      // If not connected, this will fail or we mock it.

      if (!crmModule.isConnected()) {
        logger.warn("CRM sync blocked: provider not connected", { dealId, tenantId });
        return {
          success: false,
          message: "Failed to write to HubSpot. Please check connection.",
        };
      }

      const success = await crmModule.addDealNote(dealId, noteBody);

      if (success) {
        return {
          success: true,
          message: "Analysis synced to HubSpot successfully.",
        };
      } else {
        return {
          success: false,
          message: "Failed to write to HubSpot. Please check connection.",
        };
      }
    } catch (error: unknown) {
      logger.error("CRM Sync Failed", error);
      return {
        success: false,
        message: "An unexpected error occurred during sync.",
      };
    }
  }

  private formatAnalysisAsNote(data: AnalysisData): string {
    const timestamp = new Date().toLocaleString();
    let body = `<p><strong>ValueOS Analysis - ${timestamp}</strong></p>`;

    if (data.analysisSummary) {
      body += `<p>${data.analysisSummary}</p><br/>`;
    }

    if (data.valueHypotheses && Array.isArray(data.valueHypotheses)) {
      body += `<p><strong>Strategic Value Hypotheses:</strong></p><ul>`;
      data.valueHypotheses.forEach((h) => {
        body += `<li><strong>${h.title}</strong>: ${h.description} (Confidence: ${h.confidence}%)</li>`;
      });
      body += `</ul><br/>`;
    }

    if (data.keyMetrics && Array.isArray(data.keyMetrics)) {
      body += `<p><strong>Target Metrics:</strong></p><ul>`;
      data.keyMetrics.forEach((m) => {
        body += `<li>${m.label}: ${m.value} (${m.trend})</li>`;
      });
      body += `</ul>`;
    }

    return body;
  }
}

export const crmIntegrationService = new CRMIntegrationService();