import { expect, type Page } from '@playwright/test';

import type { WorkflowFixture } from './workflow-fixtures';

/**
 * Asserts that the UI displays a value that matches the persisted DB row.
 * Must be called only after pollForRow resolves — it is the final assertion
 * step before reload durability.
 *
 * The check looks for the run_id (or execution_id for WF-3) anywhere in the
 * page text. Callers that need a stricter selector can pass a locator string.
 */
export async function assertUIMatchesDB(
  page: Page,
  workflow: WorkflowFixture,
  dbRow: Record<string, unknown>,
  locator?: string,
): Promise<void> {
  // Derive the canonical identifier from the DB row.
  const identifier =
    (dbRow['run_id'] as string | undefined) ??
    (dbRow['execution_id'] as string | undefined) ??
    (dbRow['id'] as string | undefined);

  if (!identifier) {
    throw new Error(
      `assertUIMatchesDB: DB row for ${workflow.id} has no run_id, execution_id, or id column`,
    );
  }

  if (locator) {
    await expect(page.locator(locator)).toContainText(identifier);
  } else {
    // Fallback: identifier must appear somewhere in the page body.
    await expect(page.locator('body')).toContainText(identifier);
  }
}
