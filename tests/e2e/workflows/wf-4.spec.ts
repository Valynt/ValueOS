import { test } from '../fixtures';
import { executeWorkflowFixture, getWorkflowFixture } from '../helpers/workflow-fixtures';

test('WF-4: financial model snapshot persists to DB and survives reload', async ({ page, request, supabase }) => {
  await executeWorkflowFixture(page, request, getWorkflowFixture('WF-4'), supabase);
});
