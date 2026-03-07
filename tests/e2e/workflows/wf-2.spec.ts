import { test } from '@playwright/test';

import { executeWorkflowFixture, getWorkflowFixture } from '../helpers/workflow-fixtures';

test('WF-2: target value commit persists across reload', async ({ page, request }) => {
  await executeWorkflowFixture(page, request, getWorkflowFixture('WF-2'));
});
