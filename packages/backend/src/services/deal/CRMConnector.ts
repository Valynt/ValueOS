/**
 * CRMConnector
 *
 * Pulls opportunity metadata, account profile, and contacts from HubSpot CRM.
 * Implements circuit breaker pattern for resilience.
 *
 * Reference: openspec/changes/deal-assembly-pipeline/tasks.md §3
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const CRMOpportunitySchema = z.object({
  id: z.string(),
  name: z.string(),
  stage: z.string(),
  amount: z.number().optional(),
  close_date: z.string().optional(),
  probability: z.number().optional(),
  owner: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }).optional(),
  custom_properties: z.record(z.unknown()).optional(),
});

export const CRMAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string().optional(),
  size_employees: z.number().optional(),
  annual_revenue: z.number().optional(),
  website: z.string().optional(),
  address: z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  custom_properties: z.record(z.unknown()).optional(),
});

export const CRMContactSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  role: z.enum(["economic_buyer", "champion", "technical_evaluator", "end_user", "blocker", "influencer", "unknown"]).default("unknown"),
  is_primary: z.boolean().default(false),
});

export type CRMOpportunity = z.infer<typeof CRMOpportunitySchema>;
export type CRMAccount = z.infer<typeof CRMAccountSchema>;
export type CRMContact = z.infer<typeof CRMContactSchema>;

export interface CRMFetchInput {
  tenantId: string;
  crmConnectionId: string;
  opportunityId: string;
}

export interface CRMFetchResult {
  opportunity: CRMOpportunity;
  account: CRMAccount;
  contacts: CRMContact[];
  fetchedAt: string;
  sourceType: "crm-opportunity" | "crm-account" | "crm-contact";
}

// ---------------------------------------------------------------------------
// Circuit Breaker State
// ---------------------------------------------------------------------------

interface CircuitBreakerState {
  failures: number;
  lastFailure: number | null;
  isOpen: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CRMConnector {
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: null,
    isOpen: false,
  };

  private readonly FAILURE_THRESHOLD = 5;
  private readonly RESET_TIMEOUT_MS = 30000; // 30 seconds
  private readonly REQUEST_TIMEOUT_MS = 30000; // 30 seconds

  /**
   * Fetch deal context from CRM.
   */
  async fetchDealContext(input: CRMFetchInput): Promise<CRMFetchResult> {
    logger.info(`Fetching CRM data for opportunity ${input.opportunityId}`);

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      throw new Error("CRM circuit breaker is open - too many failures");
    }

    try {
      // Fetch with timeout
      const result = await this.fetchWithTimeout(input);

      // Reset circuit breaker on success
      this.resetCircuitBreaker();

      return result;
    } catch (error) {
      // Record failure
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Check if circuit breaker is open.
   */
  private isCircuitOpen(): boolean {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }

    // Check if we should reset
    if (this.circuitBreaker.lastFailure) {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailure;
      if (timeSinceLastFailure > this.RESET_TIMEOUT_MS) {
        logger.info("CRM circuit breaker reset after timeout");
        this.resetCircuitBreaker();
        return false;
      }
    }

    return true;
  }

  /**
   * Record a failure in the circuit breaker.
   */
  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (this.circuitBreaker.failures >= this.FAILURE_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      logger.error("CRM circuit breaker opened due to repeated failures");
    }
  }

  /**
   * Reset the circuit breaker.
   */
  private resetCircuitBreaker(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.lastFailure = null;
    this.circuitBreaker.isOpen = false;
  }

  /**
   * Fetch CRM data with timeout.
   */
  private async fetchWithTimeout(input: CRMFetchInput): Promise<CRMFetchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      // In production, this would make actual HubSpot API calls
      // For now, return mock data structure
      const result = await this.mockHubSpotFetch(input, controller.signal);
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Mock HubSpot fetch (replace with actual API integration).
   */
  private async mockHubSpotFetch(
    input: CRMFetchInput,
    signal: AbortSignal,
  ): Promise<CRMFetchResult> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (signal.aborted) {
      throw new Error("CRM request timed out");
    }

    // Mock opportunity data
    const opportunity: CRMOpportunity = {
      id: input.opportunityId,
      name: "Enterprise Expansion Opportunity",
      stage: "qualified",
      amount: 150000,
      close_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      probability: 0.6,
      owner: {
        id: "owner-1",
        name: "Sales Rep",
        email: "rep@example.com",
      },
      custom_properties: {
        use_case: "Digital Transformation",
        budget_confirmed: true,
      },
    };

    // Mock account data
    const account: CRMAccount = {
      id: `account-${input.opportunityId}`,
      name: "ACME Corporation",
      industry: "Technology",
      size_employees: 500,
      annual_revenue: 50000000,
      website: "https://acme.example.com",
      address: {
        city: "San Francisco",
        state: "CA",
        country: "USA",
      },
      custom_properties: {
        current_tech_stack: "Legacy ERP",
        growth_rate: "15% YoY",
      },
    };

    // Mock contacts
    const contacts: CRMContact[] = [
      {
        id: "contact-1",
        first_name: "John",
        last_name: "Smith",
        email: "john.smith@acme.example.com",
        job_title: "VP Operations",
        role: "economic_buyer",
        is_primary: true,
      },
      {
        id: "contact-2",
        first_name: "Jane",
        last_name: "Doe",
        email: "jane.doe@acme.example.com",
        job_title: "Director of IT",
        role: "technical_evaluator",
        is_primary: false,
      },
    ];

    return {
      opportunity,
      account,
      contacts,
      fetchedAt: new Date().toISOString(),
      sourceType: "crm-opportunity",
    };
  }

  /**
   * Get circuit breaker status for health checks.
   */
  getCircuitStatus(): { isOpen: boolean; failures: number; lastFailure: number | null } {
    return {
      isOpen: this.circuitBreaker.isOpen,
      failures: this.circuitBreaker.failures,
      lastFailure: this.circuitBreaker.lastFailure,
    };
  }
}
