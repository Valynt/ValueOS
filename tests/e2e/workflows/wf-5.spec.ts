import { test } from '../fixtures';
import { executeWorkflowFixture, getWorkflowFixture } from '../helpers/workflow-fixtures';

test('WF-5: integrity veto status persists to DB and survives reload', async ({ page, request, supabase }) => {
  await executeWorkflowFixture(page, request, getWorkflowFixture('WF-5'), supabase);
});
