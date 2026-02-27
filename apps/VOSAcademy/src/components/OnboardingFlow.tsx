import { useEffect, useState } from 'react';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface OnboardingFlowProps {
  steps: OnboardingStep[];
  onComplete: () => void;
  onSkip: () => void;
  storageKey?: string;
}

export function OnboardingFlow({
  steps,
  onComplete,
  onSkip,
  storageKey = 'vos-onboarding-completed'
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Check if onboarding was already completed
  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (completed) {
      onComplete();
      setIsVisible(false);
    }
  }, [storageKey, onComplete]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
    onSkip();
  };

  if (!isVisible) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-beautiful-xl animate-in fade-in-0 zoom-in-95 duration-300">
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="px-2 py-1">
                {currentStep + 1} of {steps.length}
              </Badge>
              <Progress value={progress} className="w-24 h-2" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              aria-label="Skip onboarding"
              className="h-8 w-8"
            >
              <Icons.X className="h-4 w-4" />
            </Button>
          </div>
          <CardTitle className="text-2xl">{step.title}</CardTitle>
          <CardDescription className="text-base">{step.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="min-h-[200px] flex items-center justify-center">
            {step.content}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <Icons.ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
                Skip
              </Button>

              <Button onClick={handleNext} className="flex items-center gap-2">
                {currentStep === steps.length - 1 ? (
                  <>
                    <Icons.CheckCircle className="h-4 w-4" />
                    Get Started
                  </>
                ) : (
                  <>
                    Next
                    <Icons.ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex justify-center gap-1 pt-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-8 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-primary'
                    : index < currentStep
                    ? 'bg-primary/50'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Predefined onboarding steps for VOS Academy
export const vosAcademyOnboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to VOS Academy',
    description: 'Your journey to mastering Value Operating System begins here',
    content: (
      <div className="text-center space-y-4">
        <div className="p-6 bg-primary/10 rounded-full w-fit mx-auto">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">VA</span>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Master Value Engineering</h3>
          <p className="text-muted-foreground">
            Learn to quantify, communicate, and operationalize business value using the proven VOS framework.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'pillars',
    title: 'Explore the 10 VOS Pillars',
    description: 'Progressive learning path from foundation to advanced mastery',
    content: (
      <div className="grid grid-cols-2 gap-4">
        {[
          { number: 1, title: 'Unified Value Language', level: 'Foundation' },
          { number: 2, title: 'Value Data Model', level: 'Foundation' },
          { number: 3, title: 'Discovery Excellence', level: 'Foundation' },
          { number: 4, title: 'Business Case Development', level: 'Foundation' },
        ].map((pillar) => (
          <div key={pillar.number} className="p-3 bg-muted rounded-lg text-center">
            <div className="font-semibold text-sm">Pillar {pillar.number}</div>
            <div className="text-xs text-muted-foreground mb-1">{pillar.title}</div>
            <Badge variant="outline" className="text-xs">{pillar.level}</Badge>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'simulations',
    title: 'Practice with AI-Powered Simulations',
    description: 'Real-world scenarios with instant feedback and scoring',
    content: (
      <div className="space-y-4">
        <div className="p-4 bg-primary/5 rounded-lg border-l-4 border-primary">
          <h4 className="font-semibold mb-2">Interactive Learning</h4>
          <ul className="text-sm space-y-1">
            <li>• Business Case Development scenarios</li>
            <li>• QBR Expansion Modeling exercises</li>
            <li>• AI-powered evaluation and feedback</li>
            <li>• 40/30/30 scoring rubric</li>
          </ul>
        </div>
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <Icons.CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium">Available Now</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'certification',
    title: 'Earn Professional Certifications',
    description: 'Demonstrate your expertise with recognized credentials',
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
            <div className="text-2xl font-bold text-amber-600 mb-1">🥉</div>
            <div className="text-sm font-semibold">Bronze</div>
            <div className="text-xs text-muted-foreground">80%+ Score</div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
            <div className="text-2xl font-bold text-gray-600 mb-1">🥈</div>
            <div className="text-sm font-semibold">Silver</div>
            <div className="text-xs text-muted-foreground">85%+ Score</div>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600 mb-1">🥇</div>
            <div className="text-sm font-semibold">Gold</div>
            <div className="text-xs text-muted-foreground">95%+ Score</div>
          </div>
        </div>
        <p className="text-sm text-center text-muted-foreground">
          Certifications are based on your performance across Quiz, Simulation, and Role Task components.
        </p>
      </div>
    ),
  },
  {
    id: 'ai-tutor',
    title: 'AI-Powered Learning Assistant',
    description: 'Get personalized guidance and support throughout your journey',
    content: (
      <div className="space-y-4">
        <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <span className="text-lg">🤖</span>
            </div>
            <div>
              <h4 className="font-semibold">VOS AI Tutor</h4>
              <p className="text-sm text-muted-foreground">Your personal value engineering coach</p>
            </div>
          </div>
          <ul className="text-sm space-y-1 ml-12">
            <li>• ROI Narrative generation</li>
            <li>• Value Case building assistance</li>
            <li>• KPI Hypothesis validation</li>
            <li>• Real-time guidance and feedback</li>
          </ul>
        </div>
      </div>
    ),
  },
];
