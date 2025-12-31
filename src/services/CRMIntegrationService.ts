/**
 * CRM Integration Service
 *
 * Orchestrates the synchronization of Value Case data back to the CRM.
 * Currently supports HubSpot via the HubSpot Module Note API.
 */

import { logger } from "../lib/logger";
import { hubSpotModule } from "../mcp-crm/modules/HubSpotModule"; // Assuming we export a singleton or instantiate here
// We need to instantiate it if not exported.
import { HubSpotModule } from "../mcp-crm/modules/HubSpotModule";

// Create a singleton instance for now, assuming connection management is handled globally or we pass it
const crmModule = new HubSpotModule();

export interface CRMSyncResult {
  success: boolean;
  message: string;
}

export class CRMIntegrationService {
  /**
   * Syncs the current analysis state back to the linked Deal in CRM
   */
  async syncAnalysisToDeal(
    dealId: string,
    analysisData: any
  ): Promise<CRMSyncResult> {
    logger.info("Starting CRM Sync", { dealId });

    try {
      // 1. Format the analysis into a readable Note body
      const noteBody = this.formatAnalysisAsNote(analysisData);

      // 2. Push to CRM
      // In a real env, we'd ensure valid connection/token here.
      // For the demo, we assume the user just imported from CRM and has a session.
      // If not connected, this will fail or we mock it.

      let success = false;

      // MOCK: Check if we are in a mock/demo environment
      if (
        process.env.NODE_ENV !== "production" &&
        !dealId.startsWith("deal_")
      ) {
        logger.info("[MOCK] Pushing to CRM", { noteBody });
        await new Promise((resolve) => setTimeout(resolve, 1500)); // Fake network lag
        success = true;
      } else {
        // Real Call
        success = await crmModule.addDealNote(dealId, noteBody);
      }

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
    } catch (error) {
      logger.error("CRM Sync Failed", error);
      return {
        success: false,
        message: "An unexpected error occurred during sync.",
      };
    }
  }

  private formatAnalysisAsNote(data: any): string {
    const timestamp = new Date().toLocaleString();
    let body = `<p><strong>ValueOS Analysis - ${timestamp}</strong></p>`;

    if (data.analysisSummary) {
      body += `<p>${data.analysisSummary}</p><br/>`;
    }

    if (data.valueHypotheses && Array.isArray(data.valueHypotheses)) {
      body += `<p><strong>Strategic Value Hypotheses:</strong></p><ul>`;
      data.valueHypotheses.forEach((h: any) => {
        body += `<li><strong>${h.title}</strong>: ${h.description} (Confidence: ${h.confidence}%)</li>`;
      });
      body += `</ul><br/>`;
    }

    if (data.keyMetrics && Array.isArray(data.keyMetrics)) {
      body += `<p><strong>Target Metrics:</strong></p><ul>`;
      data.keyMetrics.forEach((m: any) => {
        body += `<li>${m.label}: ${m.value} (${m.trend})</li>`;
      });
      body += `</ul>`;
    }

    return body;
  }
}

export const crmIntegrationService = new CRMIntegrationService();
