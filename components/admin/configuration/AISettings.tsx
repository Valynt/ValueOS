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
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { DollarSign, Cpu, Users } from 'lucide-react';

interface AISettingsProps {
  settings: any;
  onUpdate: (setting: string, value: any) => void;
  userRole: 'tenant_admin' | 'vendor_admin';
  saving: boolean;
}

export function AISettings({ settings, onUpdate, userRole, saving }: AISettingsProps) {
  const [llmLimits, setLlmLimits] = useState(settings.llmSpendingLimits);
  const [modelRouting, setModelRouting] = useState(settings.modelRouting);
  const [agentToggles, setAgentToggles] = useState(settings.agentToggles);
  const [hitlThresholds, setHitlThresholds] = useState(settings.hitlThresholds);

  // Auto-save handlers
  const handleLlmLimitsChange = (updates: Partial<typeof llmLimits>) => {
    const updated = { ...llmLimits, ...updates };
    setLlmLimits(updated);
    onUpdate('llm_spending_limits', updated);
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
      <Card id="llm_spending_limits">
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <CardTitle>LLM Spending Limits</CardTitle>
          </div>
          <CardDescription>
            Configure budget caps and spending alerts for LLM usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthlyHardCap">Monthly Hard Cap ($)</Label>
              <Input
                id="monthlyHardCap"
                type="number"
                value={llmLimits.monthlyHardCap}
                onChange={(e) =>
                  handleLlmLimitsChange({
                    monthlyHardCap: parseFloat(e.target.value) || 0
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Absolute spending limit - requests blocked when reached
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlySoftCap">Monthly Soft Cap ($)</Label>
              <Input
                id="monthlySoftCap"
                type="number"
                value={llmLimits.monthlySoftCap}
                onChange={(e) =>
                  handleLlmLimitsChange({
                    monthlySoftCap: parseFloat(e.target.value) || 0
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Warning threshold - alerts sent when reached
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="perRequestLimit">Per Request Limit ($)</Label>
              <Input
                id="perRequestLimit"
                type="number"
                step="0.01"
                value={llmLimits.perRequestLimit}
                onChange={(e) =>
                  handleLlmLimitsChange({
                    perRequestLimit: parseFloat(e.target.value) || 0
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alertThreshold">Alert Threshold (%)</Label>
              <Input
                id="alertThreshold"
                type="number"
                value={llmLimits.alertThreshold}
                onChange={(e) =>
                  handleLlmLimitsChange({
                    alertThreshold: parseInt(e.target.value) || 0
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model Routing */}
      <Card id="model_routing">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            <CardTitle>Model Routing</CardTitle>
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

      {/* Agent Toggles */}
      <Card id="agent_toggles">
        <CardHeader>
          <CardTitle>Agent Toggles</CardTitle>
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

      {/* HITL Thresholds */}
      <Card id="hitl_thresholds">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Human-in-the-Loop Thresholds</CardTitle>
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
    </div>
  );
}
