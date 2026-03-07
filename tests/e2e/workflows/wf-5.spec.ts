import { test } from '@playwright/test';

import { executeWorkflowFixture, getWorkflowFixture } from '../helpers/workflow-fixtures';

test('WF-5: integrity controls persists across reload', async ({ page, request }) => {
  await executeWorkflowFixture(page, request, getWorkflowFixture('WF-5'));
});
