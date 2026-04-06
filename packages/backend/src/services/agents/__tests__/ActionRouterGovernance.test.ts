import { describe, expect, it } from 'vitest';
import { actionTypeToPermission } from '../ActionRouterGovernance.js';

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
