/**
 * Pipeline Test Helpers
 *
 * Helper functions for the full pipeline E2E tests.
 * Provides utilities for creating test cases, running agents, and validating results.
 */

import type { APIRequestContext, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestContext {
  orgId: string;
  userId: string;
  caseId: string;
  caseName: string;
  companyName: string;
  industryContext?: string;
  financials?: {
    npv: number;
    irr: number;
    roi: number;
    paybackMonths: number;
  };
  integrity?: {
    score: number;
    violations: Array<{
      type: string;
      severity: string;
      description: string;
    }>;
  };
  narrative?: {
    artifacts: Array<{
      type: string;
      id: string;
      status: string;
    }>;
  };
}

interface CreateCaseResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
  };
  error?: string;
}

interface DiscoveryResponse {
  success: boolean;
  data?: {
    runId: string;
    status: string;
    hypothesesFound?: number;
    error?: string;
  };
  error?: string;
}

interface ModelingResponse {
  success: boolean;
  data?: {
    npv: number;
    irr: number;
    roi: number;
    paybackMonths: number;
    scenarios: Array<{
      name: string;
      npv: number;
      roi: number;
    }>;
  };
  error?: string;
}

interface IntegrityResponse {
  success: boolean;
  data?: {
    score: number;
    violations: Array<{
      type: string;
      severity: string;
      description: string;
    }>;
    vetoDecision?: string;
  };
  error?: string;
}

interface GateResponse {
  success: boolean;
  data?: {
    canAdvance: boolean;
    gate: {
      integrityScore: number;
      threshold: number;
      passed: boolean;
    };
    violations: {
      critical: number;
      warnings: number;
      blocked: boolean;
    };
    remediationInstructions?: string[];
  };
  error?: string;
}

interface NarrativeResponse {
  success: boolean;
  data?: {
    artifacts: Array<{
      type: string;
      id: string;
      status: string;
    }>;
    defenseReadinessScore: number;
    readinessScore: number;
  };
  error?: string;
}

interface PdfExportResponse {
  success: boolean;
  data?: {
    signedUrl: string;
    storagePath: string;
    sizeBytes: number;
    createdAt: string;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Test Case Management
// ---------------------------------------------------------------------------

export async function createTestCase(
  page: Page,
  context: TestContext
): Promise<string> {
  // Navigate to dashboard
  await page.goto('/');
  await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });

  // Click "Go" button to create new case
  const goButton = await page.locator('[data-testid="create-case-btn"]').first();
  await goButton.click();

