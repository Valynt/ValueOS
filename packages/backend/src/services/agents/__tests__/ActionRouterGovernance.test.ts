import { describe, expect, it } from 'vitest';
import { mapActionToAgentType } from '../ActionRouterGovernance.js';

describe('ActionRouterGovernance', () => {
  describe('mapActionToAgentType', () => {
    it('should map invokeAgent to coordinator', () => {
      expect(mapActionToAgentType('invokeAgent')).toBe('coordinator');
    });

    it('should map updateValueTree to outcome_engineer', () => {
      expect(mapActionToAgentType('updateValueTree')).toBe('outcome_engineer');
    });

    it('should map exportArtifact to communicator', () => {
      expect(mapActionToAgentType('exportArtifact')).toBe('communicator');
    });

    it('should map navigateToStage to coordinator', () => {
      expect(mapActionToAgentType('navigateToStage')).toBe('coordinator');
    });

    it('should map createSystemMap to system_mapper', () => {
      expect(mapActionToAgentType('createSystemMap')).toBe('system_mapper');
    });

    it('should map designIntervention to intervention_designer', () => {
      expect(mapActionToAgentType('designIntervention')).toBe('intervention_designer');
    });

    it('should map trackMetrics to realization_loop', () => {
      expect(mapActionToAgentType('trackMetrics')).toBe('realization_loop');
    });

    it('should map evaluateValue to value_eval', () => {
      expect(mapActionToAgentType('evaluateValue')).toBe('value_eval');
    });

    it('should map sendMessage to communicator', () => {
      expect(mapActionToAgentType('sendMessage')).toBe('communicator');
    });

    it('should default to coordinator for unknown action types', () => {
      expect(mapActionToAgentType('unknownActionType')).toBe('coordinator');
      expect(mapActionToAgentType('')).toBe('coordinator');
      expect(mapActionToAgentType('anotherUnknown')).toBe('coordinator');
    });
  });
});
