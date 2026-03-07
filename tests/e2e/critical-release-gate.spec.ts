import { test } from '@playwright/test';

import { executeWorkflowFixture, WORKFLOW_FIXTURES } from './helpers/workflow-fixtures';

test.describe('Critical release gate (workflow orchestrator)', () => {
  test.describe.configure({ mode: 'serial' });

  for (const workflow of WORKFLOW_FIXTURES) {
    test(`${workflow.id}: ${workflow.title}`, async ({ page, request }) => {
      try {
        await executeWorkflowFixture(page, request, workflow);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`[${workflow.id}] ${message}`);
      }
    });
  }
});
