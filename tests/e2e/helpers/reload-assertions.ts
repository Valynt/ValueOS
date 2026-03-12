import { type Page } from '@playwright/test';

import { assertUIMatchesDB } from './session-assertions';
import type { WorkflowFixture } from './workflow-fixtures';

/**
 * Reloads the page and asserts the DB-persisted value is still visible.
 * Must be called after assertUIMatchesDB has already passed — this is the
 * reload durability step.
 */
export async function reloadAndAssertWorkflowSnapshot(
  page: Page,
  workflow: WorkflowFixture,
  dbRow: Record<string, unknown>,
  locator?: string,
): Promise<void> {
  await page.reload();
  await assertUIMatchesDB(page, workflow, dbRow, locator);
}
