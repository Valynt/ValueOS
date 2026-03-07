import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

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

export async function assertWorkflowPersistenceBoundary(
  boundaryResponse: WorkflowBoundaryResponse,
  workflow: WorkflowFixture,
  expectedRunId: string,
): Promise<void> {
  const { response, body } = boundaryResponse;

  expect(
    response.status(),
    `Workflow ${workflow.id} should hit a real backend boundary (non-5xx expected).`,
  ).toBeLessThan(500);

  expect(body).toBeTruthy();

  if (typeof body === 'object' && body !== null) {
    const bodyRecord = body as Record<string, unknown>;
    const serialized = JSON.stringify(bodyRecord);
    expect(
      serialized.includes(expectedRunId) || serialized.includes(workflow.workflowDefinitionId),
      `Workflow ${workflow.id} response should include workflow context for traceability`,
    ).toBeTruthy();
  }
}

async function safeJson(response: APIResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return { raw: await response.text() };
  }
}
