/**
 * Quiz Retake Workflow Component
 * Manages quiz retakes with targeted drills and progress tracking
 */

import { useState } from "react";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  RotateCcw,
  Target,
  BookOpen,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lightbulb
} from "lucide-react";

interface RetakeAttempt {
  attemptNumber: number;
  score: number;
  date: Date;
  focusAreas: string[];
  timeSpent: number;
}

interface WeakArea {
  category: string;
  currentScore: number;
  targetScore: number;
  recommendedModules: string[];
  drillQuestions: number;
}

interface QuizRetakeWorkflowProps {
  pillarId: number;
  pillarTitle: string;
  currentScore: number;
  previousAttempts: RetakeAttempt[];
  weakAreas: WeakArea[];
  onStartRetake: (focusAreas?: string[]) => void;
  onStartDrill: (category: string) => void;
  maxAttempts?: number;
}

export default function QuizRetakeWorkflow({
  pillarId,
  pillarTitle,
  currentScore,
  previousAttempts,
  weakAreas,
  onStartRetake,
  onStartDrill,
  maxAttempts = 3
}: QuizRetakeWorkflowProps) {
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);
  const [showDrillMode, setShowDrillMode] = useState(false);

  const attemptsRemaining = maxAttempts - previousAttempts.length;
  const canRetake = attemptsRemaining > 0 && currentScore < 80;

  // Calculate improvement over attempts
  const improvementTrend = previousAttempts.length >= 2
    ? previousAttempts[previousAttempts.length - 1].score - previousAttempts[0].score
    : 0;

  const getRetakeStrategy = () => {
    if (currentScore >= 70) {
      return {
        strategy: "Targeted Review",
        description: "Focus on weak areas to push score above 80%",
        recommendedActions: ["Review weak categories", "Practice targeted drills", "Time management"]
      };
    } else if (currentScore >= 50) {
      return {
        strategy: "Comprehensive Review",
        description: "Review all pillar content before retaking",
        recommendedActions: ["Complete all learning modules", "Review pillar overview", "Practice full quiz"]
      };
    } else {
      return {
        strategy: "Foundation Building",
        description: "Build foundational knowledge before attempting quiz",
        recommendedActions: ["Start from basic modules", "Complete prerequisite content", "Use practice drills"]
      };
    }
  };

  const strategy = getRetakeStrategy();

  if (showDrillMode) {
    return (
      <div className="space-y-6">
        <SectionCard title="Practice Drills">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Practice specific topics to improve your understanding before retaking the full quiz.
            </p>

            {weakAreas.map((area) => (
              <Card key={area.category}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{area.category}</h4>
                      <p className="text-sm text-muted-foreground">
                        Current: {area.currentScore}% • Target: {area.targetScore}%
                      </p>
                    </div>
                    <Badge variant="outline">
                      {area.drillQuestions} questions
                    </Badge>
                  </div>

                  <Progress
                    value={(area.currentScore / area.targetScore) * 100}
                    className="mb-3"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {area.recommendedModules.slice(0, 2).map(module => (
                        <Badge key={module} variant="secondary" className="text-xs">
                          {module}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onStartDrill(area.category)}
                    >
                      Start Drill
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDrillMode(false)}>
                Back to Retake Options
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Retake Status */}
      <SectionCard title="Quiz Retake Options">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Pillar {pillarId}: {pillarTitle}</h3>
              <p className="text-muted-foreground">
                Current Score: {currentScore}% • Attempts Used: {previousAttempts.length}/{maxAttempts}
              </p>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${currentScore >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                {currentScore}%
              </div>
              <div className="text-sm text-muted-foreground">
                {attemptsRemaining} attempts left
              </div>
            </div>
          </div>

          {previousAttempts.length > 0 && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Attempt History
              </h4>
              <div className="space-y-2">
                {previousAttempts.map((attempt, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>Attempt {attempt.attemptNumber}</span>
                    <div className="flex items-center gap-3">
                      <span>{attempt.score}%</span>
                      <span className="text-muted-foreground">
                        {Math.floor(attempt.timeSpent / 60)}:{(attempt.timeSpent % 60).toString().padStart(2, '0')}
                      </span>
                      <span className="text-muted-foreground">
                        {attempt.date.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {improvementTrend > 0 && (
                <p className="text-sm text-green-600 mt-2">
                  ↑ {improvementTrend}% improvement over attempts
                </p>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Strategy Recommendation */}
      <SectionCard title="Recommended Strategy">
        <div className="space-y-4">
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">{strategy.strategy}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {strategy.description}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Recommended Actions:</h4>
            <div className="grid gap-2">
              {strategy.recommendedActions.map((action, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Weak Areas */}
      {weakAreas.length > 0 && (
        <SectionCard title="Focus Areas for Improvement">
          <div className="space-y-4">
            {weakAreas.map((area) => (
              <Card key={area.category}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{area.category}</h4>
                      <p className="text-sm text-muted-foreground">
                        Current: {area.currentScore}% → Target: {area.targetScore}%
                      </p>
                    </div>
                    <Badge variant={area.currentScore >= 70 ? 'secondary' : 'destructive'}>
                      {area.currentScore < 70 ? 'Needs Work' : 'Improving'}
                    </Badge>
                  </div>

                  <Progress
                    value={(area.currentScore / area.targetScore) * 100}
                    className="mb-3"
                  />

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {area.recommendedModules.length} recommended modules
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedFocusAreas([area.category]);
                        onStartRetake([area.category]);
                      }}
                    >
                      Focus Here
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-3">
              <Button onClick={() => setShowDrillMode(true)} variant="outline">
                <BookOpen className="h-4 w-4 mr-2" />
                Practice Drills
              </Button>
              <Button
                onClick={() => onStartRetake(weakAreas.map(a => a.category))}
                disabled={!canRetake}
              >
                <Target className="h-4 w-4 mr-2" />
                Retake with Focus Areas
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Action Buttons */}
      <SectionCard title="Retake Options">
        <div className="space-y-4">
          {!canRetake && currentScore < 80 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">Maximum Attempts Reached</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    You've used all {maxAttempts} attempts. Complete additional learning modules
                    to improve your understanding before the next assessment period.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {canRetake && (
              <>
                <Button onClick={() => onStartRetake()}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Full Retake
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDrillMode(true)}
                  disabled={weakAreas.length === 0}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Practice Drills
                </Button>
              </>
            )}

            <Button variant="outline">
              <BookOpen className="h-4 w-4 mr-2" />
              Review Pillar Content
            </Button>

            <Button variant="outline">
              <Clock className="h-4 w-4 mr-2" />
              Schedule Next Attempt
            </Button>
          </div>

          {selectedFocusAreas.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Focus Areas Selected:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedFocusAreas.map(area => (
                  <Badge key={area} variant="secondary" className="bg-blue-100 text-blue-800">
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Study Tips */}
      <SectionCard title="Study Tips">
        <div className="space-y-3">
          <div className="grid gap-3">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Lightbulb className="h-4 w-4 text-amber-600 mt-0.5" />
              <div>
                <h5 className="font-medium">Review Weak Areas First</h5>
                <p className="text-sm text-muted-foreground">
                  Focus on categories where you scored below 70% before attempting the full quiz.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <h5 className="font-medium">Time Management</h5>
                <p className="text-sm text-muted-foreground">
                  Practice answering questions within 60-90 seconds to improve efficiency.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <BookOpen className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <h5 className="font-medium">Complete Learning Modules</h5>
                <p className="text-sm text-muted-foreground">
                  Ensure you've completed all relevant learning modules before retaking.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
