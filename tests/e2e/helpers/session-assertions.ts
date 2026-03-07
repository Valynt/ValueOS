import { expect, type Page } from '@playwright/test';

import type { WorkflowFixture } from './workflow-fixtures';

export interface WorkflowSessionState {
  key: string;
  workflowId: string;
  runId: string;
  persistedAt: string;
}

export async function assertSessionSeeded(
  page: Page,
  workflow: WorkflowFixture,
): Promise<WorkflowSessionState> {
  const state: WorkflowSessionState = {
    key: `e2e.workflow.${workflow.id}`,
    workflowId: workflow.workflowDefinitionId,
    runId: `${workflow.id.toLowerCase()}-${Date.now()}`,
    persistedAt: new Date().toISOString(),
  };

  await page.evaluate((sessionState) => {
    window.localStorage.setItem(sessionState.key, JSON.stringify(sessionState));
  }, state);

  const reloadedState = await page.evaluate((key) => window.localStorage.getItem(key), state.key);
  expect(reloadedState, `Workflow ${workflow.id} session should persist in localStorage`).toBeTruthy();

  const parsedState = JSON.parse(reloadedState ?? '{}') as WorkflowSessionState;
  expect(parsedState.workflowId).toBe(workflow.workflowDefinitionId);
  expect(parsedState.runId).toContain(workflow.id.toLowerCase());

  return parsedState;
}
