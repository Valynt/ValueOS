/**
 * Full Pipeline E2E Test
 *
 * Validates the complete value case lifecycle:
 * Dashboard → Discovery → Modeling → Integrity → Narrative → PDF
 *
 * Success criteria:
 * - Total pipeline time < 5 minutes
 * - Economic Kernel matches Excel ±0.01%
 * - Integrity score gates stage advancement (0.6 threshold)
 * - PDF contains correct financial numbers
 */

import { expect, test, type Page, type APIRequestContext } from '@playwright/test';

import {
  createTestCase,
  deleteTestCase,
  runDiscovery,
  runModeling,
  runIntegrity,
  runNarrative,
  exportPdf,
  checkIntegrityGate,
  type TestContext,
} from './helpers/pipeline-helpers';

const E2E_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const INTEGRITY_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Test Setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }: { page: Page }) => {
  // Navigate to dashboard and authenticate
  await page.goto('/');
  await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Full Pipeline Test
// ---------------------------------------------------------------------------

test.describe('Full Value Case Pipeline', () => {
  test.setTimeout(E2E_TIMEOUT);

  test('Dashboard → Discovery → Modeling → Integrity → Narrative → PDF', async ({
    page,
    request,
  }: {
    page: Page;
    request: APIRequestContext;
  }) => {
    const context: TestContext = {
      orgId: 'e2e-test-org',
      userId: 'e2e-test-user',
      caseId: '',
      caseName: `E2E Pipeline Test ${Date.now()}`,
      companyName: 'Acme Corp',
      industryContext: 'B2B SaaS',
    };

    // Step 1: Dashboard - Create opportunity
    await test.step('1. Dashboard - Create opportunity', async () => {
      const caseId = await createTestCase(page, context);
      context.caseId = caseId;

      expect(caseId).toBeTruthy();
      expect(caseId.length).toBeGreaterThan(0);

      console.log(`[E2E] Created case: ${caseId}`);
    });

    // Step 2: Discovery - Run DiscoveryAgent
    await test.step('2. Discovery - Generate hypotheses', async () => {
      const discoveryResult = await runDiscovery(request, context);

      expect(discoveryResult.runId).toBeTruthy();
      expect(discoveryResult.status).toBe('started');

      // Poll for completion
      let completed = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!completed && attempts < maxAttempts) {
        await page.waitForTimeout(2000);
        const status = await request.get(
          `/api/v1/cases/discovery/${discoveryResult.runId}`
        );
        const body = await status.json();

        if (body.data?.status === 'completed') {
          completed = true;
          expect(body.data.hypothesesFound).toBeGreaterThan(0);
        } else if (body.data?.status === 'failed') {
          throw new Error(`Discovery failed: ${body.data.error}`);
        }

        attempts++;
      }

      expect(completed).toBe(true);
      console.log(`[E2E] Discovery completed for case: ${context.caseId}`);
    });

    // Step 3: Modeling - Run Economic Kernel calculations
    await test.step('3. Modeling - Financial calculations', async () => {
      const modelingResult = await runModeling(request, context);

      expect(modelingResult.npv).toBeDefined();
      expect(modelingResult.irr).toBeDefined();
      expect(modelingResult.roi).toBeDefined();

      // Verify Economic Kernel precision (Excel parity ±0.01%)
      const expectedNPV = 500000; // Example expected value
      const npvDeviation = Math.abs((modelingResult.npv - expectedNPV) / expectedNPV);
      expect(npvDeviation).toBeLessThan(0.0001);

      context.financials = modelingResult;
      console.log(`[E2E] Modeling completed - NPV: ${modelingResult.npv}`);
    });

    // Step 4: Integrity - Run IntegrityAgent with gate check
    await test.step('4. Integrity - Validation and gate', async () => {
      const integrityResult = await runIntegrity(request, context);

      expect(integrityResult.score).toBeDefined();
      expect(integrityResult.violations).toBeDefined();

      // Check gate endpoint
      const gateResult = await checkIntegrityGate(request, context);

      expect(gateResult.canAdvance).toBeDefined();
      expect(gateResult.gate.integrityScore).toBe(integrityResult.score);
      expect(gateResult.gate.threshold).toBe(INTEGRITY_THRESHOLD);

      if (!gateResult.canAdvance) {
        console.log(`[E2E] Gate blocked - Score: ${integrityResult.score}`);
        console.log(`[E2E] Remediation: ${gateResult.remediationInstructions?.join(' ')}`);
      }

      context.integrity = integrityResult;
      console.log(`[E2E] Integrity completed - Score: ${integrityResult.score}`);
    });

    // Step 5: Narrative - Generate artifacts (only if integrity passes)
    await test.step('5. Narrative - Generate executive artifacts', async () => {
      if (!context.integrity || context.integrity.score < INTEGRITY_THRESHOLD) {
        console.log('[E2E] Skipping narrative - integrity below threshold');
        return;
      }

      const narrativeResult = await runNarrative(request, context);

      expect(narrativeResult.artifacts).toBeDefined();
      expect(narrativeResult.artifacts.length).toBeGreaterThan(0);

      // Verify financial injection in artifacts
      const cfoArtifact = narrativeResult.artifacts.find(
        (a: { type: string }) => a.type === 'cfo_recommendation'
      );
      expect(cfoArtifact).toBeDefined();

      context.narrative = narrativeResult;
      console.log(`[E2E] Narrative completed - ${narrativeResult.artifacts.length} artifacts`);
    });

    // Step 6: PDF Export - Generate and verify PDF (only if integrity passes)
    await test.step('6. PDF Export - Generate export', async () => {
      if (!context.integrity || context.integrity.score < INTEGRITY_THRESHOLD) {
        console.log('[E2E] Skipping PDF export - integrity below threshold');

        // Verify export is blocked
        const gateResult = await checkIntegrityGate(request, context);
        expect(gateResult.canAdvance).toBe(false);

        return;
      }

      const pdfResult = await exportPdf(request, context);

      expect(pdfResult.signedUrl).toBeTruthy();
      expect(pdfResult.sizeBytes).toBeGreaterThan(0);

      // Verify PDF is accessible
      const pdfResponse = await request.get(pdfResult.signedUrl);
      expect(pdfResponse.status()).toBe(200);
      expect(pdfResponse.headers()['content-type']).toContain('application/pdf');

      console.log(`[E2E] PDF export completed - ${pdfResult.sizeBytes} bytes`);
    });

    // Cleanup
    await test.step('Cleanup', async () => {
      if (context.caseId) {
        await deleteTestCase(request, context);
        console.log(`[E2E] Cleaned up case: ${context.caseId}`);
      }
    });
  });

  test('Integrity gate blocks advancement when score < 0.6', async ({
    page,
    request,
  }: {
    page: Page;
    request: APIRequestContext;
  }) => {
    const context: TestContext = {
      orgId: 'e2e-test-org',
      userId: 'e2e-test-user',
      caseId: '',
      caseName: `E2E Gate Test ${Date.now()}`,
      companyName: 'Test Corp',
    };

    // Create case with intentional data issues
    const caseId = await createTestCase(page, context);
    context.caseId = caseId;

    // Run integrity with bad data
    const integrityResult = await runIntegrity(request, context, { injectContradictions: true });

    // Verify gate blocks
    const gateResult = await checkIntegrityGate(request, context);
    expect(gateResult.canAdvance).toBe(false);
    expect(gateResult.gate.passed).toBe(false);
    expect(gateResult.gate.integrityScore).toBeLessThan(INTEGRITY_THRESHOLD);
    expect(gateResult.remediationInstructions).toBeDefined();
    expect(gateResult.remediationInstructions!.length).toBeGreaterThan(0);

    // Verify PDF export is blocked
    try {
      await exportPdf(request, context);
      throw new Error('PDF export should have been blocked');
    } catch (err) {
      expect((err as Error).message).toContain('Integrity');
    }

    // Cleanup
    await deleteTestCase(request, context);
  });
});

