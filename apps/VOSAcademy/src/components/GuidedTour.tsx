import { ReactNode, useEffect, useState } from "react";

import { Icons } from "../lib/icons";

import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface GuidedTooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
}

export function GuidedTooltip({
  content,
  children,
  side = "top",
  delay = 300,
}: GuidedTooltipProps) {
  return (
    <TooltipProvider delayDuration={delay}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Contextual help button
export function HelpButton({ content }: { content: string }) {
  return (
    <GuidedTooltip content={content}>
      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Help">
        <Icons.HelpCircle className="h-4 w-4" />
      </Button>
    </GuidedTooltip>
  );
}

// Info tooltip for UI elements
export function InfoTooltip({ content }: { content: string }) {
  return (
    <GuidedTooltip content={content}>
      <Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Information">
        <Icons.Info className="h-3 w-3" />
      </Button>
    </GuidedTooltip>
  );
}

// Guided tour step component
interface GuidedTourStep {
  id: string;
  target: string; // CSS selector
  title: string;
  content: string;
  position?: "top" | "right" | "bottom" | "left";
  showSkip?: boolean;
}

interface GuidedTourProps {
  steps: GuidedTourStep[];
  onComplete: () => void;
  onSkip: () => void;
}

export function GuidedTour({ steps, onComplete, onSkip }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [targetElement, setTargetElement] = useState<Element | null>(null);

  const step = steps[currentStep];

  useEffect(() => {
    const element = document.querySelector(step.target);
    setTargetElement(element);

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-primary", "ring-offset-2");
    }

    return () => {
      if (element) {
        element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
      }
    };
  }, [currentStep, step.target]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSkip();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  if (!isVisible || !targetElement) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsVisible(false);
      onComplete();
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
    onSkip();
  };

  const rect = targetElement.getBoundingClientRect();

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" data-testid="tour-overlay" />

      {/* Highlight */}
      <div
        className="absolute border-2 border-primary bg-primary/10"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          borderRadius: "4px",
        }}
      />

      {/* Tour content */}
      <div
        className="absolute pointer-events-auto bg-background border rounded-lg shadow-lg p-4 max-w-sm"
        style={{
          top: step.position === "bottom" ? rect.bottom + 16 : rect.top - 16,
          left: step.position === "right" ? rect.right + 16 : rect.left,
          transform: step.position === "right" ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-sm">{step.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{step.content}</p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {currentStep + 1} of {steps.length}
            </span>

            <div className="flex gap-2">
              {step.showSkip !== false && (
                <Button variant="ghost" size="sm" onClick={handleSkip} aria-label="Close tour">
                  Skip Tour
                </Button>
              )}
              <Button size="sm" onClick={handleNext}>
                {currentStep === steps.length - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Predefined tours for common workflows
export const tours = {
  dashboard: [
    {
      id: "welcome",
      target: '[data-tour="welcome"]',
      title: "Welcome to Your Dashboard",
      content:
        "This is your personalized learning dashboard. Here you can track your progress, view upcoming activities, and access all VOS Academy features.",
    },
    {
      id: "progress",
      target: '[data-tour="progress"]',
      title: "Your Learning Progress",
      content:
        "Track your completion across all 10 VOS pillars. Each pillar builds on the previous one to create comprehensive value engineering expertise.",
    },
    {
      id: "simulations",
      target: '[data-tour="simulations"]',
      title: "Interactive Simulations",
      content:
        "Practice real-world VOS scenarios with AI-powered feedback. These hands-on exercises are crucial for applying your learning.",
    },
    {
      id: "certifications",
      target: '[data-tour="certifications"]',
      title: "Earn Certifications",
      content:
        "Complete assessments to earn Bronze, Silver, or Gold certifications. These validate your VOS expertise to stakeholders.",
    },
  ],

  simulation: [
    {
      id: "scenario",
      target: '[data-tour="scenario"]',
      title: "Scenario Context",
      content:
        "Read the business scenario carefully. Understanding the context is key to providing effective VOS solutions.",
    },
    {
      id: "steps",
      target: '[data-tour="steps"]',
      title: "Step-by-Step Process",
      content:
        "Work through each step systematically. You'll receive AI feedback after each submission to improve your approach.",
    },
    {
      id: "evaluation",
      target: '[data-tour="evaluation"]',
      title: "AI Evaluation",
      content:
        "After each step, our AI evaluates your response against VOS best practices and provides detailed feedback with improvement suggestions.",
    },
  ],
};
