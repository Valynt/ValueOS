import { ArrowLeft, ArrowRight, BookCheck, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { logger } from "@/lib/logger";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  feedback: string;
}

export function Quiz() {
  const { pillarNumber } = useParams<{ pillarNumber: string }>();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  const pillarNum = parseInt(pillarNumber || "1");

  // Mock quiz data - replace with real data from backend
  const mockQuestions: Question[] = [
    {
      id: 1,
      question: "What is the primary goal of Value Discovery in VOS?",
      options: [
        "To maximize revenue generation",
        "To identify and articulate value in any context",
        "To reduce operational costs",
        "To improve customer satisfaction scores"
      ],
      correctAnswer: 1,
      explanation: "Value Discovery focuses on identifying and articulating value in any context, which is the foundation of the VOS framework."
    },
    {
      id: 2,
      question: "Which VOS pillar deals with measuring and optimizing value realization?",
      options: [
        "Value Discovery",
        "Value Creation",
        "Value Capture",
        "Value Distribution"
      ],
      correctAnswer: 2,
      explanation: "Value Capture is the pillar that focuses on measuring and optimizing how value is actually realized and captured."
    },
    {
      id: 3,
      question: "What is a key principle of Value Distribution?",
      options: [
        "Maximizing individual profit",
        "Fair allocation across stakeholders",
        "Centralizing all value",
        "Minimizing distribution costs"
      ],
      correctAnswer: 1,
      explanation: "Value Distribution emphasizes fair allocation and communication of value across all stakeholders involved."
    }
  ];

  const questions = mockQuestions;

  const handleAnswerSelect = (questionId: number, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach(question => {
      const userAnswer = selectedAnswers[question.id];
      const correctAnswer = question.options[question.correctAnswer];
      if (userAnswer === correctAnswer) {
        correct++;
      }
    });
    return correct;
  };

  const handleSubmitQuiz = () => {
    const score = calculateScore();
    const percentage = Math.round((score / questions.length) * 100);
    const passed = percentage >= 70; // 70% passing threshold

    const result: QuizResult = {
      score,
      totalQuestions: questions.length,
      percentage,
      passed,
      feedback: passed
        ? "Congratulations! You've passed the quiz and can move to the next pillar."
        : "Keep studying! Review the material and try again when you're ready."
    };

    setQuizResult(result);
    setQuizSubmitted(true);
    logger.info("Quiz completed!");
  };

  const handleRetakeQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizSubmitted(false);
    setQuizResult(null);
  };

  const currentQuestion = questions[currentQuestionIndex]!;
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  if (quizSubmitted && quizResult) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto p-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                {quizResult.passed ? (
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                ) : (
                  <XCircle className="h-16 w-16 text-red-500" />
                )}
              </div>
              <CardTitle className="text-2xl">
                {quizResult.passed ? "Quiz Passed!" : "Quiz Not Passed"}
              </CardTitle>
              <CardDescription>
                You scored {quizResult.score} out of {quizResult.totalQuestions} ({quizResult.percentage}%)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="text-muted-foreground">{quizResult.feedback}</p>
              </div>

              {/* Question Review */}
              <div className="space-y-4">
                <h3 className="font-semibold">Review Your Answers</h3>
                {questions.map((question, index) => {
                  const userAnswer = selectedAnswers[question.id];
                  const correctAnswer = question.options[question.correctAnswer];
                  const isCorrect = userAnswer === correctAnswer;

                  return (
                    <div key={question.id} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                          {isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium mb-2">Question {index + 1}: {question.question}</h4>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Your answer: </span>
                              <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>
                                {userAnswer || "Not answered"}
                              </span>
                            </div>
                            {!isCorrect && (
                              <div>
                                <span className="font-medium">Correct answer: </span>
                                <span className="text-green-600">{correctAnswer}</span>
                              </div>
                            )}
                            <div className="text-muted-foreground">
                              <span className="font-medium">Explanation: </span>
                              {question.explanation}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-4">
                {!quizResult.passed && (
                  <Button onClick={handleRetakeQuiz} variant="outline">
                    Retake Quiz
                  </Button>
                )}
                <Button asChild>
                  <Link to="/academy/dashboard">
                    {quizResult.passed ? 'Continue Learning' : 'Back to Dashboard'}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" asChild>
              <Link to="/academy/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <Badge variant="outline">Pillar {pillarNum}</Badge>
          </div>
          <h1 className="text-3xl font-bold mb-2">VOS Pillar {pillarNum} Quiz</h1>
          <p className="text-muted-foreground">Test your knowledge of VOS concepts</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} />
        </div>

        {/* Question */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              Question {currentQuestionIndex + 1}
            </CardTitle>
            <CardDescription className="text-lg">
              {currentQuestion.question}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup
              value={selectedAnswers[currentQuestion?.id ?? ""] || ""}
              onValueChange={(value: string) => handleAnswerSelect(currentQuestion?.id ?? "", value)}
            >
              {currentQuestion?.options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="text-base">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>

              {currentQuestionIndex === questions.length - 1 ? (
                <Button
                  onClick={handleSubmitQuiz}
                  disabled={!selectedAnswers[currentQuestion?.id ?? ""]}
                >
                  <BookCheck className="mr-2 h-4 w-4" />
                  Submit Quiz
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!selectedAnswers[currentQuestion?.id ?? ""]}
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Quiz;