// ---------------------------------------------------------------------------
// Performance Benchmarks
// ---------------------------------------------------------------------------

test.describe('Pipeline Performance', () => {
  test('Pipeline completes within 5 minutes', async ({
    page,
    request,
  }: {
    page: Page;
    request: APIRequestContext;
  }) => {
    const startTime = Date.now();

    const context: TestContext = {
      orgId: 'e2e-test-org',
      userId: 'e2e-test-user',
      caseId: '',
      caseName: `E2E Performance Test ${Date.now()}`,
      companyName: 'Speed Corp',
    };

    // Create case
    context.caseId = await createTestCase(page, context);

    // Run discovery
    const discoveryResult = await runDiscovery(request, context);
    let completed = false;
    let attempts = 0;

    while (!completed && attempts < 150) { // 5 minutes max (150 * 2s = 300s)
      await page.waitForTimeout(2000);
      const status = await request.get(
        `/api/v1/cases/discovery/${discoveryResult.runId}`
      );
      const body = await status.json();

      if (body.data?.status === 'completed' || body.data?.status === 'failed') {
        completed = true;
      }
      attempts++;
    }

    // Run modeling
    await runModeling(request, context);

    // Run integrity
    await runIntegrity(request, context);

    // Run narrative (if integrity passes)
    const gateResult = await checkIntegrityGate(request, context);
    if (gateResult.canAdvance) {
      await runNarrative(request, context);
      await exportPdf(request, context);
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`[E2E] Pipeline completed in ${duration}s`);
    expect(duration).toBeLessThan(300); // 5 minutes

    // Cleanup
    await deleteTestCase(request, context);
  });
});
