import { test } from '../fixtures';
import { executeWorkflowFixture, getWorkflowFixture } from '../helpers/workflow-fixtures';

test('WF-2: async queue workflow persists to DB and survives reload', async ({ page, request, supabase }) => {
  await executeWorkflowFixture(page, request, getWorkflowFixture('WF-2'), supabase);
});
