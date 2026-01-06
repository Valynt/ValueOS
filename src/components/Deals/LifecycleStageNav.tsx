/**
 * Lifecycle Stage Navigation
 * 
 * Tab navigation for the four lifecycle stages with progress indication.
 * Core navigation pattern for the sales enablement workflow.
 */

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { LifecycleStage } from '@/types/vos';

interface LifecycleStageNavProps {
  currentStage: LifecycleStage;
  onStageChange: (stage: LifecycleStage) => void;
  stageCompletion?: Partial<Record<LifecycleStage, boolean>>;
  stageProgress?: Partial<Record<LifecycleStage, number>>;
  disabled?: boolean;
}

interface StageConfig {
  value: LifecycleStage;
  label: string;
  description: string;
  icon: string;
}

const stages: StageConfig[] = [
  {
    value: 'opportunity',
    label: 'Discovery',
    description: 'Identify pain points and opportunities',
    icon: '🔍'
  },
  {
    value: 'target',
    label: 'Modeling',
    description: 'Build ROI model and business case',
    icon: '📊'
  },
  {
    value: 'realization',
    label: 'Realization',
    description: 'Track value delivery post-sale',
    icon: '✅'
  },
  {
    value: 'expansion',
    label: 'Expansion',
    description: 'Identify upsell opportunities',
    icon: '🚀'
  }
];

export function LifecycleStageNav({
  currentStage,
  onStageChange,
  stageCompletion = {},
  stageProgress = {},
  disabled = false
}: LifecycleStageNavProps) {
  const getStageStatus = (stage: LifecycleStage) => {
    if (stageCompletion[stage]) return 'complete';
    if (stage === currentStage) return 'active';
    const currentIndex = stages.findIndex(s => s.value === currentStage);
    const stageIndex = stages.findIndex(s => s.value === stage);
    return stageIndex < currentIndex ? 'complete' : 'pending';
  };

  const getProgressPercentage = (stage: LifecycleStage): number => {
    if (stageCompletion[stage]) return 100;
    return stageProgress[stage] || 0;
  };

  return (
    <div className="space-y-4">
      {/* Stage Tabs */}
      <Tabs value={currentStage} onValueChange={(v) => !disabled && onStageChange(v as LifecycleStage)}>
        <TabsList className="grid w-full grid-cols-4 h-auto p-1">
          {stages.map((stage, index) => {
            const status = getStageStatus(stage.value);
            const progress = getProgressPercentage(stage.value);
            const isActive = stage.value === currentStage;

            return (
              <TabsTrigger
                key={stage.value}
                value={stage.value}
                disabled={disabled}
                className="relative flex flex-col items-start gap-1 p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {/* Stage Number and Icon */}
                <div className="flex items-center gap-2 w-full">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    status === 'complete'
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-primary-foreground text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {status === 'complete' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : status === 'active' && progress > 0 && progress < 100 ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <span className="text-lg">{stage.icon}</span>
                </div>

                {/* Stage Label */}
                <div className="text-left w-full">
                  <div className="font-semibold text-sm">{stage.label}</div>
                  <div className={`text-xs ${isActive ? 'opacity-90' : 'opacity-60'}`}>
                    {stage.description}
                  </div>
                </div>

                {/* Progress Bar */}
                {progress > 0 && progress < 100 && (
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                {/* Completion Badge */}
                {status === 'complete' && (
                  <Badge variant="secondary" className="absolute top-2 right-2 text-xs bg-green-100 text-green-700">
                    Complete
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Overall Progress */}
      <div className="flex items-center gap-4 px-2">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-semibold">
              {Math.round(
                (Object.values(stageCompletion).filter(Boolean).length / stages.length) * 100
              )}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 transition-all duration-500"
              style={{
                width: `${(Object.values(stageCompletion).filter(Boolean).length / stages.length) * 100}%`
              }}
            />
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {Object.values(stageCompletion).filter(Boolean).length} of {stages.length} stages complete
        </div>
      </div>
    </div>
  );
}
