import { expect, type APIRequestContext, type Page } from '@playwright/test';

import { assertSessionSeeded } from './session-assertions';
import { assertWorkflowPersistenceBoundary, runWorkflowRequest } from './db-assertions';
import { captureWorkflowSnapshot, reloadAndAssertWorkflowSnapshot } from './reload-assertions';

export interface WorkflowFixture {
  id: 'WF-1' | 'WF-2' | 'WF-3' | 'WF-4' | 'WF-5';
  workflowDefinitionId: string;
  title: string;
  route: string;
  executePayload: Record<string, unknown>;
}

export const WORKFLOW_FIXTURES: WorkflowFixture[] = [
  {
    id: 'WF-1',
    workflowDefinitionId: 'opportunity-discovery-v1',
    title: 'Opportunity discovery workflow boundary contract',
    route: '/',
    executePayload: { workflowId: 'opportunity-discovery-v1', context: { organization_id: 'e2e-org', user_id: 'wf-1-user' } },
  },
  {
    id: 'WF-2',
    workflowDefinitionId: 'target-value-commit-v1',
    title: 'Target commit workflow boundary contract',
    route: '/',
    executePayload: { workflowId: 'target-value-commit-v1', context: { organization_id: 'e2e-org', user_id: 'wf-2-user' } },
  },
  {
    id: 'WF-3',
    workflowDefinitionId: 'realization-tracking-v1',
    title: 'Realization tracking workflow boundary contract',
    route: '/',
    executePayload: { workflowId: 'realization-tracking-v1', context: { organization_id: 'e2e-org', user_id: 'wf-3-user' } },
  },
  {
    id: 'WF-4',
    workflowDefinitionId: 'expansion-modeling-v1',
    title: 'Expansion modeling workflow boundary contract',
    route: '/',
    executePayload: { workflowId: 'expansion-modeling-v1', context: { organization_id: 'e2e-org', user_id: 'wf-4-user' } },
  },
  {
    id: 'WF-5',
    workflowDefinitionId: 'integrity-controls-v1',
    title: 'Integrity controls workflow boundary contract',
    route: '/',
    executePayload: { workflowId: 'integrity-controls-v1', context: { organization_id: 'e2e-org', user_id: 'wf-5-user' } },
  },
];

export function getWorkflowFixture(id: WorkflowFixture['id']): WorkflowFixture {
  const fixture = WORKFLOW_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) {
    throw new Error(`Unknown workflow fixture: ${id}`);
  }

  return fixture;
}

export async function executeWorkflowFixture(
  page: Page,
  request: APIRequestContext,
  workflow: WorkflowFixture,
): Promise<void> {
  await page.goto(workflow.route);

  const sessionState = await assertSessionSeeded(page, workflow);
  const boundaryResponse = await runWorkflowRequest(request, workflow);
  await assertWorkflowPersistenceBoundary(boundaryResponse, workflow, sessionState.runId);

  const snapshot = await captureWorkflowSnapshot(page, workflow);
  expect(snapshot.runId).toBe(sessionState.runId);

  await reloadAndAssertWorkflowSnapshot(page, workflow, snapshot);
}
