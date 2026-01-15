import { SidebarLayout } from "@/components/SidebarLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, ArrowRight, ArrowLeft, BookCheck } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function Quiz() {
  const { pillarNumber } = useParams<{ pillarNumber: string }>();
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);

  const pillarNum = parseInt(pillarNumber || "1");

  // Fetch pillar data
  const { data: pillar, isLoading: pillarLoading } = trpc.pillars.getByNumber.useQuery(
    { pillarNumber: pillarNum },
    { enabled: !!pillarNumber }
  );

  // Fetch quiz questions
  const { data: questions, isLoading: questionsLoading } = trpc.quiz.getQuestions.useQuery(
    { pillarId: pillar?.id || 0 },
    { enabled: !!pillar?.id }
  );

  const submitQuizMutation = trpc.quiz.submitQuiz.useMutation({
    onSuccess: (result: any) => {
      setQuizResult(result);
      setQuizSubmitted(true);
      toast.success("Quiz completed!");
    },
    onError: (error: any) => {
      toast.error(`Failed to submit quiz: ${error.message}`);
    }
  });

  if (!loading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const isLoadingAny = loading || pillarLoading || questionsLoading;
  const totalQuestions = questions?.length ?? 0;
  const currentQuestion = totalQuestions > 0 ? questions[currentQuestionIndex] : null;
  const currentAnswer = selectedAnswers[currentQuestionIndex];

  const handleSelectAnswer = (value: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [currentQuestionIndex]: value }));
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (!questions || currentQuestionIndex >= questions.length - 1) return;
    setCurrentQuestionIndex((prev) => prev + 1);
  };

  const handleSubmitQuiz = () => {
    if (!questions || !questions.length || !pillar) return;

    const answersPayload = questions.map((q: any, index: number) => {
      const selected = selectedAnswers[index];
      const isCorrect = selected === q.correctAnswer;
      return {
        questionId: q.id,
        selectedAnswer: selected,
        isCorrect,
        pointsEarned: isCorrect ? 1 : 0,
      };
    });

    const correctCount = answersPayload.filter((a) => a.isCorrect).length;
    const score = Math.round((correctCount / questions.length) * 100);
    setLastScore(score);

    submitQuizMutation.mutate({
      pillarId: pillar.id,
      answers: answersPayload,
      score,
    });
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizSubmitted(false);
    setQuizResult(null);
    setLastScore(null);
  };

  if (isLoadingAny) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading quiz...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (!pillar || !questions || !questions.length) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle>Quiz Unavailable</CardTitle>
              <CardDescription>
                We couldn&apos;t find a quiz for this pillar.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button variant="outline" onClick={() => setLocation(`/pillar/${pillarNum}`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Pillar
              </Button>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </SidebarLayout>
    );
  }

  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  if (quizSubmitted && quizResult) {
    const passed = !!quizResult.passed;
    const score = lastScore ?? quizResult.score ?? null;

    return (
      <SidebarLayout>
        <div className="min-h-screen bg-background">
          <main className="py-8">
            <div className="container max-w-3xl space-y-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button variant="ghost" size="sm" onClick={() => setLocation(`/pillar/${pillar.pillarNumber}`)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Pillar
                </Button>
              </div>

              <Card className="bg-card text-card-foreground shadow-beautiful-lg rounded-xl">
                <CardHeader>
                  <div className="flex items-center gap-4 mb-2">
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center ${passed ? "bg-green-500/10" : "bg-yellow-500/10"}`}>
                      {passed ? (
                        <CheckCircle2 className="h-7 w-7 text-green-500" />
                      ) : (
                        <XCircle className="h-7 w-7 text-yellow-500" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        {passed ? "Quiz Passed" : "Quiz Results"}
                      </CardTitle>
                      <CardDescription>
                        Pillar {pillar.pillarNumber}: {pillar.title}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg shadow-beautiful-sm">
                      <div className="text-2xl font-bold text-primary">
                        {score !== null ? score : "-"}
                      </div>
                      <div className="text-sm text-muted-foreground">Score</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg shadow-beautiful-sm">
                      <div className="text-2xl font-bold text-primary">
                        {totalQuestions}
                      </div>
                      <div className="text-sm text-muted-foreground">Questions</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg shadow-beautiful-sm">
                      <div className="text-2xl font-bold text-primary">
                        {passed ? "Yes" : "No"}
                      </div>
                      <div className="text-sm text-muted-foreground">Passed</div>
                    </div>
                  </div>

                  <div className="p-4 bg-primary/5 border-l-4 border-primary rounded-r-lg">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <BookCheck className="h-5 w-5 text-primary" />
                      Next Steps
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {passed
                        ? "Great work! Continue to the next pillar or review the certification details in your profile."
                        : "Review the pillar content and try the quiz again to improve your score."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleRestart} variant="outline">
                      Retake Quiz
                    </Button>
                    <Link href="/dashboard">
                      <Button variant="outline">Go to Dashboard</Button>
                    </Link>
                    <Link href="/certifications">
                      <Button variant="ghost" className="gap-2">
                        <ArrowRight className="h-4 w-4" />
                        View Certifications
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-background">
        <main className="py-8">
          <div className="container max-w-3xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 mr-1"
                    onClick={() => setLocation(`/pillar/${pillar.pillarNumber}`)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span>Pillar {pillar.pillarNumber}</span>
                  <span className="text-muted-foreground">•</span>
                  <span>{pillar.title}</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Pillar Quiz</h1>
                <p className="text-sm text-muted-foreground">
                  Test your understanding of this pillar to progress your VOS certification.
                </p>
              </div>
              <Badge variant="outline">{user?.vosRole || "Learner"}</Badge>
            </div>

            {/* Question Card */}
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">
                    Question {currentQuestionIndex + 1} of {totalQuestions}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {currentQuestion?.category}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
                <CardTitle className="mt-4 text-lg">
                  {currentQuestion?.questionText}
                </CardTitle>
                <CardDescription>
                  Select the best answer below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup
                  value={currentAnswer ?? ""}
                  onValueChange={handleSelectAnswer}
                >
                  <div className="space-y-3">
                    {currentQuestion?.options?.map((option: any, idx: number) => {
                      const optionLabel =
                        typeof option === "string"
                          ? option
                          : option?.label ?? String(option);
                      const optionValue =
                        typeof option === "string"
                          ? option
                          : option?.value ?? optionLabel;

                      return (
                        <div
                          key={idx}
                          className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50 ${
                            currentAnswer === optionValue
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background"
                          }`}
                          onClick={() => handleSelectAnswer(optionValue)}
                        >
                          <RadioGroupItem
                            value={optionValue}
                            id={`q-${currentQuestionIndex}-${idx}`}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <Label
                              htmlFor={`q-${currentQuestionIndex}-${idx}`}
                              className="font-medium cursor-pointer"
                            >
                              {optionLabel}
                            </Label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </RadioGroup>

                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                  >
                    Previous
                  </Button>
                  <div className="flex gap-2">
                    {!isLastQuestion && (
                      <Button
                        variant="outline"
                        onClick={handleNext}
                        disabled={!currentAnswer}
                      >
                        Next Question
                      </Button>
                    )}
                    <Button
                      onClick={handleSubmitQuiz}
                      disabled={submitQuizMutation.isPending || !currentAnswer}
                      className="shadow-light-blue-sm"
                    >
                      {isLastQuestion ? "Submit Quiz" : "Submit & Continue"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarLayout>
  );
}
