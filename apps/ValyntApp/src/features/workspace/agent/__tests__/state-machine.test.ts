import { describe, it, expect } from 'vitest';
import {
  transition,
  canTransition,
  getValidActions,
  buildTransitionContext,
  type TransitionContext,
} from '../state-machine';
import type { AgentPhase } from '../types';

const baseCtx: TransitionContext = {
  hasArtifacts: false,
  hasPendingArtifacts: false,
  hasCheckpoints: false,
  errorRecoverable: false,
  isStreaming: false,
};

const withArtifacts: TransitionContext = {
  ...baseCtx,
  hasArtifacts: true,
  hasPendingArtifacts: false,
};

const withPendingArtifacts: TransitionContext = {
  ...baseCtx,
  hasArtifacts: true,
  hasPendingArtifacts: true,
};

describe('Agent State Machine', () => {
  describe('idle transitions', () => {
    it('idle → plan via PLAN_PROPOSED', () => {
      expect(transition('idle', 'PLAN_PROPOSED', baseCtx)).toBe('plan');
    });

    it('idle → clarify via CLARIFY_REQUESTED', () => {
      expect(transition('idle', 'CLARIFY_REQUESTED', baseCtx)).toBe('clarify');
    });

    it('idle → execute via SEND_MESSAGE', () => {
      expect(transition('idle', 'SEND_MESSAGE', baseCtx)).toBe('execute');
    });

    it('idle → error via ERROR_OCCURRED', () => {
      expect(transition('idle', 'ERROR_OCCURRED', baseCtx)).toBe('error');
    });
  });

  describe('plan transitions', () => {
    it('plan → execute via PLAN_APPROVED', () => {
      expect(transition('plan', 'PLAN_APPROVED', baseCtx)).toBe('execute');
    });

    it('plan → idle via PLAN_REJECTED', () => {
      expect(transition('plan', 'PLAN_REJECTED', baseCtx)).toBe('idle');
    });

    it('plan → clarify via CLARIFY_REQUESTED', () => {
      expect(transition('plan', 'CLARIFY_REQUESTED', baseCtx)).toBe('clarify');
    });
  });

  describe('execute transitions', () => {
    it('execute → review when artifacts exist', () => {
      expect(transition('execute', 'EXECUTION_COMPLETE', withArtifacts)).toBe('review');
    });

    it('execute → idle when no artifacts', () => {
      expect(transition('execute', 'EXECUTION_COMPLETE', baseCtx)).toBe('idle');
    });

    it('execute → clarify via CLARIFY_REQUESTED', () => {
      expect(transition('execute', 'CLARIFY_REQUESTED', baseCtx)).toBe('clarify');
    });
  });

  describe('review transitions', () => {
    it('review → finalize when all reviewed', () => {
      expect(transition('review', 'ALL_ARTIFACTS_REVIEWED', withArtifacts)).toBe('finalize');
    });

    it('review stays when pending artifacts exist', () => {
      expect(transition('review', 'ALL_ARTIFACTS_REVIEWED', withPendingArtifacts)).toBeNull();
    });

    it('review → execute via ARTIFACT_REJECTED', () => {
      expect(transition('review', 'ARTIFACT_REJECTED', baseCtx)).toBe('execute');
    });
  });

  describe('error transitions', () => {
    it('error → execute when recoverable', () => {
      const ctx = { ...baseCtx, errorRecoverable: true };
      expect(transition('error', 'ERROR_RECOVERED', ctx)).toBe('execute');
    });

    it('error → idle when not recoverable', () => {
      expect(transition('error', 'ERROR_RECOVERED', baseCtx)).toBe('idle');
    });

    it('error → idle via ERROR_DISMISSED', () => {
      expect(transition('error', 'ERROR_DISMISSED', baseCtx)).toBe('idle');
    });
  });

  describe('resume transitions', () => {
    it('resume → idle via RESUME_COMPLETE', () => {
      expect(transition('resume', 'RESUME_COMPLETE', baseCtx)).toBe('idle');
    });

    it('resume → execute via SESSION_RESTORED', () => {
      expect(transition('resume', 'SESSION_RESTORED', baseCtx)).toBe('execute');
    });
  });

  describe('universal transitions', () => {
    const phases: AgentPhase[] = ['plan', 'execute', 'clarify', 'review', 'finalize', 'error', 'resume'];
    for (const phase of phases) {
      it(`${phase} → idle via RESET`, () => {
        expect(transition(phase, 'RESET', baseCtx)).toBe('idle');
      });
    }
  });

  describe('invalid transitions', () => {
    it('rejects idle → finalize', () => {
      expect(transition('idle', 'FINALIZE_COMPLETE', baseCtx)).toBeNull();
    });

    it('rejects finalize → plan', () => {
      expect(transition('finalize', 'PLAN_PROPOSED', baseCtx)).toBeNull();
    });
  });

  describe('canTransition', () => {
    it('returns true for valid transition', () => {
      expect(canTransition('idle', 'PLAN_PROPOSED', baseCtx)).toBe(true);
    });

    it('returns false for invalid transition', () => {
      expect(canTransition('idle', 'FINALIZE_COMPLETE', baseCtx)).toBe(false);
    });
  });

  describe('getValidActions', () => {
    it('returns valid actions for idle', () => {
      const actions = getValidActions('idle', baseCtx);
      expect(actions).toContain('PLAN_PROPOSED');
      expect(actions).toContain('CLARIFY_REQUESTED');
      expect(actions).toContain('SEND_MESSAGE');
      expect(actions).toContain('ERROR_OCCURRED');
      expect(actions).not.toContain('PLAN_APPROVED');
    });
  });

  describe('buildTransitionContext', () => {
    it('builds context from state', () => {
      const ctx = buildTransitionContext({
        artifacts: { a1: { status: 'proposed' }, a2: { status: 'approved' } },
        checkpoints: [{}],
        error: { recoverable: true },
        isStreaming: false,
      });
      expect(ctx.hasArtifacts).toBe(true);
      expect(ctx.hasPendingArtifacts).toBe(true);
      expect(ctx.hasCheckpoints).toBe(true);
      expect(ctx.errorRecoverable).toBe(true);
    });
  });
});
