import { beforeEach, describe, expect, it, vi } from 'vitest';
it('writes tenant_id when tenantId is provided', async () => {
const tracker = new LLMCostTracker();
// @ts-ignore
const supabase = createClient();


await tracker.trackUsage({
userId: 'u-tenant',
tenantId: 'tenant-123',
provider: 'openai',
model: 'meta-llama/Llama-3-70b-chat-hf',
promptTokens: 10,
completionTokens: 5,
endpoint: 'llm-gateway',
success: true,
latencyMs: 9,
});


// @ts-ignore
expect(supabase.state.lastInsertPayload.tenant_id).toBe('tenant-123');
});


it('maps tenant_id input to tenant_id column', async () => {
const tracker = new LLMCostTracker();
// @ts-ignore
const supabase = createClient();


await tracker.trackUsage({
userId: 'u-tenant-snake',
// @ts-ignore
tenant_id: 'tenant-snake-123',
provider: 'openai',
model: 'meta-llama/Llama-3-70b-chat-hf',
promptTokens: 10,
completionTokens: 5,
endpoint: 'llm-gateway',
success: true,
latencyMs: 9,
});


// @ts-ignore
expect(supabase.state.lastInsertPayload.tenant_id).toBe('tenant-snake-123');
});


it('queries canonical cost and timestamp fields for period analytics', async () => {
const tracker = new LLMCostTracker();
// @ts-ignore
const supabase = createClient();


// @ts-ignore
supabase.state.selectResponse = {
data: [{ cost: 1.25 }, { cost: 0.75 }],
error: null,
};


const total = await tracker.getCostForPeriod(
new Date('2026-01-01T00:00:00.000Z'),
new Date('2026-01-02T00:00:00.000Z'),
'user-123'
);


expect(total).toBe(2);
expect(supabase.state.lastSelectColumns).toBe('cost');
expect(supabase.state.filters).toEqual(
expect.arrayContaining([
expect.objectContaining({ op: 'gte', column: 'created_at' }),
expect.objectContaining({ op: 'lte', column: 'created_at' }),
expect.objectContaining({ op: 'eq', column: 'user_id', value: 'user-123' }),
])
);
});


it('dedupes alerts within hour and still persists', async () => {
const tracker = new LLMCostTracker();
// @ts-ignore
const supabase = createClient();


vi.spyOn(tracker, 'getHourlyCost').mockResolvedValue(60);
vi.spyOn(tracker, 'getDailyCost').mockResolvedValue(0);
vi.spyOn(tracker, 'getMonthlyCost').mockResolvedValue(0);


// First run: no prior alert => inserts
// @ts-ignore
supabase.state.selectResponse = { data: [], error: null };


await tracker.checkCostThresholds();


// @ts-ignore
expect(supabase.state.insertCount).toBe(1);
// @ts-ignore
expect(supabase.state.lastInsertPayload.level).toBe('critical');


// Second run: prior alert exists => no new insert
// @ts-ignore
supabase.state.selectResponse = { data: [{ id: 1 }], error: null };


await tracker.checkCostThresholds();


// @ts-ignore
expect(supabase.state.insertCount).toBe(1);
});
});