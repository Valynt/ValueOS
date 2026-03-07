import { expect, type Page } from '@playwright/test';

import type { WorkflowFixture } from './workflow-fixtures';
import type { WorkflowSessionState } from './session-assertions';

export async function captureWorkflowSnapshot(
  page: Page,
  workflow: WorkflowFixture,
): Promise<WorkflowSessionState> {
  const snapshot = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, `e2e.workflow.${workflow.id}`);

  expect(snapshot, `Workflow ${workflow.id} should exist before reload`).toBeTruthy();

  return snapshot as WorkflowSessionState;
}

export async function reloadAndAssertWorkflowSnapshot(
  page: Page,
  workflow: WorkflowFixture,
  expectedSnapshot: WorkflowSessionState,
): Promise<void> {
  await page.reload();

  const snapshotAfterReload = await captureWorkflowSnapshot(page, workflow);
  expect(snapshotAfterReload.workflowId).toBe(expectedSnapshot.workflowId);
  expect(snapshotAfterReload.runId).toBe(expectedSnapshot.runId);
  expect(snapshotAfterReload.persistedAt).toBe(expectedSnapshot.persistedAt);
}
