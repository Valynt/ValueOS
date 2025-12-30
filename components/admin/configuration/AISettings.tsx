/**
 * AI Settings Component
 * 
 * UI for managing AI orchestration configurations
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ValidatedInput } from '@/components/ui/validated-input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Cpu, DollarSign, Users } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { configValidation } from '@/lib/validation/configValidation';

interface AISettingsProps {
  settings: any;
  onUpdate: (setting: string, value: any) => void;
  userRole: 'tenant_admin' | 'vendor_admin';
  saving: boolean;
  searchQuery?: string;
}

export function AISettings({ settings, onUpdate, userRole, saving, searchQuery = '' }: AISettingsProps) {
  const [llmLimits, setLlmLimits] = useState(settings.llmSpendingLimits);
  const [modelRouting, setModelRouting] = useState(settings.modelRouting);
  const [agentToggles, setAgentToggles] = useState(settings.agentToggles);
  const [hitlThresholds, setHitlThresholds] = useState(settings.hitlThresholds);
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Filter sections based on search query
  const matchesSearch = (text: string) => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const showLlmLimits = matchesSearch('llm spending limits budget cap alert threshold');
  const showModelRouting = matchesSearch('model routing default temperature tokens');
  const showAgentToggles = matchesSearch('agent toggles enable disable');
  const showHitlThresholds = matchesSearch('hitl human loop confidence threshold');

  // Auto-save handlers with validation
  const handleLlmLimitsChange = (updates: Partial<typeof llmLimits>) => {
    const updated = { ...llmLimits, ...updates };
    
    // Validate changes
    const errors: Record<string, string> = {};
    if (updates.monthlyHardCap !== undefined) {
      const result = configValidation.monthlyBudget(updates.monthlyHardCap);
      if (!result.valid && result.error) {
        errors.monthlyHardCap = result.error;
      }
    }
    if (updates.monthlySoftCap !== undefined) {
      const result = configValidation.monthlyBudget(updates.monthlySoftCap);
      if (!result.valid && result.error) {
        errors.monthlySoftCap = result.error;
      }
    }
    if (updates.alertThreshold !== undefined) {
      const result = configValidation.alertThreshold(updates.alertThreshold / 100);
      if (!result.valid && result.error) {
        errors.alertThreshold = result.error;
      }
    }
    
    setValidationErrors(prev => ({ ...prev, ...errors }));
    
    // Only save if valid
    if (Object.keys(errors).length === 0) {
      setLlmLimits(updated);
      onUpdate('llm_spending_limits', updated);
    }
  };

  const handleModelRoutingChange = (updates: Partial<typeof modelRouting>) => {
    const updated = { ...modelRouting, ...updates };
    setModelRouting(updated);
    onUpdate('model_routing', updated);
  };

  const handleAgentTogglesChange = (updates: Partial<typeof agentToggles>) => {
    const updated = { ...agentToggles, ...updates };
    setAgentToggles(updated);
    onUpdate('agent_toggles', updated);
  };

  const handleHitlThresholdsChange = (updates: Partial<typeof hitlThresholds>) => {
    const updated = { ...hitlThresholds, ...updates };
    setHitlThresholds(updated);
    onUpdate('hitl_thresholds', updated);
  };

  return (
    <div className="space-y-6">
      {/* LLM Spending Limits */}
      {showLlmLimits && (
      <Card id="llm_spending_limits">
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <CardTitle>LLM Spending Limits</CardTitle>
            <HelpTooltip content="Set hard and soft budget caps to control AI costs. Hard caps block requests when reached, soft caps send alerts." />
          </div>
          <CardDescription>
            Configure budget caps and spending alerts for LLM usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <ValidatedInput
                label="Monthly Hard Cap ($)"
                id="monthlyHardCap"
                type="number"
                value={llmLimits.monthlyHardCap}
                onChange={(e) =>
                  handleLlmLimitsChange({
                    monthlyHardCap: parseFloat(e.target.value) || 0
                  })
                }
                error={validationErrors.monthlyHardCap}
                valid={!validationErrors.monthlyHardCap && llmLimits.monthlyHardCap > 0}
                helperText="Absolute spending limit - requests blocked when reached"
              />
            </div>

            <div>
              <ValidatedInput
                label="Monthly Soft Cap ($)"
                id="monthlySoftCap"
                type="number"
                value={llmLimits.monthlySoftCap}
                onChange={(e) =>
                  handleLlmLimitsChange({
                    monthlySoftCap: parseFloat(e.target.value) || 0
                  })
                }
                error={validationErrors.monthlySoftCap}
                valid={!validationErrors.monthlySoftCap && llmLimits.monthlySoftCap > 0}
                helperText="Warning threshold - alerts sent when reached"
              />
            </div>

            <div>
              <ValidatedInput
                label="Per Request Limit ($)"
                id="perRequestLimit"
                type="number"
                step="0.01"
                value={llmLimits.perRequestLimit}
                onChange={(e) =>
                  handleLlmLimitsChange({
                    perRequestLimit: parseFloat(e.target.value) || 0
                  })
                }
                helperText="Maximum cost per individual request"
              />
            </div>

            <div>
              <ValidatedInput
                label="Alert Threshold (%)"
                id="alertThreshold"
                type="number"
                value={llmLimits.alertThreshold}
                onChange={(e) =>
                  handleLlmLimitsChange({
                    alertThreshold: parseInt(e.target.value) || 0
                  })
                }
                error={validationErrors.alertThreshold}
                valid={!validationErrors.alertThreshold && llmLimits.alertThreshold > 0}
                helperText="Percentage of budget to trigger alerts (0-100)"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Model Routing */}
      {showModelRouting && (
      <Card id="model_routing">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            <CardTitle>Model Routing</CardTitle>
            <HelpTooltip content="Choose which AI model to use by default and configure parameters like temperature and token limits." />
          </div>
          <CardDescription>
            Configure default model and routing strategies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultModel">Default Model</Label>
            <Select
              value={modelRouting.defaultModel}
              onValueChange={(value) =>
                handleModelRoutingChange({ defaultModel: value })
              }
            >
              <SelectTrigger id="defaultModel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="together-llama-3-70b">Llama 3 70B</SelectItem>
                <SelectItem value="together-llama-3-8b">Llama 3 8B</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Auto-Downgrade</Label>
              <p className="text-xs text-muted-foreground">
                Automatically use cheaper models when budget is low
              </p>
            </div>
            <Switch
              checked={modelRouting.enableAutoDowngrade}
              onCheckedChange={(checked) =>
                handleModelRoutingChange({ enableAutoDowngrade: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
      )}

      {/* Agent Toggles */}
      {showAgentToggles && (
      <Card id="agent_toggles">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Agent Toggles</CardTitle>
            <HelpTooltip content="Control which AI agents are available to your organization. Disabled agents cannot be used by any users." />
          </div>
          <CardDescription>Enable or disable specific AI agents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(agentToggles.enabledAgents).map(([agent, enabled]) => (
            <div key={agent} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="capitalize">
                  {agent.replace(/([A-Z])/g, ' $1').trim()}
                </Label>
              </div>
              <Switch
                checked={enabled as boolean}
                onCheckedChange={(checked) =>
                  handleAgentTogglesChange({
                    enabledAgents: {
                      ...agentToggles.enabledAgents,
                      [agent]: checked
                    }
                  })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
      )}

      {/* HITL Thresholds */}
      {showHitlThresholds && (
      <Card id="hitl_thresholds">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Human-in-the-Loop Thresholds</CardTitle>
            <HelpTooltip content="Set confidence levels that trigger human review. Responses below the threshold require manual approval." />
          </div>
          <CardDescription>
            Configure confidence thresholds for human review
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Auto-Approval Threshold</Label>
                <span className="text-sm font-medium">
                  {(hitlThresholds.autoApprovalThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[hitlThresholds.autoApprovalThreshold * 100]}
                onValueChange={([value]) =>
                  handleHitlThresholdsChange({
                    autoApprovalThreshold: value / 100
                  })
                }
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Confidence above this threshold auto-approves
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Human Review Threshold</Label>
                <span className="text-sm font-medium">
                  {(hitlThresholds.humanReviewThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[hitlThresholds.humanReviewThreshold * 100]}
                onValueChange={([value]) =>
                  handleHitlThresholdsChange({
                    humanReviewThreshold: value / 100
                  })
                }
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Confidence below this requires human review
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Rejection Threshold</Label>
                <span className="text-sm font-medium">
                  {(hitlThresholds.rejectionThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[hitlThresholds.rejectionThreshold * 100]}
                onValueChange={([value]) =>
                  handleHitlThresholdsChange({
                    rejectionThreshold: value / 100
                  })
                }
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Confidence below this auto-rejects
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {!showLlmLimits && !showModelRouting && !showAgentToggles && !showHitlThresholds && searchQuery && (
        <div className="text-center py-12 text-muted-foreground">
          No settings match "{searchQuery}"
        </div>
      )}
    </div>
  );
}
