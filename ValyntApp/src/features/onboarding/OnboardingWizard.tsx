import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { onboardingService, type OnboardingStep } from "@/services/onboarding";

interface OnboardingWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [state, setState] = useState(() => onboardingService.getState());

  const handleCompleteStep = (stepId: string) => {
    onboardingService.completeStep(stepId);
    setState(onboardingService.getState());

    if (onboardingService.isCompleted()) {
      onComplete?.();
    }
  };

  const handleSkip = () => {
    onboardingService.skipOnboarding();
    onSkip?.();
  };

  const progress = onboardingService.getProgress();

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Welcome to Valynt</CardTitle>
            <CardDescription>Complete these steps to get started</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            <X className="h-4 w-4 mr-1" />
            Skip
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {state.steps.map((step, index) => (
          <OnboardingStepItem
            key={step.id}
            step={step}
            stepNumber={index + 1}
            isActive={state.currentStep === index && !step.completed}
            onComplete={() => handleCompleteStep(step.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface OnboardingStepItemProps {
  step: OnboardingStep;
  stepNumber: number;
  isActive: boolean;
  onComplete: () => void;
}

function OnboardingStepItem({ step, stepNumber, isActive, onComplete }: OnboardingStepItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border transition-colors",
        step.completed && "bg-green-50 border-green-200",
        isActive && "bg-primary/5 border-primary",
        !step.completed && !isActive && "opacity-60"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
          step.completed && "bg-green-500 text-white",
          isActive && "bg-primary text-primary-foreground",
          !step.completed && !isActive && "bg-muted text-muted-foreground"
        )}
      >
        {step.completed ? <Check className="h-4 w-4" /> : stepNumber}
      </div>

      <div className="flex-1">
        <p className="font-medium">{step.title}</p>
        <p className="text-sm text-muted-foreground">{step.description}</p>
      </div>

      {isActive && (
        <Button size="sm" onClick={onComplete}>
          Complete
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}

      {step.completed && (
        <span className="text-sm text-green-600 font-medium">Done</span>
      )}
    </div>
  );
}

export default OnboardingWizard;
