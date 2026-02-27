/**
 * Quiz Results Breakdown Component
 * Provides detailed analysis of quiz performance by topics and categories
 */

import { SectionCard } from "@/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle
} from "lucide-react";

interface CategoryBreakdown {
  [category: string]: {
    correct: number;
    total: number;
    score: number;
    questions: Array<{
      questionId: number;
      isCorrect: boolean;
      timeSpent: number;
      difficulty: string;
    }>;
  };
}

interface DifficultyBreakdown {
  easy: number;
  medium: number;
  hard: number;
}

interface QuizResultsBreakdownProps {
  categoryBreakdown: CategoryBreakdown;
  difficultyBreakdown: DifficultyBreakdown;
  overallScore: number;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
}

export default function QuizResultsBreakdown({
  categoryBreakdown,
  difficultyBreakdown,
  overallScore,
  passed,
  totalQuestions,
  correctAnswers,
  timeSpent
}: QuizResultsBreakdownProps) {
  // Calculate performance metrics
  const getPerformanceLevel = (score: number) => {
    if (score >= 90) return { level: 'Excellent', color: 'text-green-600', icon: CheckCircle2 };
    if (score >= 80) return { level: 'Good', color: 'text-blue-600', icon: CheckCircle2 };
    if (score >= 70) return { level: 'Fair', color: 'text-yellow-600', icon: AlertTriangle };
    return { level: 'Needs Improvement', color: 'text-red-600', icon: XCircle };
  };

  const overallPerformance = getPerformanceLevel(overallScore);

  // Identify strengths and weaknesses
  const strengths = Object.entries(categoryBreakdown)
    .filter(([_, breakdown]) => breakdown.score >= 80)
    .map(([category]) => category);

  const weaknesses = Object.entries(categoryBreakdown)
    .filter(([_, breakdown]) => breakdown.score < 70)
    .map(([category]) => category);

  // Calculate time efficiency
  const avgTimePerQuestion = timeSpent / totalQuestions;
  const timeEfficiency = avgTimePerQuestion < 60 ? 'Efficient' : avgTimePerQuestion < 120 ? 'Moderate' : 'Slow';

  return (
    <div className="space-y-6">
      {/* Overall Performance Summary */}
      <SectionCard title="Performance Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${overallPerformance.color}`}>
                {overallScore}%
              </div>
              <div className="text-sm text-muted-foreground">Overall Score</div>
              <div className="text-xs text-muted-foreground mt-1">
                {overallPerformance.level}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {correctAnswers}/{totalQuestions}
              </div>
              <div className="text-sm text-muted-foreground">Correct Answers</div>
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round((correctAnswers / totalQuestions) * 100)}% accuracy
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-sm text-muted-foreground">Total Time</div>
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round(avgTimePerQuestion)}s per question
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                {passed ? '✓' : '✗'}
              </div>
              <div className="text-sm text-muted-foreground">Passed</div>
              <div className="text-xs text-muted-foreground mt-1">
                80% required
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Performance Insights</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Time Efficiency:</span>
              <Badge variant={timeEfficiency === 'Efficient' ? 'default' : 'secondary'}>
                {timeEfficiency}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Overall Performance:</span>
              <Badge variant={passed ? 'default' : 'destructive'}>
                {overallPerformance.level}
              </Badge>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Category Breakdown */}
      <SectionCard title="Topic Performance">
        <div className="space-y-4">
          {Object.entries(categoryBreakdown).map(([category, breakdown]) => {
            const performance = getPerformanceLevel(breakdown.score);
            const PerformanceIcon = performance.icon;

            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PerformanceIcon className={`h-5 w-5 ${performance.color}`} />
                    <span className="font-medium">{category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {breakdown.correct}/{breakdown.total}
                    </span>
                    <Badge variant={breakdown.score >= 80 ? 'default' : breakdown.score >= 70 ? 'secondary' : 'destructive'}>
                      {breakdown.score}%
                    </Badge>
                  </div>
                </div>

                <Progress value={breakdown.score} className="h-2" />

                {/* Question-level details */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 ml-8">
                  {breakdown.questions.map((question, index) => (
                    <div
                      key={question.questionId}
                      className={`text-xs p-2 rounded border ${
                        question.isCorrect
                          ? 'bg-green-50 border-green-200 text-green-800'
                          : 'bg-red-50 border-red-200 text-red-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>Q{index + 1}</span>
                        <div className="flex items-center gap-1">
                          <span>{question.timeSpent}s</span>
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            {question.difficulty}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Difficulty Analysis */}
      <SectionCard title="Difficulty Analysis">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-xl font-bold text-green-600">
                  {difficultyBreakdown.easy}
                </div>
                <div className="text-sm text-muted-foreground">Easy Questions</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Correct answers
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-xl font-bold text-blue-600">
                  {difficultyBreakdown.medium}
                </div>
                <div className="text-sm text-muted-foreground">Medium Questions</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Correct answers
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-xl font-bold text-red-600">
                  {difficultyBreakdown.hard}
                </div>
                <div className="text-sm text-muted-foreground">Hard Questions</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Correct answers
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Difficulty Insights</h4>
            <div className="space-y-1 text-sm">
              {difficultyBreakdown.hard === 0 && difficultyBreakdown.medium >= difficultyBreakdown.easy && (
                <p className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span>Strong performance across all difficulty levels</span>
                </p>
              )}
              {difficultyBreakdown.hard < difficultyBreakdown.easy && (
                <p className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-yellow-600" />
                  <span>Struggles with harder questions - consider additional study</span>
                </p>
              )}
              {(difficultyBreakdown.easy + difficultyBreakdown.medium) > 0 && difficultyBreakdown.hard === 0 && (
                <p className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span>Good foundation - ready to tackle advanced topics</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Strengths and Weaknesses */}
      <SectionCard title="Strengths & Areas for Improvement">
        <div className="space-y-4">
          {strengths.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Strengths
              </h4>
              <div className="flex flex-wrap gap-2">
                {strengths.map(strength => (
                  <Badge key={strength} variant="default" className="bg-green-100 text-green-800">
                    {strength}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {weaknesses.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2 text-yellow-700">
                <AlertTriangle className="h-4 w-4" />
                Areas for Improvement
              </h4>
              <div className="flex flex-wrap gap-2">
                {weaknesses.map(weakness => (
                  <Badge key={weakness} variant="destructive">
                    {weakness}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {strengths.length === 0 && weaknesses.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Balanced performance across all topics</p>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
