import { describe, expect, it } from 'vitest';

import { HandoffCardBuilder } from '../HandoffCardBuilder.js';

const builder = new HandoffCardBuilder();

describe('HandoffCardBuilder', () => {
  it('builds a normalized handoff card with transition metadata and policy constraints', () => {
    const card = builder.build({
      runId: 'run-1',
      actor: 'user-1',
      timestamp: '2026-04-05T00:00:00.000Z',
      fromStage: {
        id: 'hypothesis',
        agent_type: 'opportunity',
        timeout_seconds: 30,
        description: 'Validate hypothesis',
      },
      toStage: {
        id: 'integrity',
        agent_type: 'integrity',
        timeout_seconds: 30,
        description: 'Check policy and structural integrity',
      },
      dag: {
        id: 'dag-1',
        name: 'Lifecycle',
        description: 'Lifecycle flow',
        initial_stage: 'hypothesis',
        final_stages: ['integrity'],
        stages: [
          {
            id: 'hypothesis',
            agent_type: 'opportunity',
            timeout_seconds: 30,
          },
          {
            id: 'integrity',
            agent_type: 'integrity',
            timeout_seconds: 30,
          },
        ],
        transitions: [
          { from_stage: 'hypothesis', to_stage: 'integrity', condition: 'confidence_score >= 0.7' },
        ],
      },
      stageOutput: {
        confidence_score: 0.82,
        required_inputs: ['customer_financials', 'evidence_snapshot'],
        evidence_snapshot_pointers: ['workflow://run-1/stage/hypothesis/evidence'],
      },
      policyConstraints: ['hitl_required=false', 'HITL-01'],
    });

    expect(card.transition).toEqual({
      from_stage: 'hypothesis',
      to_stage: 'integrity',
      actor: 'user-1',
      timestamp: '2026-04-05T00:00:00.000Z',
      run_id: 'run-1',
    });
    expect(card.policy_constraints).toEqual(['hitl_required=false', 'HITL-01']);
    expect(card.required_inputs).toEqual(['customer_financials', 'evidence_snapshot']);
    expect(card.confidence_summary.label).toBe('high');
    expect(card.acceptance_criteria).toEqual(['confidence_score >= 0.7']);
    expect(card.next_owner).toBe('integrity');
  });
});
