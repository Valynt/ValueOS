import { useState } from "react";

import { SidebarLayout } from "@/components/SidebarLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/lib/icons";
import { trpc } from "@/lib/trpc";

interface SimulationResult {
  success: boolean;
  passed: boolean;
  overallScore: number;
  categoryScores: {
    technical: number;
    crossFunctional: number;
    aiAugmentation: number;
  };
  feedback: string;
  attemptNumber: number;
}

interface ScenarioDataWithTargetLevel {
  targetMaturityLevel?: number;
}

export function Simulations() {
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Array<{
    stepNumber: number;
    userResponse: string;
    aiFeedback: string;
    score: number;
    strengths: string[];
    improvements: string[];
  }>>([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [startTime] = useState(Date.now());
  const [isComplete, setIsComplete] = useState(false);
  const [finalResult, setFinalResult] = useState<SimulationResult | null>(null);

  const { data: scenarios, isLoading } = trpc.simulations.list.useQuery();
  const { data: scenario } = trpc.simulations.getById.useQuery(
    { id: selectedScenario! },
    { enabled: !!selectedScenario }
  );
  const submitAttempt = trpc.simulations.submitAttempt.useMutation();
  const evaluateResponse = trpc.simulations.evaluateResponse.useMutation();

  const handleStartScenario = (id: number) => {
    setSelectedScenario(id);
    setCurrentStep(0);
    setResponses([]);
    setCurrentResponse("");
    setIsComplete(false);
    setFinalResult(null);
  };

  const handleSubmitStep = async () => {
    if (!scenario || !currentResponse.trim()) return;

    setIsEvaluating(true);

    try {
      // Call AI evaluation endpoint
      const evaluation = await evaluateResponse.mutateAsync({
        scenarioId: selectedScenario!,
        stepNumber: currentStep + 1,
        userResponse: currentResponse,
      });

      const stepResponse = {
        stepNumber: currentStep + 1,
        userResponse: currentResponse,
        aiFeedback: evaluation.feedback,
        score: evaluation.score,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
      };

      const newResponses = [...responses, stepResponse];
    setResponses(newResponses);
    setCurrentResponse("");

    // Move to next step or complete
    if (scenario?.scenarioData && currentStep < scenario.scenarioData.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Submit final attempt
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      const result = await submitAttempt.mutateAsync({
        scenarioId: selectedScenario!,
        responsesData: newResponses,
        timeSpent,
      });
      setFinalResult(result);
      setIsComplete(true);
    }

      setIsEvaluating(false);
    } catch (error) {
      console.error('Failed to evaluate response:', error);
      alert('Failed to evaluate your response. Please try again.');
      setIsEvaluating(false);
    }
  };

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="container py-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="w-8 h-8 bg-primary/20 rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-8 bg-muted rounded w-64 animate-pulse" />
                <div className="h-4 bg-muted rounded w-96 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Loading simulation cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="h-6 bg-muted rounded w-20 animate-pulse" />
                    <div className="h-6 bg-muted rounded w-16 animate-pulse" />
                  </div>
                  <div className="h-6 bg-muted rounded w-full animate-pulse mb-2" />
                  <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="h-4 bg-muted/50 rounded w-full animate-pulse mb-2" />
                      <div className="h-3 bg-muted/50 rounded w-2/3 animate-pulse" />
                    </div>
                    <div className="h-10 bg-muted rounded w-full animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (!selectedScenario) {
    return (
      <SidebarLayout>
        <div className="container py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icons.Gamepad2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Interactive Simulations</h1>
              <p className="text-muted-foreground">
                Practice hands-on VOS scenarios with AI-powered feedback
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {scenarios?.map((s) => (
            <Card
              key={s.id}
              className="bg-card text-card-foreground shadow-beautiful-md hover:shadow-beautiful-lg rounded-lg transition-all duration-300 hover:-translate-y-1"
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge variant={
                    s.difficulty === "beginner" ? "secondary" :
                    s.difficulty === "intermediate" ? "default" : "destructive"
                  }>
                    {s.difficulty}
                  </Badge>
                  <Badge variant="outline">
                    Level {(s.scenarioData as ScenarioDataWithTargetLevel | null)?.targetMaturityLevel ?? 'N/A'}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Icons.Target className="w-4 h-4" />
                    <span>{s.type.replace("_", " ")}</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleStartScenario(s.id)}
                  className="w-full shadow-light-blue-sm"
                >
                  Start Simulation
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {(!scenarios || scenarios.length === 0) && (
          <Alert className="shadow-beautiful-sm">
            <AlertDescription>
              No simulations available yet. Check back soon!
            </AlertDescription>
          </Alert>
        )}
      </div>
      </SidebarLayout>
    );
  }

  if (isComplete && finalResult) {
    return (
      <SidebarLayout>
        <div className="container py-8 max-w-3xl">
        <Card className="bg-card text-card-foreground shadow-beautiful-lg rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-4 rounded-full shadow-beautiful-md ${finalResult.passed ? 'bg-green-100 dark:bg-green-950' : 'bg-yellow-100 dark:bg-yellow-950'}`}>
                <Icons.Trophy className={`w-8 h-8 ${finalResult.passed ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {finalResult.passed ? "Congratulations!" : "Keep Practicing!"}
                </CardTitle>
                <CardDescription>
                  Attempt #{finalResult.attemptNumber} • Score: {finalResult.overallScore}/100
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg shadow-beautiful-sm">
                <div className="text-2xl font-bold text-primary">
                  {finalResult.categoryScores.technical}
                </div>
                <div className="text-sm text-muted-foreground">Technical</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg shadow-beautiful-sm">
                <div className="text-2xl font-bold text-primary">
                  {finalResult.categoryScores.crossFunctional}
                </div>
                <div className="text-sm text-muted-foreground">Cross-Functional</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg shadow-beautiful-sm">
                <div className="text-2xl font-bold text-primary">
                  {finalResult.categoryScores.aiAugmentation}
                </div>
                <div className="text-sm text-muted-foreground">AI Augmentation</div>
              </div>
            </div>

            <div className="p-4 bg-primary/5 border-l-4 border-primary rounded-r-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Icons.Brain className="w-5 h-5 text-primary" />
                AI Feedback
              </h3>
              <p className="text-sm">{finalResult.feedback}</p>
            </div>

            <div className="flex gap-4">
              <Button onClick={() => handleStartScenario(selectedScenario)} variant="outline">
                Try Again
              </Button>
              <Button onClick={() => setSelectedScenario(null)} className="shadow-light-blue-sm">
                Back to Simulations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </SidebarLayout>
    );
  }

  const step = scenario?.scenarioData?.steps[currentStep];

  return (
    <SidebarLayout>
      <div className="container py-8 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => setSelectedScenario(null)}>
          ← Back to Simulations
        </Button>
      </div>

      <Card className="mb-6 bg-card text-card-foreground shadow-beautiful-md rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{scenario?.title}</CardTitle>
            <Badge variant="outline">
              Step {currentStep + 1} of {scenario?.scenarioData?.steps.length || 0}
            </Badge>
          </div>
          <CardDescription>
            Complete each step to receive personalized AI feedback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg shadow-beautiful-sm">
            <h3 className="font-semibold mb-2">Scenario Context</h3>
            <p className="text-sm">{scenario?.scenarioData?.context}</p>
          </div>

          <div className="content-highlight">
            <h3 className="font-semibold mb-2">{step?.title}</h3>
            <p className="text-sm">{step?.instruction}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your Response</label>
            <Textarea
              value={currentResponse}
              onChange={(e) => setCurrentResponse(e.target.value)}
              placeholder="Type your response here..."
              rows={6}
              disabled={isEvaluating}
              className="shadow-beautiful-sm"
            />
          </div>

          <Button 
            onClick={handleSubmitStep}
            disabled={!currentResponse.trim() || isEvaluating}
            className="w-full shadow-light-blue-sm"
          >
            {isEvaluating ? (
              <>
                <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Evaluating...
              </>
            ) : currentStep < (scenario?.scenarioData?.steps.length || 0) - 1 ? (
              "Submit & Continue"
            ) : (
              "Submit Final Step"
            )}
          </Button>
        </CardContent>
      </Card>

      {responses.length > 0 && (
        <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Icons.CheckCircle className="w-5 h-5 text-green-600" />
              Previous Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {responses.map((r, idx) => (
              <div key={idx} className="p-4 bg-muted rounded-lg shadow-beautiful-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Step {r.stepNumber}</span>
                  <Badge variant={r.score >= 80 ? "default" : "secondary"}>
                    Score: {Math.round(r.score)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground italic">"{r.userResponse}"</p>
                <p className="text-sm">{r.aiFeedback}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
    </SidebarLayout>
  );
}
