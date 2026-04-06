import { describe, expect, it } from 'vitest';
import { actionTypeToPermission } from '../ActionRouterGovernance';

describe('ActionRouterGovernance', () => {
  describe('actionTypeToPermission', () => {
    it('should map invokeAgent to agents:execute', () => {
      expect(actionTypeToPermission('invokeAgent')).toBe('agents:execute');
    });

    it('should map runWorkflowStep to agents:execute', () => {
      expect(actionTypeToPermission('runWorkflowStep')).toBe('agents:execute');
    });

    it('should map updateValueTree to value_trees:edit', () => {
      expect(actionTypeToPermission('updateValueTree')).toBe('value_trees:edit');
    });

    it('should map updateAssumption to value_trees:edit', () => {
      expect(actionTypeToPermission('updateAssumption')).toBe('value_trees:edit');
    });

    it('should map exportArtifact to projects:view', () => {
      expect(actionTypeToPermission('exportArtifact')).toBe('projects:view');
    });

    it('should map openAuditTrail to audit.read', () => {
      expect(actionTypeToPermission('openAuditTrail')).toBe('audit.read');
    });

    it('should map showExplanation to projects:view', () => {
      expect(actionTypeToPermission('showExplanation')).toBe('projects:view');
    });

    it('should map navigateToStage to projects:view', () => {
      expect(actionTypeToPermission('navigateToStage')).toBe('projects:view');
    });

    it('should map saveWorkspace to projects:edit', () => {
      expect(actionTypeToPermission('saveWorkspace')).toBe('projects:edit');
    });

    it('should map mutateComponent to projects:edit', () => {
      expect(actionTypeToPermission('mutateComponent')).toBe('projects:edit');
    });

    it('should return the original actionType if no mapping exists', () => {
      expect(actionTypeToPermission('unknownAction')).toBe('unknownAction');
    });
  });
});
