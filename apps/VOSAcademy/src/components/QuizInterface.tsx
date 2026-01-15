/**
 * Adaptive Quiz Interface Component
 * Advanced quiz system with adaptive scoring, instant feedback, and targeted learning
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SectionCard } from "@/components/SectionCard";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  BookCheck,
  Target,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  RotateCcw,
  Award
} from "lucide-react";

export interface QuizQuestion {
  id: number;
  pillarId: number;
  questionText: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  roleVariants?: Record<string, {
    questionText: string;
    options: string[];
  }>;
  options: Array<{
    value: string;
    label: string;
    explanation?: string;
  }>;
  correctAnswer: string;
  explanation: string;
  learningObjectives: string[];
  relatedModules?: string[];
}

export interface QuizAttempt {
  questionId: number;
  selectedAnswer: string;
  isCorrect: boolean;
  timeSpent: number;
  confidence?: number;
  hintsUsed?: number;
}

export interface QuizResult {
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  categoryBreakdown: Record<string, {
    correct: number;
    total: number;
    score: number;
  }>;
  difficultyBreakdown: Record<string, number>;
  recommendedActions: string[];
  nextSteps: string[];
}

interface QuizInterfaceProps {
  questions: QuizQuestion[];
  pillarId: number;
  pillarTitle: string;
  userRole?: string;
  userMaturityLevel?: number;
  onComplete: (result: QuizResult, attempts: QuizAttempt[]) => void;
  onCancel?: () => void;
  timeLimit?: number; // in minutes
  adaptiveMode?: boolean;
  showInstantFeedback?: boolean;
}

export default function QuizInterface({
  questions,
  pillarId,
  pillarTitle,
  userRole,
  userMaturityLevel = 0,
  onComplete,
  onCancel,
  timeLimit,
  adaptiveMode = true,
  showInstantFeedback = true
}: QuizInterfaceProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [questionAttempts, setQuestionAttempts] = useState<QuizAttempt[]>([]);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [questionStartTime, setQuestionStartTime] = useState<Date>(new Date());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(timeLimit ? timeLimit * 60 : null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{
    isCorrect: boolean;
    explanation: string;
    learningObjectives: string[];
  } | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  // Timer effect
  useEffect(() => {
    if (!timeRemaining || quizCompleted) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, quizCompleted]);

  const handleTimeUp = () => {
    // Auto-submit with current answers
    handleSubmitQuiz();
  };

  // Get current question with role adaptation
  const currentQuestion = useMemo(() => {
    if (!questions[currentQuestionIndex]) return null;

    const baseQuestion = questions[currentQuestionIndex];

    // Apply role-specific variants if available
    if (userRole && baseQuestion.roleVariants?.[userRole]) {
      const variant = baseQuestion.roleVariants[userRole];
      return {
        ...baseQuestion,
        questionText: variant.questionText,
        options: variant.options.map((option, index) => ({
          value: `option-${index}`,
          label: option,
          explanation: baseQuestion.options[index]?.explanation
        }))
      };
    }

    return baseQuestion;
  }, [questions, currentQuestionIndex, userRole]);

  const currentAnswer = selectedAnswers[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  // Adaptive scoring logic
  const calculateAdaptiveScore = (attempts: QuizAttempt[]): number => {
    if (!adaptiveMode) {
      // Simple scoring
      const correct = attempts.filter(a => a.isCorrect).length;
      return Math.round((correct / attempts.length) * 100);
    }

    // Adaptive scoring based on difficulty and time
    let totalScore = 0;
    let maxPossible = 0;

    attempts.forEach(attempt => {
      const question = questions.find(q => q.id === attempt.questionId);
      if (!question) return;

      // Base points for correctness
      const basePoints = attempt.isCorrect ? 1 : 0;

      // Difficulty multiplier
      const difficultyMultiplier = {
        easy: 0.8,
        medium: 1.0,
        hard: 1.2
      }[question.difficulty] || 1.0;

      // Time efficiency bonus (faster correct answers get bonus)
      const timeBonus = attempt.isCorrect && attempt.timeSpent < 60 ? 0.1 : 0;

      const questionScore = (basePoints * difficultyMultiplier) + timeBonus;
      totalScore += questionScore;
      maxPossible += difficultyMultiplier;
    });

    return Math.round((totalScore / maxPossible) * 100);
  };

  const handleSelectAnswer = (value: string) => {
    setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: value }));
  };

  const handleShowFeedback = () => {
    if (!currentQuestion || !currentAnswer) return;

    const isCorrect = currentAnswer === currentQuestion.correctAnswer;
    const timeSpent = Math.round((new Date().getTime() - questionStartTime.getTime()) / 1000);

    // Record attempt
    const attempt: QuizAttempt = {
      questionId: currentQuestion.id,
      selectedAnswer: currentAnswer,
      isCorrect,
      timeSpent
    };

    setQuestionAttempts(prev => [...prev, attempt]);
    setFeedbackData({
      isCorrect,
      explanation: currentQuestion.explanation,
      learningObjectives: currentQuestion.learningObjectives
    });
    setShowFeedback(true);
  };

  const handleNextQuestion = () => {
    setShowFeedback(false);
    setFeedbackData(null);
    setQuestionStartTime(new Date());

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleSubmitQuiz();
    }
  };

  const handleSubmitQuiz = () => {
    const totalTimeSpent = Math.round((new Date().getTime() - startTime.getTime()) / 1000);
    const score = calculateAdaptiveScore(questionAttempts);
    const passed = score >= 80; // 80% pass requirement

    // Calculate category breakdown
    const categoryBreakdown: Record<string, { correct: number; total: number; score: number }> = {};
    questionAttempts.forEach(attempt => {
      const question = questions.find(q => q.id === attempt.questionId);
      if (!question) return;

      if (!categoryBreakdown[question.category]) {
        categoryBreakdown[question.category] = { correct: 0, total: 0, score: 0 };
      }

      categoryBreakdown[question.category].total++;
      if (attempt.isCorrect) {
        categoryBreakdown[question.category].correct++;
      }
    });

    Object.keys(categoryBreakdown).forEach(category => {
      const breakdown = categoryBreakdown[category];
      breakdown.score = Math.round((breakdown.correct / breakdown.total) * 100);
    });

    // Calculate difficulty breakdown
    const difficultyBreakdown: Record<string, number> = {};
    questionAttempts.forEach(attempt => {
      const question = questions.find(q => q.id === attempt.questionId);
      if (!question) return;

      if (!difficultyBreakdown[question.difficulty]) {
        difficultyBreakdown[question.difficulty] = 0;
      }
      if (attempt.isCorrect) {
        difficultyBreakdown[question.difficulty]++;
      }
    });

    // Generate recommendations
    const recommendedActions = generateRecommendations(score, categoryBreakdown, userMaturityLevel);
    const nextSteps = generateNextSteps(passed, score, userMaturityLevel);

    const result: QuizResult = {
      score,
      passed,
      totalQuestions: questions.length,
      correctAnswers: questionAttempts.filter(a => a.isCorrect).length,
      timeSpent: totalTimeSpent,
      categoryBreakdown,
      difficultyBreakdown,
      recommendedActions,
      nextSteps
    };

    setQuizResult(result);
    setQuizCompleted(true);
    onComplete(result, questionAttempts);
  };

  const generateRecommendations = (
    score: number,
    categoryBreakdown: Record<string, any>,
    maturityLevel: number
  ): string[] => {
    const recommendations: string[] = [];

    if (score < 70) {
      recommendations.push("Review fundamental concepts in the pillar content");
      recommendations.push("Focus on practice exercises to build understanding");
    }

    // Category-specific recommendations
    Object.entries(categoryBreakdown).forEach(([category, breakdown]) => {
      if (breakdown.score < 70) {
        recommendations.push(`Strengthen ${category} knowledge through targeted modules`);
      }
    });

    if (maturityLevel < 2) {
      recommendations.push("Complete basic maturity assessment to unlock advanced content");
    }

    return recommendations;
  };

  const generateNextSteps = (passed: boolean, score: number, maturityLevel: number): string[] => {
    const nextSteps: string[] = [];

    if (passed) {
      nextSteps.push("Proceed to next pillar or advanced modules");
      nextSteps.push("Check certification status in profile");
      if (maturityLevel < 5) {
        nextSteps.push("Consider taking maturity assessment for level advancement");
      }
    } else {
      nextSteps.push("Review pillar content and retake quiz");
      nextSteps.push("Focus on weak areas identified in results");
      nextSteps.push("Complete additional learning modules");
    }

    return nextSteps;
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuestionAttempts([]);
    setStartTime(new Date());
    setQuestionStartTime(new Date());
    setTimeRemaining(timeLimit ? timeLimit * 60 : null);
    setShowFeedback(false);
    setFeedbackData(null);
    setQuizCompleted(false);
    setQuizResult(null);
  };

  // Format time remaining
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (quizCompleted && quizResult) {
    return (
      <div className="space-y-6">
        {/* Results Header */}
        <SectionCard title="Quiz Results">
          <div className="text-center space-y-4">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${
              quizResult.passed ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
            }`}>
              {quizResult.passed ? (
                <CheckCircle2 className="h-10 w-10" />
              ) : (
                <XCircle className="h-10 w-10" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {quizResult.passed ? "Quiz Passed!" : "Quiz Completed"}
              </h2>
              <p className="text-muted-foreground">
                Pillar {pillarId}: {pillarTitle}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Score Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{quizResult.score}%</div>
              <div className="text-sm text-muted-foreground">Overall Score</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {quizResult.correctAnswers}/{quizResult.totalQuestions}
              </div>
              <div className="text-sm text-muted-foreground">Correct Answers</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {Math.floor(quizResult.timeSpent / 60)}:{(quizResult.timeSpent % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-sm text-muted-foreground">Time Spent</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {quizResult.passed ? "✓" : "✗"}
              </div>
              <div className="text-sm text-muted-foreground">Passed (80%)</div>
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown */}
        <SectionCard title="Category Performance">
          <div className="space-y-3">
            {Object.entries(quizResult.categoryBreakdown).map(([category, breakdown]) => (
              <div key={category} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="font-medium">{category}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {breakdown.correct}/{breakdown.total}
                  </span>
                  <Badge variant={breakdown.score >= 80 ? "default" : "secondary"}>
                    {breakdown.score}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Recommendations */}
        <SectionCard title="Recommendations">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Recommended Actions
              </h4>
              <ul className="space-y-2">
                {quizResult.recommendedActions.map((action, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="text-sm">{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Next Steps
              </h4>
              <ul className="space-y-2">
                {quizResult.nextSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleRestart} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Retake Quiz
          </Button>
          {onCancel && (
            <Button onClick={onCancel} variant="outline">
              Back to Pillar
            </Button>
          )}
          <Button>
            <Award className="h-4 w-4 mr-2" />
            View Certification
          </Button>
        </div>
      </div>
    );
  }

  if (showFeedback && feedbackData) {
    return (
      <div className="space-y-6">
        <SectionCard title="Question Feedback">
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border-2 ${
              feedbackData.isCorrect
                ? 'border-green-200 bg-green-50'
                : 'border-yellow-200 bg-yellow-50'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                {feedbackData.isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-yellow-600" />
                )}
                <span className="font-medium">
                  {feedbackData.isCorrect ? "Correct!" : "Incorrect"}
                </span>
              </div>
              <p className="text-sm">{feedbackData.explanation}</p>
            </div>

            <div>
              <h4 className="font-medium mb-2">Learning Objectives Addressed:</h4>
              <ul className="space-y-1">
                {feedbackData.learningObjectives.map((objective, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-1">•</span>
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>

        <div className="flex justify-end">
          <Button onClick={handleNextQuestion}>
            {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Complete Quiz"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <SectionCard title="Loading Quiz...">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Preparing questions...</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quiz Header */}
      <SectionCard title={`Pillar ${pillarId} Quiz`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{pillarTitle}</h2>
            <p className="text-sm text-muted-foreground">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {timeRemaining && (
              <div className={`text-sm font-medium ${
                timeRemaining < 300 ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {timeRemaining < 300 && <AlertTriangle className="h-4 w-4 inline mr-1" />}
                {formatTime(timeRemaining)}
              </div>
            )}
            {userRole && (
              <Badge variant="outline">{userRole}</Badge>
            )}
          </div>
        </div>
        <Progress value={progress} className="mt-4" />
      </SectionCard>

      {/* Question Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline">{currentQuestion.category}</Badge>
            <Badge variant="secondary">{currentQuestion.difficulty}</Badge>
          </div>
          <CardTitle className="text-lg">{currentQuestion.questionText}</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={currentAnswer || ""}
            onValueChange={handleSelectAnswer}
          >
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50 ${
                    currentAnswer === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                  onClick={() => handleSelectAnswer(option.value)}
                >
                  <RadioGroupItem value={option.value} id={`q-${currentQuestionIndex}-${index}`} />
                  <div className="flex-1">
                    <Label
                      htmlFor={`q-${currentQuestionIndex}-${index}`}
                      className="font-medium cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          </RadioGroup>

          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              {showInstantFeedback && currentAnswer && (
                <Button onClick={handleShowFeedback} variant="outline">
                  Check Answer
                </Button>
              )}
              <Button
                onClick={handleNextQuestion}
                disabled={!currentAnswer}
              >
                {currentQuestionIndex < questions.length - 1 ? "Next" : "Submit Quiz"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
