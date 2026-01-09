/**
 * Enterprise Settings Example Component
 * 
 * Demonstrates the three enterprise-grade improvements:
 * 1. Zod validation for runtime type safety
 * 2. Optimistic UI with automatic rollback
 * 3. Settings templates for rapid onboarding
 * 
 * This serves as a reference implementation for other settings components.
 */

import React, { useState } from 'react';
import { AlertCircle, Check, Loader2, Shield } from 'lucide-react';
import { useOptimisticSettings } from '../../hooks/useOptimisticSettings';
import { 
  type OrgSecurity,
  OrgSecuritySchema,
  validateSettings,
} from '../../lib/validations/settings';
import { TemplateSelector } from './TemplateSelector';
import { applyTemplate } from '../../lib/services/settingsTemplates';

export const EnterpriseSettingsExample: React.FC = () => {
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Initial settings (would come from API/database)
  const initialSettings: OrgSecurity = {
    enforceMFA: false,
    enforceSSO: false,
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireNumbers: true,
      requireSymbols: false,
      expiryDays: 90,
    },
    sessionManagement: {
      sessionTimeoutMinutes: 60,
      idleTimeoutMinutes: 30,
      maxConcurrentSessions: 3,
    },
    ipWhitelistEnabled: false,
    ipWhitelist: [],
    webAuthnEnabled: false,
  };

  // Optimistic UI hook with Zod validation
  const { state, actions } = useOptimisticSettings(initialSettings, {
    // Validate with Zod schema
    schema: OrgSecuritySchema,
    
    // API call to save settings
    updateFn: async (data) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate occasional failure (10% chance)
      if (Math.random() < 0.1) {
        throw new Error('Network error: Failed to save settings');
      }
      
      console.log('Settings saved:', data);
    },
    
    // Success callback
    onSuccess: (data) => {
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    },
    
    // Error callback (automatic rollback)
    onError: (error, previousData) => {
      console.error('Failed to save settings:', error);
      setSaveMessage(`Error: ${error.message}`);
      setTimeout(() => setSaveMessage(null), 5000);
    },
    
    // Rollback callback
    onRollback: (previousData) => {
      console.log('Settings rolled back to:', previousData);
    },
  });

  const handleTemplateSelect = async (templateId: string) => {
    try {
      // Apply template (would include orgId in production)
      const templateSettings = await applyTemplate('demo-org', templateId);
      
      // Update local state with template settings
      actions.setData(templateSettings.security);
      
      setSaveMessage(`Applied ${templateId} template successfully!`);
      setTimeout(() => setSaveMessage(null), 3000);
      setShowTemplateSelector(false);
    } catch (error) {
      console.error('Failed to apply template:', error);
      setSaveMessage('Failed to apply template');
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Enterprise Security Settings
        </h1>
        <p className="text-muted-foreground">
          Demonstrates Zod validation, optimistic UI, and settings templates
        </p>
      </div>

      {/* Status Messages */}
      {saveMessage && (
        <div className={`
          p-4 rounded-lg border flex items-center gap-3
          ${saveMessage.includes('Error') || saveMessage.includes('Failed')
            ? 'bg-destructive/10 border-destructive text-destructive'
            : 'bg-vc-teal-500/10 border-vc-teal-500 text-vc-teal-500'
          }
        `}>
          {saveMessage.includes('Error') || saveMessage.includes('Failed') ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <Check className="w-5 h-5" />
          )}
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Rollback Indicator */}
      {state.wasRolledBack && (
        <div className="p-4 rounded-lg border border-destructive bg-destructive/10 text-destructive flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>Changes were rolled back due to an error</span>
        </div>
      )}

      {/* Template Selector */}
      {showTemplateSelector ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <TemplateSelector
            onSelect={handleTemplateSelect}
            disabled={state.isUpdating}
          />
          <button
            onClick={() => setShowTemplateSelector(false)}
            className="mt-4 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowTemplateSelector(true)}
          disabled={state.isUpdating}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
        >
          Apply Template
        </button>
      )}

      {/* Settings Form */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-vc-teal-500" />
          <h2 className="text-xl font-semibold text-foreground">
            Security Configuration
          </h2>
          {state.isUpdating && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* MFA Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-foreground">
              Enforce Multi-Factor Authentication
            </label>
            <p className="text-xs text-muted-foreground">
              Require all users to enable MFA
            </p>
          </div>
          <button
            onClick={() => actions.update({ enforceMFA: !state.data.enforceMFA })}
            disabled={state.isUpdating}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${state.data.enforceMFA ? 'bg-primary' : 'bg-muted'}
              disabled:opacity-50
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${state.data.enforceMFA ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>

        {/* SSO Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-foreground">
              Enforce Single Sign-On
            </label>
            <p className="text-xs text-muted-foreground">
              Require SSO for all authentication
            </p>
          </div>
          <button
            onClick={() => actions.update({ enforceSSO: !state.data.enforceSSO })}
            disabled={state.isUpdating}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${state.data.enforceSSO ? 'bg-primary' : 'bg-muted'}
              disabled:opacity-50
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${state.data.enforceSSO ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>

        {/* Password Policy */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground">Password Policy</h3>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Minimum Length: {state.data.passwordPolicy.minLength} characters
            </label>
            <input
              type="range"
              min="8"
              max="32"
              value={state.data.passwordPolicy.minLength}
              onChange={(e) => actions.update({
                passwordPolicy: {
                  ...state.data.passwordPolicy,
                  minLength: parseInt(e.target.value),
                },
              })}
              disabled={state.isUpdating}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground">Require Uppercase</label>
            <input
              type="checkbox"
              checked={state.data.passwordPolicy.requireUppercase}
              onChange={(e) => actions.update({
                passwordPolicy: {
                  ...state.data.passwordPolicy,
                  requireUppercase: e.target.checked,
                },
              })}
              disabled={state.isUpdating}
              className="w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground">Require Numbers</label>
            <input
              type="checkbox"
              checked={state.data.passwordPolicy.requireNumbers}
              onChange={(e) => actions.update({
                passwordPolicy: {
                  ...state.data.passwordPolicy,
                  requireNumbers: e.target.checked,
                },
              })}
              disabled={state.isUpdating}
              className="w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground">Require Symbols</label>
            <input
              type="checkbox"
              checked={state.data.passwordPolicy.requireSymbols}
              onChange={(e) => actions.update({
                passwordPolicy: {
                  ...state.data.passwordPolicy,
                  requireSymbols: e.target.checked,
                },
              })}
              disabled={state.isUpdating}
              className="w-4 h-4"
            />
          </div>
        </div>

        {/* Session Management */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground">Session Management</h3>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Session Timeout: {state.data.sessionManagement.sessionTimeoutMinutes} minutes
            </label>
            <input
              type="range"
              min="15"
              max="1440"
              step="15"
              value={state.data.sessionManagement.sessionTimeoutMinutes}
              onChange={(e) => actions.update({
                sessionManagement: {
                  ...state.data.sessionManagement,
                  sessionTimeoutMinutes: parseInt(e.target.value),
                },
              })}
              disabled={state.isUpdating}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Idle Timeout: {state.data.sessionManagement.idleTimeoutMinutes} minutes
            </label>
            <input
              type="range"
              min="5"
              max="120"
              step="5"
              value={state.data.sessionManagement.idleTimeoutMinutes}
              onChange={(e) => actions.update({
                sessionManagement: {
                  ...state.data.sessionManagement,
                  idleTimeoutMinutes: parseInt(e.target.value),
                },
              })}
              disabled={state.isUpdating}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Debug Info */}
      <details className="bg-muted p-4 rounded-lg">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Debug Information
        </summary>
        <pre className="mt-4 text-xs text-muted-foreground overflow-x-auto">
          {JSON.stringify(state.data, null, 2)}
        </pre>
      </details>
    </div>
  );
};
