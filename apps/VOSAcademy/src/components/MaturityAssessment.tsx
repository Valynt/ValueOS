/**
 * Maturity Assessment Component
 * Embedded assessment for determining VOS maturity level
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, TrendingUp, Target, AlertCircle } from "lucide-react";

interface AssessmentQuestion {
  id: string;
  category: string;
  question: string;
  options: {
    value: number;
    label: string;
    description: string;
  }[];
}

const assessmentQuestions: AssessmentQuestion[] = [
  {
    id: "q1",
    category: "Value Discovery",
    question: "How does your organization currently discover and quantify customer value?",
    options: [
      { value: 0, label: "Reactive & Ad-hoc", description: "We respond to customer requests without structured discovery" },
      { value: 1, label: "Basic Templates", description: "We use basic templates but inconsistently" },
      { value: 2, label: "Documented Process", description: "We have documented discovery processes with KPIs" },
      { value: 3, label: "Data-Driven", description: "We use data analytics to uncover value opportunities" },
      { value: 4, label: "Predictive Analytics", description: "We predict value opportunities using AI/ML" },
      { value: 5, label: "Autonomous", description: "AI agents autonomously identify and quantify value" }
    ]
  },
  {
    id: "q2",
    category: "Business Case Development",
    question: "How do you build and present business cases to customers?",
    options: [
      { value: 0, label: "No Standard Approach", description: "Each deal uses different methods" },
      { value: 1, label: "Manual Spreadsheets", description: "We manually create ROI models in Excel" },
      { value: 2, label: "Standardized Templates", description: "We use standardized ROI templates with documented assumptions" },
      { value: 3, label: "Dynamic Models", description: "We use interactive tools that adapt to customer data" },
      { value: 4, label: "AI-Assisted", description: "AI helps generate and optimize business cases" },
      { value: 5, label: "Fully Automated", description: "AI agents compose personalized business cases automatically" }
    ]
  },
  {
    id: "q3",
    category: "Value Realization",
    question: "How do you track and demonstrate realized value post-sale?",
    options: [
      { value: 0, label: "Not Tracked", description: "We don't systematically track value realization" },
      { value: 1, label: "Manual Check-ins", description: "We manually follow up with customers occasionally" },
      { value: 2, label: "KPI Dashboards", description: "We have dashboards tracking key value metrics" },
      { value: 3, label: "Proactive Monitoring", description: "We proactively monitor and optimize value delivery" },
      { value: 4, label: "Predictive Insights", description: "We predict value realization risks and opportunities" },
      { value: 5, label: "Self-Optimizing", description: "Systems automatically optimize value delivery" }
    ]
  },
  {
    id: "q4",
    category: "Cross-Functional Alignment",
    question: "How well do Sales, CS, Product, and Marketing align on value messaging?",
    options: [
      { value: 0, label: "Siloed", description: "Each team operates independently with different messages" },
      { value: 1, label: "Occasional Meetings", description: "Teams meet occasionally to align" },
      { value: 2, label: "Shared Playbooks", description: "We have shared value playbooks and regular alignment" },
      { value: 3, label: "Integrated Workflows", description: "Teams use integrated systems and workflows" },
      { value: 4, label: "AI-Coordinated", description: "AI helps coordinate cross-functional value activities" },
      { value: 5, label: "Orchestrated", description: "AI orchestrates seamless cross-functional value delivery" }
    ]
  },
  {
    id: "q5",
    category: "AI Augmentation",
    question: "How does your organization leverage AI in value delivery?",
    options: [
      { value: 0, label: "No AI Usage", description: "We don't use AI tools" },
      { value: 1, label: "Basic Tools", description: "We use basic AI tools (ChatGPT, etc.) ad-hoc" },
      { value: 2, label: "Integrated Tools", description: "AI tools are integrated into our workflows" },
      { value: 3, label: "Custom Models", description: "We've built custom AI models for value tasks" },
      { value: 4, label: "Agentic Systems", description: "We use AI agents that can take autonomous actions" },
      { value: 5, label: "Fully Agentic", description: "AI agents drive most value delivery activities" }
    ]
  }
];

interface MaturityAssessmentProps {
  onComplete: (level: number, scores: Record<string, number>) => void;
}

export default function MaturityAssessment({ onComplete }: MaturityAssessmentProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isComplete, setIsComplete] = useState(false);

  const handleAnswer = (questionId: string, value: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentQuestion < assessmentQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      completeAssessment();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const completeAssessment = () => {
    // Calculate overall maturity level (average of all answers)
    const scores = Object.values(answers);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maturityLevel = Math.round(avgScore);

    // Calculate category scores
    const categoryScores: Record<string, number> = {};
    assessmentQuestions.forEach(q => {
      const score = answers[q.id] || 0;
      categoryScores[q.category] = score;
    });

    setIsComplete(true);
    onComplete(maturityLevel, categoryScores);
  };

  const progress = ((currentQuestion + 1) / assessmentQuestions.length) * 100;
  const currentQ = assessmentQuestions[currentQuestion];
  const currentAnswer = answers[currentQ?.id];

  if (isComplete) {
    const scores = Object.values(answers);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maturityLevel = Math.round(avgScore);

    const levelLabels = [
      "L0: Value Chaos",
      "L1: Ad-hoc/Manual",
      "L2: Performance Measurement",
      "L3: Managed/Optimizing",
      "L4: Predictive Analytics",
      "L5: Value Orchestration"
    ];

    return (
      <Card className="bg-card text-card-foreground border-2 border-primary shadow-beautiful-md rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-center text-2xl">Assessment Complete!</CardTitle>
          <CardDescription className="text-center">
            Your VOS maturity level has been calculated
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-4">
              <span className="text-4xl font-bold text-primary">L{maturityLevel}</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">{levelLabels[maturityLevel]}</h3>
            <p className="text-muted-foreground">
              Based on your responses, you're at maturity level {maturityLevel}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              Category Breakdown
            </h4>
            {assessmentQuestions.map(q => (
              <div key={q.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">{q.category}</span>
                <Badge variant="secondary">L{answers[q.id]}</Badge>
              </div>
            ))}
          </div>

          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium mb-1">Next Steps</p>
                <p className="text-sm text-muted-foreground">
                  Your profile has been updated. Explore role-specific learning paths tailored to your maturity level.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline">
            Question {currentQuestion + 1} of {assessmentQuestions.length}
          </Badge>
          <span className="text-sm text-muted-foreground">{currentQ?.category}</span>
        </div>
        <Progress value={progress} className="mb-4" />
        <CardTitle className="text-xl">{currentQ?.question}</CardTitle>
        <CardDescription>
          Select the option that best describes your current state
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={currentAnswer?.toString()}
          onValueChange={(val) => handleAnswer(currentQ.id, parseInt(val))}
        >
          <div className="space-y-3">
            {currentQ?.options.map((option) => (
              <div
                key={option.value}
                className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50 ${
                  currentAnswer === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
                onClick={() => handleAnswer(currentQ.id, option.value)}
              >
                <RadioGroupItem value={option.value.toString()} id={`${currentQ.id}-${option.value}`} />
                <div className="flex-1">
                  <Label
                    htmlFor={`${currentQ.id}-${option.value}`}
                    className="font-medium cursor-pointer"
                  >
                    {option.label}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {option.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </RadioGroup>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
          >
            Previous
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentAnswer === undefined}
          >
            {currentQuestion === assessmentQuestions.length - 1 ? 'Complete Assessment' : 'Next Question'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
