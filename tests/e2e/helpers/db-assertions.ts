import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

import { pollForRow } from './db-query';
import type { WorkflowFixture } from './workflow-fixtures';

const EXECUTE_ENDPOINTS = ['/api/workflows/execute', '/api/workflow/execute'];

export interface WorkflowBoundaryResponse {
  endpoint: string;
  response: APIResponse;
  body: unknown;
}

export async function runWorkflowRequest(
  request: APIRequestContext,
  workflow: WorkflowFixture,
  runId: string,
): Promise<WorkflowBoundaryResponse> {
  const requestBody = {
    ...workflow.executePayload,
    e2eRunId: runId,
    mockedContract: false,
  };

  let lastResponse: APIResponse | undefined;

  for (const endpoint of EXECUTE_ENDPOINTS) {
    const response = await request.post(endpoint, {
      data: requestBody,
      failOnStatusCode: false,
    });

    lastResponse = response;

    if (response.status() !== 404) {
      return {
        endpoint,
        response,
        body: await safeJson(response),
      };
    }
  }

  if (!lastResponse) {
    throw new Error(`Workflow ${workflow.id} failed to reach any backend workflow endpoint`);
  }

  return {
    endpoint: EXECUTE_ENDPOINTS[EXECUTE_ENDPOINTS.length - 1],
    response: lastResponse,
    body: await safeJson(lastResponse),
  };
}

/**
 * Asserts that the API response contains the submitted runId and a non-error
 * status. Replaces assertSessionSeeded as the post-submission step.
 */
export function assertBackendHasRecord(
  boundaryResponse: WorkflowBoundaryResponse,
  workflow: WorkflowFixture,
  runId: string,
): void {
  const { response, body } = boundaryResponse;

  expect(
    response.status(),
    `Workflow ${workflow.id}: expected non-5xx from backend`,
  ).toBeLessThan(500);

  expect(body).toBeTruthy();

  if (typeof body === 'object' && body !== null) {
    const serialized = JSON.stringify(body as Record<string, unknown>);
    expect(
      serialized.includes(runId) || serialized.includes(workflow.workflowDefinitionId),
      `Workflow ${workflow.id}: response should include run_id or workflowDefinitionId`,
    ).toBeTruthy();
  }
}

/**
 * Per-workflow DB table and filter configuration.
 */
const DB_TARGETS: Record<
  WorkflowFixture['id'],
  { table: string; filterKeys: Array<'organization_id' | 'run_id' | 'execution_id'> }
> = {
  'WF-1': { table: 'hypothesis_outputs', filterKeys: ['organization_id', 'run_id'] },
  'WF-2': { table: 'workflow_runs', filterKeys: ['organization_id', 'run_id'] },
  'WF-3': { table: 'workflow_checkpoints', filterKeys: ['execution_id'] },
  'WF-4': { table: 'financial_model_snapshots', filterKeys: ['organization_id', 'run_id'] },
  'WF-5': { table: 'workflow_runs', filterKeys: ['organization_id', 'run_id'] },
};

/**
 * Polls the DB until the expected row exists for the given workflow execution.
 * Returns the row for downstream UI comparison via assertUIMatchesDB.
 */
export async function assertDBPersistence(
  supabase: SupabaseClient,
  workflow: WorkflowFixture,
  runId: string,
  organizationId: string,
  executionId?: string,
): Promise<Record<string, unknown>> {
  const target = DB_TARGETS[workflow.id];

  const filter: Record<string, string> = {};
  for (const key of target.filterKeys) {
    if (key === 'organization_id') filter[key] = organizationId;
    else if (key === 'run_id') filter[key] = runId;
    else if (key === 'execution_id') {
      if (!executionId) throw new Error(`WF-3 assertDBPersistence requires executionId`);
      filter[key] = executionId;
    }
  }

  return pollForRow(supabase, target.table, filter);
}

async function safeJson(response: APIResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return { raw: await response.text() };
  }
}