  // Wait for case creation and navigation
  await page.waitForURL(/\/workspace\//, { timeout: 10000 });

  // Extract case ID from URL
  const url = page.url();
  const caseIdMatch = url.match(/\/workspace\/([^\/]+)/);
  if (!caseIdMatch) {
    throw new Error('Failed to extract case ID from URL');
  }

  return caseIdMatch[1];
}

export async function deleteTestCase(
  request: APIRequestContext,
  context: TestContext
): Promise<void> {
  const response = await request.delete(
    `/api/v1/cases/${context.caseId}`,
    {
      headers: {
        'X-Organization-ID': context.orgId,
      },
    }
  );

  if (response.status() >= 400) {
    console.warn(`Failed to delete case ${context.caseId}: ${response.status()}`);
  }
}

// ---------------------------------------------------------------------------
// Agent Execution
// ---------------------------------------------------------------------------

export async function runDiscovery(
  request: APIRequestContext,
  context: TestContext
): Promise<{ runId: string; status: string }> {
  const response = await request.post(
    `/api/v1/cases/${context.caseId}/discovery`,
    {
      data: {
        companyName: context.companyName,
        industryContext: context.industryContext,
      },
      headers: {
        'X-Organization-ID': context.orgId,
      },
    }
  );

  const body = (await response.json()) as DiscoveryResponse;

  if (!body.success || !body.data) {
    throw new Error(`Discovery failed: ${body.error}`);
  }

  return {
    runId: body.data.runId,
    status: body.data.status,
  };
}

export async function runModeling(
  request: APIRequestContext,
  context: TestContext
): Promise<{ npv: number; irr: number; roi: number; paybackMonths: number }> {
  const response = await request.post(
    `/api/v1/cases/${context.caseId}/calculate`,
    {
      data: {
        cashFlows: [-100000, 50000, 50000, 50000, 50000],
        discountRate: 0.1,
      },
      headers: {
        'X-Organization-ID': context.orgId,
      },
    }
  );

  const body = (await response.json()) as ModelingResponse;

  if (!body.success || !body.data) {
    throw new Error(`Modeling failed: ${body.error}`);
  }

  return {
    npv: body.data.npv,
    irr: body.data.irr,
    roi: body.data.roi,
    paybackMonths: body.data.paybackMonths,
  };
}

export async function runIntegrity(
  request: APIRequestContext,
  context: TestContext,
  options?: { injectContradictions?: boolean }
): Promise<{ score: number; violations: Array<{ type: string; severity: string; description: string }> }> {
  // Trigger integrity agent
  const response = await request.post(
    `/api/v1/cases/${context.caseId}/integrity/run`,
    {
      data: {
        context: {
          injectContradictions: options?.injectContradictions ?? false,
        },
      },
      headers: {
        'X-Organization-ID': context.orgId,
      },
    }
  );

  const body = (await response.json()) as IntegrityResponse;

  if (!body.success) {
    throw new Error(`Integrity run failed: ${body.error}`);
  }

  // Get latest integrity result
  const resultResponse = await request.get(
    `/api/v1/cases/${context.caseId}/integrity`,
    {
      headers: {
        'X-Organization-ID': context.orgId,
      },
    }
  );

  const resultBody = (await resultResponse.json()) as IntegrityResponse;

  if (!resultBody.success || !resultBody.data) {
    throw new Error(`Failed to fetch integrity result: ${resultBody.error}`);
  }

  return {
    score: resultBody.data.score,
    violations: resultBody.data.violations,
  };
}

export async function checkIntegrityGate(
  request: APIRequestContext,
  context: TestContext
): Promise<{
  canAdvance: boolean;
  gate: { integrityScore: number; threshold: number; passed: boolean };
  violations: { critical: number; warnings: number; blocked: boolean };
  remediationInstructions?: string[];
}> {
  const response = await request.get(
    `/api/v1/cases/${context.caseId}/gate`,
    {
      headers: {
        'X-Organization-ID': context.orgId,
      },
    }
  );

  const body = (await response.json()) as GateResponse;

  if (!body.success || !body.data) {
    throw new Error(`Gate check failed: ${body.error}`);
  }

  return {
    canAdvance: body.data.canAdvance,
    gate: body.data.gate,
    violations: body.data.violations,
    remediationInstructions: body.data.remediationInstructions,
  };
}

export async function runNarrative(
  request: APIRequestContext,
  context: TestContext
): Promise<{ artifacts: Array<{ type: string; id: string; status: string }> }> {
  // Trigger narrative agent
  const response = await request.post(
    `/api/v1/cases/${context.caseId}/narrative/run`,
    {
      data: {
        context: {
          previous_stage_outputs: {
            integrity: context.integrity,
            modeling: context.financials,
          },
        },
      },
      headers: {
        'X-Organization-ID': context.orgId,
      },
    }
  );

  const body = (await response.json()) as NarrativeResponse;

  if (!body.success) {
    throw new Error(`Narrative run failed: ${body.error}`);
  }

  // Get latest narrative
  const resultResponse = await request.get(
    `/api/v1/cases/${context.caseId}/narrative`,
    {
      headers: {
        'X-Organization-ID': context.orgId,
      },
    }
  );

  const resultBody = (await resultResponse.json()) as NarrativeResponse;

  if (!resultBody.success || !resultBody.data) {
    throw new Error(`Failed to fetch narrative: ${resultBody.error}`);
  }

  return {
    artifacts: resultBody.data.artifacts,
  };
}

export async function exportPdf(
  request: APIRequestContext,
  context: TestContext
): Promise<{ signedUrl: string; storagePath: string; sizeBytes: number }> {
  const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const renderUrl = `${baseUrl}/org/${context.caseId}/outputs?pdf=true`;

  const response = await request.post(
    `/api/v1/cases/${context.caseId}/export/pdf`,
    {
      data: {
        renderUrl,
        title: `Business Case - ${context.caseName}`,
      },
      headers: {
        'X-Organization-ID': context.orgId,
      },
    }
  );

  const body = (await response.json()) as PdfExportResponse;

  if (!body.success || !body.data) {
    throw new Error(`PDF export failed: ${body.error}`);
  }

  return {
    signedUrl: body.data.signedUrl,
    storagePath: body.data.storagePath,
    sizeBytes: body.data.sizeBytes,
  };
}
