/**
 * Settings Template Selector Component
 * 
 * Allows organization admins to select a pre-configured settings template
 * during onboarding or when resetting settings.
 * 
 * Reduces decision fatigue by providing industry-specific defaults.
 */

import React, { useState } from 'react';
import { Check, Shield, Sparkles, Zap } from 'lucide-react';
import { listTemplates, compareTemplates, type SettingsTemplate } from '../../lib/services/settingsTemplates';

interface TemplateSelectorProps {
  /**
   * Callback when template is selected
   */
  onSelect: (templateId: string) => void;
  
  /**
   * Currently selected template ID
   */
  selectedTemplateId?: string;
  
  /**
   * Whether selection is disabled
   */
  disabled?: boolean;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelect,
  selectedTemplateId,
  disabled = false,
}) => {
  const templates = listTemplates();
  const comparison = compareTemplates();
  const [selected, setSelected] = useState<string>(selectedTemplateId || 'standard');

  const handleSelect = (templateId: string) => {
    if (disabled) return;
    setSelected(templateId);
    onSelect(templateId);
  };

  const getTemplateIcon = (category: string) => {
    switch (category) {
      case 'strict':
        return Shield;
      case 'creative':
        return Sparkles;
      default:
        return Zap;
    }
  };

  const getTemplateColor = (category: string) => {
    switch (category) {
      case 'strict':
        return 'text-red-500 bg-red-50 border-red-200';
      case 'creative':
        return 'text-purple-500 bg-purple-50 border-purple-200';
      default:
        return 'text-vc-teal-500 bg-vc-teal-500/10 border-vc-teal-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Choose Your Security Profile
        </h3>
        <p className="text-sm text-muted-foreground">
          Select a pre-configured template based on your organization's needs.
          You can customize these settings later.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map((template) => {
          const Icon = getTemplateIcon(template.category);
          const colorClass = getTemplateColor(template.category);
          const isSelected = selected === template.id;
          const comparisonData = comparison.find(c => c.templateId === template.id);

          return (
            <button
              key={template.id}
              onClick={() => handleSelect(template.id)}
              disabled={disabled}
              className={`
                relative p-6 rounded-lg border-2 text-left transition-all
                ${isSelected
                  ? 'border-primary bg-primary/5 shadow-lg'
                  : 'border-border bg-card hover:border-primary/50 hover:shadow-md'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              {/* Icon */}
              <div className={`inline-flex p-3 rounded-lg border ${colorClass} mb-4`}>
                <Icon className="w-6 h-6" />
              </div>

              {/* Title */}
              <h4 className="text-lg font-semibold text-foreground mb-2">
                {template.name}
              </h4>

              {/* Description */}
              <p className="text-sm text-muted-foreground mb-4">
                {template.description}
              </p>

              {/* Key features */}
              {comparisonData && (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>MFA:</span>
                    <span className="font-medium text-foreground">
                      {comparisonData.features.mfaEnforced ? 'Enforced' : 'Optional'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Session:</span>
                    <span className="font-medium text-foreground">
                      {comparisonData.features.sessionTimeout}min
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Password:</span>
                    <span className="font-medium text-foreground">
                      {comparisonData.features.passwordMinLength}+ chars
                    </span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="mt-8">
        <h4 className="text-sm font-semibold text-foreground mb-4">
          Detailed Comparison
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                  Feature
                </th>
                {templates.map(template => (
                  <th key={template.id} className="text-center py-3 px-4 font-medium text-foreground">
                    {template.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="py-3 px-4 text-muted-foreground">MFA Enforced</td>
                {comparison.map(c => (
                  <td key={c.templateId} className="text-center py-3 px-4">
                    {c.features.mfaEnforced ? (
                      <Check className="w-4 h-4 text-vc-teal-500 mx-auto" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <td className="py-3 px-4 text-muted-foreground">SSO Enforced</td>
                {comparison.map(c => (
                  <td key={c.templateId} className="text-center py-3 px-4">
                    {c.features.ssoEnforced ? (
                      <Check className="w-4 h-4 text-vc-teal-500 mx-auto" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <td className="py-3 px-4 text-muted-foreground">Session Timeout</td>
                {comparison.map(c => (
                  <td key={c.templateId} className="text-center py-3 px-4 text-foreground">
                    {c.features.sessionTimeout}min
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <td className="py-3 px-4 text-muted-foreground">Idle Timeout</td>
                {comparison.map(c => (
                  <td key={c.templateId} className="text-center py-3 px-4 text-foreground">
                    {c.features.idleTimeout}min
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <td className="py-3 px-4 text-muted-foreground">Min Password Length</td>
                {comparison.map(c => (
                  <td key={c.templateId} className="text-center py-3 px-4 text-foreground">
                    {c.features.passwordMinLength} chars
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border">
                <td className="py-3 px-4 text-muted-foreground">IP Whitelisting</td>
                {comparison.map(c => (
                  <td key={c.templateId} className="text-center py-3 px-4">
                    {c.features.ipWhitelisting ? (
                      <Check className="w-4 h-4 text-vc-teal-500 mx-auto" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-4 text-muted-foreground">WebAuthn</td>
                {comparison.map(c => (
                  <td key={c.templateId} className="text-center py-3 px-4">
                    {c.features.webAuthn ? (
                      <Check className="w-4 h-4 text-vc-teal-500 mx-auto" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
