/**
 * Role Maturity Track Component
 * Displays a visual progression track for a user's role-specific maturity advancement
 */

import { getCurriculumForRole, MATURITY_LEVELS } from "@/data/curriculum";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SectionCard } from "@/components/SectionCard";
import { CheckCircle, Circle, Lock, Target } from "lucide-react";

interface RoleMaturityTrackProps {
  role: string;
  currentLevel: number;
}

export default function RoleMaturityTrack({ role, currentLevel }: RoleMaturityTrackProps) {
  const curriculum = getCurriculumForRole(role);

  if (!curriculum) {
    return (
      <SectionCard title="Role Maturity Track">
        <div className="text-center py-8 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Unable to load maturity track for this role</p>
        </div>
      </SectionCard>
    );
  }

  const getLevelStatus = (level: number) => {
    if (level < currentLevel) return 'completed';
    if (level === currentLevel) return 'current';
    return 'locked';
  };

  const getLevelIcon = (level: number) => {
    const status = getLevelStatus(level);
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'current':
        return <Circle className="h-5 w-5 text-primary fill-primary" />;
      default:
        return <Lock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getLevelColor = (level: number) => {
    const status = getLevelStatus(level);
    switch (status) {
      case 'completed':
        return 'maturity-completed';
      case 'current':
        return 'maturity-current';
      default:
        return 'maturity-locked';
    }
  };

  // Calculate progress percentage
  const progressPercentage = ((currentLevel + 1) / 6) * 100; // L0-L5 = 6 levels

  return (
    <SectionCard
      title={`${curriculum.displayName} Maturity Track`}
      description="Your progression through value engineering maturity levels"
    >
      <div className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">
              Level {currentLevel} of 5 ({Math.round(progressPercentage)}%)
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Maturity Levels */}
        <div className="space-y-4">
          {Object.entries(MATURITY_LEVELS).map(([levelStr, levelData]) => {
            const level = parseInt(levelStr);
            const status = getLevelStatus(level);
            const isCompleted = status === 'completed';
            const isCurrent = status === 'current';

            return (
              <Card
                key={level}
                className={`transition-all ${
                  isCurrent ? 'ring-2 ring-primary shadow-lg' : ''
                } ${isCompleted ? 'bg-green-50 border-green-200' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full ${getLevelColor(level)} flex items-center justify-center font-bold text-white`}>
                        {level}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{levelData.label}</CardTitle>
                        <CardDescription className="text-sm">
                          {levelData.description}
                        </CardDescription>
                      </div>
                    </div>
                    {getLevelIcon(level)}
                  </div>
                </CardHeader>

                {(isCompleted || isCurrent) && (
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Key Behaviors:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {levelData.behaviors.map((behavior, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-primary mt-1">•</span>
                              <span>{behavior}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm mb-2">Business Outcomes:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {levelData.outcomes.map((outcome, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-green-600 mt-1">•</span>
                              <span>{outcome}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Next Steps */}
        {currentLevel < 5 && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">
                  Next: {MATURITY_LEVELS[currentLevel + 1]?.label}
                </h4>
                <p className="text-sm text-blue-700 mb-3">
                  {MATURITY_LEVELS[currentLevel + 1]?.description}
                </p>
                <Badge variant="secondary" className="text-xs">
                  Continue learning to advance to the next level
                </Badge>
              </div>
            </div>
          </div>
        )}

        {currentLevel === 5 && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900 mb-1">
                  🎉 Value Engineering Mastery Achieved!
                </h4>
                <p className="text-sm text-green-700">
                  You have reached the highest level of value engineering maturity. You are now a recognized expert in your field.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
