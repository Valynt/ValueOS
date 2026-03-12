import { expect, type Page } from "@playwright/test";

import type { WorkflowFixture } from "./workflow-fixtures";
import type { WorkflowSessionState } from "./session-assertions";

function getStorageKey(workflow: WorkflowFixture): string {
  return `e2e.workflow.${workflow.id}`;
}

export async function captureWorkflowSnapshot(
  page: Page,
  workflow: WorkflowFixture
): Promise<WorkflowSessionState> {
  const snapshot = await page.evaluate(key => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, getStorageKey(workflow));

  expect(
    snapshot,
    `Workflow ${workflow.id} should exist before reload`
  ).toBeTruthy();

  return snapshot as WorkflowSessionState;
}

export async function reloadAndAssertWorkflowSnapshot(
  page: Page,
  workflow: WorkflowFixture,
  expectedSnapshot: WorkflowSessionState
): Promise<void> {
  const beforeReloadSnapshot = await captureWorkflowSnapshot(page, workflow);
  expect(beforeReloadSnapshot.workflowId).toBe(expectedSnapshot.workflowId);
  expect(beforeReloadSnapshot.runId).toBe(expectedSnapshot.runId);
  expect(beforeReloadSnapshot.persistedAt).toBe(expectedSnapshot.persistedAt);

  await page.reload();

  const snapshotAfterReload = await captureWorkflowSnapshot(page, workflow);
  expect(snapshotAfterReload.workflowId).toBe(expectedSnapshot.workflowId);
  expect(snapshotAfterReload.runId).toBe(expectedSnapshot.runId);
  expect(snapshotAfterReload.persistedAt).toBe(expectedSnapshot.persistedAt);
}
