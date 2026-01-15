/**
 * Pillar Progress Visualization Component
 * Shows visual progress through pillar modules and maturity levels
 */

import { SectionCard } from "@/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Lock, Target, TrendingUp } from "lucide-react";
import { CurriculumModule } from "@/data/curriculum";
import { ModuleStatus } from "@/lib/progress-logic";

interface PillarProgressVisualizationProps {
  pillarTitle: string;
  pillarNumber: number;
  modules: CurriculumModule[];
  completedModules: string[];
  inProgressModules: string[];
  userMaturityLevel: number;
  targetMaturityLevel: number;
}

export default function PillarProgressVisualization({
  pillarTitle,
  pillarNumber,
  modules,
  completedModules,
  inProgressModules,
  userMaturityLevel,
  targetMaturityLevel
}: PillarProgressVisualizationProps) {
  // Calculate progress
  const totalModules = modules.length;
  const completedCount = modules.filter(m => completedModules.includes(m.id)).length;
  const inProgressCount = modules.filter(m => inProgressModules.includes(m.id)).length;
  const completionPercentage = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

  // Get module status for visualization
  const getModuleStatusForViz = (module: CurriculumModule): ModuleStatus => {
    if (completedModules.includes(module.id)) return 'completed';
    if (inProgressModules.includes(module.id)) return 'in_progress';
    if (userMaturityLevel < module.requiredMaturityLevel) return 'locked';
    if (module.prerequisites && !module.prerequisites.every(p => completedModules.includes(p))) return 'locked';
    return 'available';
  };

  const getStatusIcon = (status: ModuleStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Circle className="h-4 w-4 text-blue-600 fill-blue-600" />;
      case 'available':
        return <Circle className="h-4 w-4 text-primary" />;
      default:
        return <Lock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: ModuleStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 border-green-300';
      case 'in_progress':
        return 'bg-blue-100 border-blue-300';
      case 'available':
        return 'bg-primary/10 border-primary/30';
      default:
        return 'bg-muted border-muted-foreground/30';
    }
  };

  return (
    <SectionCard
      title={`${pillarTitle} Progress`}
      description="Visual overview of your learning journey"
    >
      <div className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="font-medium">Overall Completion</span>
            </div>
            <Badge variant="secondary">
              {completedCount}/{totalModules} modules
            </Badge>
          </div>
          <Progress value={completionPercentage} className="h-3" />
          <div className="text-sm text-muted-foreground text-center">
            {completionPercentage}% complete
          </div>
        </div>

        {/* Maturity Level Progress */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Maturity Progress</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Current: L{userMaturityLevel} → Target: L{targetMaturityLevel}
            </div>
          </div>
          <Progress
            value={(userMaturityLevel / targetMaturityLevel) * 100}
            className="h-2"
          />
        </div>

        {/* Module Progress Grid */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <span>Module Progress</span>
          </h4>
          <div className="grid gap-3">
            {modules.map((module, index) => {
              const status = getModuleStatusForViz(module);
              return (
                <div
                  key={module.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${getStatusColor(status)}`}
                >
                  <div className="flex-shrink-0">
                    {getStatusIcon(status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">
                        Module {module.order}: {module.title}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        L{module.requiredMaturityLevel}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {module.estimatedDuration} • {module.skills?.slice(0, 2).join(', ')}
                      {module.skills && module.skills.length > 2 && '...'}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Badge
                      variant={status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Next Steps */}
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <h4 className="font-medium mb-2">Next Steps</h4>
          <div className="space-y-2 text-sm">
            {completedCount < totalModules ? (
              <p>
                Complete {totalModules - completedCount} more module{totalModules - completedCount !== 1 ? 's' : ''} to finish this pillar.
              </p>
            ) : (
              <p>
                🎉 Pillar complete! Take the quiz to earn certification and unlock advanced content.
              </p>
            )}
            {userMaturityLevel < targetMaturityLevel && (
              <p className="text-muted-foreground">
                Reach maturity level L{targetMaturityLevel} to fully unlock this pillar's potential.
              </p>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
