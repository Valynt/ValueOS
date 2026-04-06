import { describe, expect, it } from 'vitest';
import { actionTypeToPermission, mapActionToAgentType } from '../ActionRouterGovernance.js';

describe('ActionRouterGovernance', () => {
  describe('actionTypeToPermission', () => {
    it('should return correct permissions for mapped action types', () => {
      expect(actionTypeToPermission('invokeAgent')).toBe('agents:execute');
      expect(actionTypeToPermission('runWorkflowStep')).toBe('agents:execute');
      expect(actionTypeToPermission('updateValueTree')).toBe('value_trees:edit');
      expect(actionTypeToPermission('updateAssumption')).toBe('value_trees:edit');
      expect(actionTypeToPermission('exportArtifact')).toBe('projects:view');
      expect(actionTypeToPermission('openAuditTrail')).toBe('audit.read');
      expect(actionTypeToPermission('showExplanation')).toBe('projects:view');
      expect(actionTypeToPermission('navigateToStage')).toBe('projects:view');
      expect(actionTypeToPermission('saveWorkspace')).toBe('projects:edit');
      expect(actionTypeToPermission('mutateComponent')).toBe('projects:edit');
    });

    it('should return the action type itself if not mapped', () => {
      expect(actionTypeToPermission('unknownAction')).toBe('unknownAction');
      expect(actionTypeToPermission('anotherUnknownAction')).toBe('anotherUnknownAction');
    });
  });

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