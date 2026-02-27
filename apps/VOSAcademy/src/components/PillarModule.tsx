/**
 * PillarModule Component
 * Displays individual module content with progress tracking and unlocking logic
 */

import { useState } from "react";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, CheckCircle2, Clock, Lock, Play, Target } from "lucide-react";
import { CurriculumModule } from "@/data/curriculum";
import { ModuleStatus } from "@/lib/progress-logic";

interface PillarModuleProps {
  module: CurriculumModule;
  status: ModuleStatus;
  userMaturityLevel: number;
  onStartModule: (moduleId: string) => void;
  onCompleteModule: (moduleId: string) => void;
  className?: string;
}

export default function PillarModule({
  module,
  status,
  userMaturityLevel,
  onStartModule,
  onCompleteModule,
  className = ""
}: PillarModuleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Play className="h-5 w-5 text-blue-600" />;
      case 'available':
        return <BookOpen className="h-5 w-5 text-primary" />;
      default:
        return <Lock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'in_progress':
        return 'border-blue-200 bg-blue-50';
      case 'available':
        return 'border-primary/20 bg-primary/5';
      default:
        return 'border-muted bg-muted/50';
    }
  };

  const getActionButton = () => {
    switch (status) {
      case 'completed':
        return (
          <Button variant="outline" size="sm" disabled>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Completed
          </Button>
        );
      case 'in_progress':
        return (
          <Button size="sm" onClick={() => onCompleteModule(module.id)}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark Complete
          </Button>
        );
      case 'available':
        return (
          <Button size="sm" onClick={() => onStartModule(module.id)}>
            <Play className="h-4 w-4 mr-2" />
            Start Module
          </Button>
        );
      default:
        return (
          <Button variant="outline" size="sm" disabled>
            <Lock className="h-4 w-4 mr-2" />
            Locked
          </Button>
        );
    }
  };

  const getRequirementsText = () => {
    if (status !== 'locked') return null;

    const requirements = [];
    if (userMaturityLevel < module.requiredMaturityLevel) {
      requirements.push(`Maturity Level ${module.requiredMaturityLevel}`);
    }
    if (module.prerequisites && module.prerequisites.length > 0) {
      requirements.push(`${module.prerequisites.length} prerequisite module${module.prerequisites.length > 1 ? 's' : ''}`);
    }

    return requirements.length > 0 ? `Requires: ${requirements.join(', ')}` : 'Locked';
  };

  return (
    <SectionCard
      title={
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <span>{module.title}</span>
          <Badge variant="outline" className="ml-auto">
            Module {module.order}
          </Badge>
        </div>
      }
      className={`${getStatusColor()} ${className}`}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-muted-foreground mb-3">{module.description}</p>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{module.estimatedDuration}</span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                <span>L{module.requiredMaturityLevel}</span>
              </div>
              {module.skills && module.skills.length > 0 && (
                <div className="flex items-center gap-1">
                  <span>Skills: {module.skills.join(', ')}</span>
                </div>
              )}
            </div>

            {status === 'locked' && (
              <div className="p-3 bg-muted/50 rounded-lg border border-muted">
                <p className="text-sm text-muted-foreground">{getRequirementsText()}</p>
              </div>
            )}

            {module.prerequisites && module.prerequisites.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium mb-2">Prerequisites:</p>
                <div className="flex flex-wrap gap-2">
                  {module.prerequisites.map(prereq => (
                    <Badge key={prereq} variant="secondary" className="text-xs">
                      {prereq}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="ml-4">
            {getActionButton()}
          </div>
        </div>

        {/* Module Content - Expandable */}
        {status !== 'locked' && (
          <div className="border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mb-3"
            >
              {isExpanded ? 'Hide Content' : 'Show Content'}
            </Button>

            {isExpanded && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Module Overview</h4>
                  <p className="text-sm text-muted-foreground">
                    This module covers the fundamental concepts and practical applications of {module.title.toLowerCase()}.
                    You'll learn through interactive content, examples, and exercises designed to build your expertise.
                  </p>
                </div>

                {module.skills && module.skills.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Skills You'll Develop</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {module.skills.map(skill => (
                        <div key={skill} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          <span>{skill}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Learning Activities</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Interactive content and examples</li>
                    <li>• Practical exercises and case studies</li>
                    <li>• Knowledge checks and quizzes</li>
                    <li>• Downloadable templates and resources</li>
                  </ul>
                </div>

                {module.resources && module.resources.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Related Resources</h4>
                    <div className="flex flex-wrap gap-2">
                      {module.resources.map(resource => (
                        <Badge key={resource} variant="outline" className="text-xs">
                          {resource}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Progress Indicator for In-Progress Modules */}
        {status === 'in_progress' && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">0%</span>
            </div>
            <Progress value={0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Complete the module content and quiz to mark as finished
            </p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
