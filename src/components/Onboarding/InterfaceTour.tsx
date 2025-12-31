/**
 * Task #018: Interface Tour
 * 
 * Guided tour of the ValueCanvas interface with interactive tooltips
 */

import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { analyticsClient } from '../../lib/analyticsClient';

export interface TourStep {
  id: string;
  title: string;
  content: string;
  target: string; // CSS selector
  placement: 'top' | 'bottom' | 'left' | 'right';
  action?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ValueCanvas',
    content: 'Let's take a quick tour to help you get started. You can skip this anytime.',
    target: 'body',
    placement: 'bottom',
  },
  {
    id: 'sidebar',
    title: 'Your Value Cases',
    content: 'Access all your in-progress and completed value cases here. Click any case to open it.',
    target: '[data-tour="sidebar"]',
    placement: 'right',
  },
  {
    id: 'new-case',
    title: 'Create New Cases',
    content: 'Start a new value case with a click. You can import from CRM, upload notes, or start fresh.',
    target: '[data-tour="new-case-button"]',
    placement: 'bottom',
  },
  {
    id: 'canvas',
    title: 'The Canvas',
    content: 'This is where AI-generated insights and analyses appear. It adapts based on your workflow stage.',
    target: '[data-tour="canvas-area"]',
    placement: 'left',
  },
  {
    id: 'command-bar',
    title: 'Command Bar (⌘K)',
    content: 'Press ⌘K anytime to ask questions or request analysis. Your AI copilot is always ready.',
    target: '[data-tour="command-hint"]',
    placement: 'top',
    action: 'Press ⌘K to try it',
  },
  {
    id: 'stages',
    title: 'Value Lifecycle Stages',
    content: 'Cases progress through Opportunity → Target → Realization → Expansion. We guide you through each stage.',
    target: '[data-tour="stage-indicator"]',
    placement: 'bottom',
  },
  {
    id: 'undo-redo',
    title: 'Undo/Redo (⌘Z)',
    content: 'Made a mistake? Use ⌘Z to undo and ⌘⇧Z to redo. Full history tracking keeps you in control.',
    target: '[data-tour="undo-button"]',
    placement: 'left',
  },
  {
    id: 'complete',
    title: 'You're Ready!',
    content: 'You're all set. Create your first value case to get started. Need help? Click the (?) icon anytime.',
    target: 'body',
    placement: 'bottom',
  },
];

interface InterfaceTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const InterfaceTour: React.FC<InterfaceTourProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  const step = TOUR_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  // Find and highlight target element
  useEffect(() => {
    if (!step?.target || step.target === 'body') {
      setTargetElement(null);
      return;
    }

    const element = document.querySelector(step.target) as HTMLElement;
    if (element) {
      setTargetElement(element);
      
      // Scroll into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add highlight class
      element.classList.add('tour-highlight');
      
      return () => {
        element.classList.remove('tour-highlight');
      };
    } else {
      setTargetElement(null);
    }
  }, [step]);

  // Track tour start
  useEffect(() => {
    analyticsClient.trackWorkflowEvent('tour_started', 'onboarding', {
      tour_type: 'interface',
    });
  }, []);

  const handleNext = () => {
    analyticsClient.trackWorkflowEvent('tour_step_completed', 'onboarding', {
      step_id: step.id,
      step_number: currentStep + 1,
    });

    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    analyticsClient.trackWorkflowEvent('tour_skipped', 'onboarding', {
      step_id: step.id,
      step_number: currentStep + 1,
      total_steps: TOUR_STEPS.length,
    });

    setIsVisible(false);
    setTimeout(() => onSkip(), 300);
  };

  const handleComplete = () => {
    analyticsClient.trackWorkflowEvent('tour_completed', 'onboarding', {
      total_steps: TOUR_STEPS.length,
    });

    setIsVisible(false);
    setTimeout(() => onComplete(), 300);
  };

  if (!isVisible) return null;

  const getTooltipPosition = (): React.CSSProperties => {
    if (!targetElement || step.target === 'body') {
      // Center of screen
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000,
      };
    }

    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const offset = 16;

    let top = 0;
    let left = 0;

    switch (step.placement) {
      case 'top':
        top = rect.top - tooltipHeight - offset;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - offset;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + offset;
        break;
    }

    return {
      position: 'fixed',
      top: `${Math.max(offset, Math.min(top, window.innerHeight - tooltipHeight - offset))}px`,
      left: `${Math.max(offset, Math.min(left, window.innerWidth - tooltipWidth - offset))}px`,
      zIndex: 10000,
    };
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-[9999] transition-opacity duration-300" />

      {/* Spotlight on target */}
      {targetElement && step.target !== 'body' && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: `${targetElement.getBoundingClientRect().top - 4}px`,
            left: `${targetElement.getBoundingClientRect().left - 4}px`,
            width: `${targetElement.getBoundingClientRect().width + 8}px`,
            height: `${targetElement.getBoundingClientRect().height + 8}px`,
            boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="bg-white rounded-xl shadow-2xl p-6 w-80 transition-all duration-300"
        style={getTooltipPosition()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-indigo-600">
                Step {currentStep + 1} of {TOUR_STEPS.length}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">{step.content}</p>

        {/* Action hint */}
        {step.action && (
          <div className="bg-indigo-50 rounded-lg p-3 mb-6">
            <p className="text-sm text-indigo-700 font-medium">{step.action}</p>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {TOUR_STEPS.map((s, idx) => (
            <div
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentStep
                  ? 'w-8 bg-indigo-600'
                  : idx < currentStep
                  ? 'w-1.5 bg-green-500'
                  : 'w-1.5 bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={isFirstStep}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {isLastStep ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Finish Tour
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

// Add CSS for tour highlight effect
const tourStyles = `
  .tour-highlight {
    position: relative;
    z-index: 9998 !important;
    animation: tour-pulse 2s ease-in-out infinite;
  }

  @keyframes tour-pulse {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(99, 102, 241, 0);
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = tourStyles;
  document.head.appendChild(styleElement);
}
