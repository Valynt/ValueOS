import { type APIRequestContext, expect, type Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  assertBackendHasRecord,
  assertDBPersistence,
  runWorkflowRequest,
} from './db-assertions';
import { reloadAndAssertWorkflowSnapshot } from './reload-assertions';
import { assertUIMatchesDB } from './session-assertions';

export interface WorkflowFixture {
  id: 'WF-1' | 'WF-2' | 'WF-3' | 'WF-4' | 'WF-5';
  workflowDefinitionId: string;
  title: string;
  route: string;
  executePayload: Record<string, unknown>;
}

export type WorkflowId = WorkflowFixture['id'];

export const WORKFLOW_FIXTURES: WorkflowFixture[] = [
  {
    id: 'WF-1',
    workflowDefinitionId: 'opportunity-discovery-v1',
    title: 'Opportunity discovery workflow boundary contract',
    route: '/',
    executePayload: {
      workflowId: 'opportunity-discovery-v1',
      context: {
        organization_id: 'e2e-org',
        user_id: 'wf-1-user',
        workspace_id: 'e2e-workspace',
      },
    },
  },
  {
    id: 'WF-2',
    workflowDefinitionId: 'target-value-commit-v1',
    title: 'Target commit workflow boundary contract',
    route: '/',
    executePayload: {
      workflowId: 'target-value-commit-v1',
      context: {
        organization_id: 'e2e-org',
        user_id: 'wf-2-user',
        workspace_id: 'e2e-workspace',
      },
    },
  },
  {
    id: 'WF-3',
    workflowDefinitionId: 'realization-tracking-v1',
    title: 'Realization tracking workflow boundary contract',
    route: '/',
    executePayload: {
      workflowId: 'realization-tracking-v1',
      context: {
        organization_id: 'e2e-org',
        user_id: 'wf-3-user',
        workspace_id: 'e2e-workspace',
      },
    },
  },
  {
    id: 'WF-4',
    workflowDefinitionId: 'expansion-modeling-v1',
    title: 'Expansion modeling workflow boundary contract',
    route: '/',
    executePayload: {
      workflowId: 'expansion-modeling-v1',
      context: {
        organization_id: 'e2e-org',
        user_id: 'wf-4-user',
        workspace_id: 'e2e-workspace',
      },
    },
  },
  {
    id: 'WF-5',
    workflowDefinitionId: 'integrity-controls-v1',
    title: 'Integrity controls workflow boundary contract',
    route: '/',
    executePayload: {
      workflowId: 'integrity-controls-v1',
      context: {
        organization_id: 'e2e-org',
        user_id: 'wf-5-user',
        workspace_id: 'e2e-workspace',
      },
    },
  },
];

export function getWorkflowFixture(id: WorkflowFixture['id']): WorkflowFixture {
  const fixture = WORKFLOW_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) {
    throw new Error(`Unknown workflow fixture: ${id}`);
  }
  return fixture;
}

const E2E_ORG_ID = 'e2e-org';

/**
 * Standard four-plane execution sequence for WF-1, WF-2, WF-4, WF-5.
 *
 * 1. page.goto
 * 2. Generate runId
 * 3. Submit workflow → assertBackendHasRecord
 * 4. assertDBPersistence (polls DB via pollForRow)
 * 5. assertUIMatchesDB (final step, after DB resolves)
 * 6. reloadAndAssertWorkflowSnapshot
 */
export async function executeWorkflowFixture(
  page: Page,
  request: APIRequestContext,
  workflow: WorkflowFixture,
  supabase: SupabaseClient,
): Promise<void> {
  await page.goto(workflow.route);

  const runId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `e2e-run-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const workflowWithRunId: WorkflowFixture = {
    ...workflow,
    executePayload: { ...workflow.executePayload, runId },
  };

  const boundaryResponse = await runWorkflowRequest(request, workflowWithRunId, runId);
  assertBackendHasRecord(boundaryResponse, workflowWithRunId, runId);

  const dbRow = await assertDBPersistence(supabase, workflow, runId, E2E_ORG_ID);

  await assertUIMatchesDB(page, workflow, dbRow);
  await reloadAndAssertWorkflowSnapshot(page, workflow, dbRow);
}

/**
 * WF-3 execution sequence (human checkpoint approval).
 *
 * 1. page.goto
 * 2. Submit workflow → assertBackendHasRecord (expects status: "pending_approval")
 * 3. Trigger approval: POST /api/checkpoints/:checkpointId/approve
 * 4. assertDBPersistence on workflow_checkpoints (status: "approved")
 * 5. assertUIMatchesDB
 * 6. reloadAndAssertWorkflowSnapshot
 */
export async function executeWF3Fixture(
  page: Page,
  request: APIRequestContext,
  supabase: SupabaseClient,
): Promise<void> {
  const workflow = getWorkflowFixture('WF-3');
  await page.goto(workflow.route);

  const runId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `e2e-run-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const workflowWithRunId: WorkflowFixture = {
    ...workflow,
    executePayload: { ...workflow.executePayload, runId },
  };

  const boundaryResponse = await runWorkflowRequest(request, workflowWithRunId, runId);
  assertBackendHasRecord(boundaryResponse, workflowWithRunId, runId);

  // Extract execution_id and checkpointId from the response.
  const body = boundaryResponse.body as Record<string, unknown>;
  const executionId = body['execution_id'] as string | undefined;
  const checkpointId = body['checkpointId'] as string | undefined;

  expect(
    body['status'],
    'WF-3: backend should return pending_approval before checkpoint is approved',
  ).toBe('pending_approval');

  expect(executionId, 'WF-3: response must include execution_id').toBeTruthy();
  expect(checkpointId, 'WF-3: response must include checkpointId').toBeTruthy();

  // Trigger approval.
  const approvalResponse = await request.post(
    `/api/checkpoints/${checkpointId}/approve`,
    { failOnStatusCode: false },
  );
  expect(
    approvalResponse.status(),
    `WF-3: checkpoint approval should succeed`,
  ).toBeLessThan(300);

  // Poll DB for approved checkpoint row.
  const dbRow = await assertDBPersistence(
    supabase,
    workflow,
    runId,
    E2E_ORG_ID,
    executionId,
  );

  expect(dbRow['status'], 'WF-3: checkpoint row should be approved').toBe('approved');

  await assertUIMatchesDB(page, workflow, dbRow);
  await reloadAndAssertWorkflowSnapshot(page, workflow, dbRow);
}
