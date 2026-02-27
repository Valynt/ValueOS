import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowCompensation } from '../WorkflowCompensation.js'
import { createBoltClientMock } from '../utils/mockSupabaseClient.js'

let supabaseClient: any;

vi.mock('../../lib/supabase', () => ({
    get supabase() {
        return supabaseClient;
    }
}));

describe('WorkflowCompensation Performance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        supabaseClient = createBoltClientMock({
            opportunity_artifacts: []
        });
    });

    it('should optimize deletes using "in" operator', async () => {
        const compensation = new WorkflowCompensation();
        const count = 100;
        const artifacts = Array.from({ length: count }, (_, i) => `artifact-${i}`);

        // Populate mock db
        supabaseClient.tables.opportunity_artifacts = artifacts.map(id => ({ id }));

        const context: any = {
            execution_id: 'exec-1',
            stage_id: 'opportunity',
            artifacts_created: artifacts,
            state_changes: {}
        };

        // Spy on the builder methods
        // Since from() returns a new builder each time, we need to spy on 'from' and intercept the builder.
        const fromSpy = vi.spyOn(supabaseClient, 'from');

        // Access private method
        await (compensation as any).compensateOpportunityStage(context);

        console.log(`[Perf] Count: ${count}`);
        console.log(`[Perf] From calls: ${fromSpy.mock.calls.length}`);

        // Verify optimization:
        // We expect 'from' to be called once.
        expect(fromSpy).toHaveBeenCalledTimes(1);
        expect(fromSpy).toHaveBeenCalledWith('opportunity_artifacts');

        // Also verify the data is actually deleted
        expect(supabaseClient.tables.opportunity_artifacts.length).toBe(0);
    });
});
