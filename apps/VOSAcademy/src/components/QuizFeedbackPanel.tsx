/**
 * Quiz Feedback Panel Component
 * Provides instant feedback and learning reinforcement
 */

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  RotateCcw,
  Target,
  XCircle
} from "lucide-react";

import { SectionCard } from "@/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FeedbackData {
  isCorrect: boolean;
  explanation: string;
  learningObjectives: string[];
  relatedModules?: string[];
  hints?: string[];
  nextSteps?: string[];
}

interface QuizFeedbackPanelProps {
  feedback: FeedbackData;
  onContinue: () => void;
  onRetry?: () => void;
  showRetry?: boolean;
  timeSpent?: number;
  questionDifficulty?: string;
}

export default function QuizFeedbackPanel({
  feedback,
  onContinue,
  onRetry,
  showRetry = false,
  timeSpent,
  questionDifficulty
}: QuizFeedbackPanelProps) {
  return (
    <SectionCard title="Question Feedback">
      <div className="space-y-6">
        {/* Correct/Incorrect Indicator */}
        <div className={`p-6 rounded-lg border-2 ${
          feedback.isCorrect
            ? 'border-green-200 bg-green-50'
            : 'border-yellow-200 bg-yellow-50'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            {feedback.isCorrect ? (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-yellow-600" />
            )}
            <div>
              <h3 className="text-lg font-semibold">
                {feedback.isCorrect ? "Correct!" : "Not quite right"}
              </h3>
              {timeSpent && (
                <p className="text-sm text-muted-foreground">
                  Answered in {Math.round(timeSpent)} seconds
                  {questionDifficulty && ` • ${questionDifficulty} difficulty`}
                </p>
              )}
            </div>
          </div>

          <p className="text-sm leading-relaxed">{feedback.explanation}</p>
        </div>

        {/* Learning Objectives */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Learning Objectives Covered
          </h4>
          <div className="space-y-2">
            {feedback.learningObjectives.map((objective, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{objective}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Related Modules */}
        {feedback.relatedModules && feedback.relatedModules.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Related Learning Modules
            </h4>
            <div className="flex flex-wrap gap-2">
              {feedback.relatedModules.map((module, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {module}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Hints for Incorrect Answers */}
        {!feedback.isCorrect && feedback.hints && feedback.hints.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-600" />
              Hints for Next Time
            </h4>
            <div className="space-y-2">
              {feedback.hints.map((hint, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Lightbulb className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-amber-800">{hint}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {feedback.nextSteps && feedback.nextSteps.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Recommended Next Steps</h4>
            <div className="space-y-2">
              {feedback.nextSteps.map((step, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <ArrowRight className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-blue-800">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {showRetry && onRetry && (
            <Button onClick={onRetry} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
          <Button onClick={onContinue} className="ml-auto">
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
