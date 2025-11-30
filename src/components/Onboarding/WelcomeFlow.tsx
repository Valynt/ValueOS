/**
 * Welcome Onboarding Flow
 * Guides new users through the app's core features
 */

import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, FileText, Mail, MessageSquare, Check } from 'lucide-react';

interface WelcomeFlowProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  image?: string;
  tips?: string[];
}

const onboardingSteps: OnboardingStep[] = [
  {
    title: 'Welcome to ValueCanvas',
    description: 'Your AI-powered value selling assistant. Let\'s get you started in just a few steps.',
    icon: <Sparkles className="w-12 h-12 text-indigo-600" />,
    tips: [
      'Create value cases in minutes',
      'AI analyzes your customer data',
      'Build compelling business cases',
    ],
  },
  {
    title: 'Import Your Data',
    description: 'Start by uploading notes, emails, or connecting your CRM. Our AI extracts key insights automatically.',
    icon: <FileText className="w-12 h-12 text-indigo-600" />,
    tips: [
      'Upload PDFs, docs, or paste text',
      'Analyze email threads',
      'Import from Salesforce or HubSpot',
    ],
  },
  {
    title: 'Ask the AI Anything',
    description: 'Use the command bar (⌘K) to ask questions, generate content, or analyze data. The AI understands context.',
    icon: <MessageSquare className="w-12 h-12 text-indigo-600" />,
    tips: [
      'Press ⌘K to open command bar',
      'Ask for cost breakdowns',
      'Generate ROI scenarios',
      'Create executive summaries',
    ],
  },
  {
    title: 'You\'re All Set!',
    description: 'Ready to build your first value case? Click below to get started.',
    icon: <Check className="w-12 h-12 text-green-600" />,
  },
];

export const WelcomeFlow: React.FC<WelcomeFlowProps> = ({ isOpen, onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = onboardingSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === onboardingSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 animate-scale-in">
        {/* Header */}
        <div className="relative p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onboardingSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'w-8 bg-indigo-600'
                      : index < currentStep
                      ? 'w-2 bg-indigo-600'
                      : 'w-2 bg-gray-300'
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <button
              onClick={onSkip}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Skip onboarding"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex flex-col items-center text-center">
            {/* Icon */}
            <div className="mb-6 p-4 bg-indigo-50 rounded-2xl">
              {step.icon}
            </div>

            {/* Title */}
            <h2
              id="onboarding-title"
              className="text-2xl font-bold text-gray-900 mb-3"
            >
              {step.title}
            </h2>

            {/* Description */}
            <p className="text-gray-600 text-lg mb-6 max-w-md">
              {step.description}
            </p>

            {/* Tips */}
            {step.tips && (
              <div className="w-full max-w-md mb-6">
                <ul className="space-y-3 text-left">
                  {step.tips.map((tip, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-sm text-gray-700"
                    >
                      <div className="flex-shrink-0 w-5 h-5 mt-0.5 bg-indigo-100 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                      </div>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            disabled={isLastStep}
          >
            Skip
          </button>

          <div className="flex items-center gap-3">
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Previous step"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}

            <button
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm hover:shadow-md"
              aria-label={isLastStep ? 'Complete onboarding' : 'Next step'}
            >
              {isLastStep ? 'Get Started' : 'Next'}
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Step counter for screen readers */}
        <div className="sr-only" role="status" aria-live="polite">
          Step {currentStep + 1} of {onboardingSteps.length}
        </div>
      </div>
    </div>
  );
};

/**
 * Feature Tooltip
 * Highlights specific UI elements during onboarding
 */
interface FeatureTooltipProps {
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  onNext?: () => void;
  onSkip?: () => void;
  isVisible: boolean;
}

export const FeatureTooltip: React.FC<FeatureTooltipProps> = ({
  title,
  description,
  position,
  onNext,
  onSkip,
  isVisible,
}) => {
  if (!isVisible) return null;

  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} z-50 w-64 bg-gray-900 text-white rounded-lg shadow-xl p-4 animate-slide-in-bottom`}
      role="tooltip"
    >
      {/* Arrow */}
      <div
        className={`absolute w-3 h-3 bg-gray-900 transform rotate-45 ${
          position === 'bottom'
            ? 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2'
            : position === 'top'
            ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2'
            : position === 'right'
            ? 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2'
            : 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2'
        }`}
      />

      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-gray-300 mb-3">{description}</p>

      <div className="flex items-center justify-between">
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Skip tour
          </button>
        )}
        {onNext && (
          <button
            onClick={onNext}
            className="ml-auto px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-sm transition-colors"
          >
            Got it
          </button>
        )}
      </div>
    </div>
  );
};
