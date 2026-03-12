import { test } from '../fixtures';
import { executeWF3Fixture } from '../helpers/workflow-fixtures';

test('WF-3: human checkpoint approval persists to DB and survives reload', async ({ page, request, supabase }) => {
  await executeWF3Fixture(page, request, supabase);
});
