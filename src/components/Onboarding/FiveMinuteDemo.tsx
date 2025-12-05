/**
 * Task #012: 5 Minutes to First Value Demo
 * 
 * Interactive demo flow that guides users to create their first value case
 * in under 5 minutes.
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, ArrowRight, Play, Clock } from 'lucide-react';
import { analyticsClient } from '../../lib/analyticsClient';

interface DemoStep {
  id: string;
  title: string;
  description: string;
  action: string;
  estimatedSeconds: number;
  completed: boolean;
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: 'company',
    title: 'Enter Company Details',
    description: 'Start with your target company name and website',
    action: 'Fill in company info',
    estimatedSeconds: 30,
    completed: false,
  },
  {
    id: 'opportunity',
    title: 'Describe the Opportunity',
    description: 'What problem are you solving for this company?',
    action: 'Describe opportunity',
    estimatedSeconds: 60,
    completed: false,
  },
  {
    id: 'stakeholders',
    title: 'Identify Stakeholders',
    description: 'Who are the key decision makers?',
    action: 'Add stakeholders',
    estimatedSeconds: 45,
    completed: false,
  },
  {
    id: 'metrics',
    title: 'Define Success Metrics',
    description: 'What KPIs will improve?',
    action: 'Set metrics',
    estimatedSeconds: 60,
    completed: false,
  },
  {
    id: 'generate',
    title: 'Generate Value Analysis',
    description: 'Let AI create your comprehensive value case',
    action: 'Generate analysis',
    estimatedSeconds: 45,
    completed: false,
  },
];

interface FiveMinuteDemoProps {
  onComplete: (data: DemoCompletionData) => void;
  onSkip: () => void;
}

export interface DemoCompletionData {
  company: string;
  website: string;
  opportunity: string;
  stakeholders: string[];
  metrics: string[];
  timeToComplete: number;
}

export const FiveMinuteDemo: React.FC<FiveMinuteDemoProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<DemoStep[]>(DEMO_STEPS);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Demo data collection
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');
  const [opportunity, setOpportunity] = useState('');
  const [stakeholders, setStakeholders] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<string[]>([]);
  const [newStakeholder, setNewStakeholder] = useState('');
  const [newMetric, setNewMetric] = useState('');

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // Track demo start
  useEffect(() => {
    analyticsClient.trackWorkflowEvent('demo_started', 'onboarding', {
      demo_type: 'five_minute_value',
    });
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const markStepComplete = (stepIndex: number) => {
    const updatedSteps = [...steps];
    updatedSteps[stepIndex].completed = true;
    setSteps(updatedSteps);

    analyticsClient.trackWorkflowEvent('demo_step_completed', 'onboarding', {
      step_id: steps[stepIndex].id,
      step_number: stepIndex + 1,
      time_spent: elapsedTime,
    });
  };

  const handleNext = () => {
    markStepComplete(currentStep);
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    const completionData: DemoCompletionData = {
      company,
      website,
      opportunity,
      stakeholders,
      metrics,
      timeToComplete: elapsedTime,
    };

    analyticsClient.trackWorkflowEvent('demo_completed', 'onboarding', {
      time_to_complete: elapsedTime,
      completed_in_target: elapsedTime <= 300, // 5 minutes
      company,
    });

    onComplete(completionData);
  };

  const handleSkip = () => {
    analyticsClient.trackWorkflowEvent('demo_skipped', 'onboarding', {
      step_id: steps[currentStep].id,
      step_number: currentStep + 1,
      time_spent: elapsedTime,
    });

    onSkip();
  };

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 rounded-full mb-4">
            <Clock className="w-4 h-4 text-indigo-700" />
            <span className="text-sm font-medium text-indigo-700">
              {formatTime(elapsedTime)} / 5:00
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create Your First Value Case
          </h1>
          <p className="text-gray-600">
            Let's build a professional value analysis in 5 minutes
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progress)}% complete
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-700 font-bold">{currentStep + 1}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">{step.title}</h2>
              <p className="text-gray-600">{step.description}</p>
            </div>
          </div>

          {/* Step-specific inputs */}
          <div className="space-y-4">
            {currentStep === 0 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g., Acme Corporation"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {currentStep === 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Opportunity Description
                </label>
                <textarea
                  value={opportunity}
                  onChange={(e) => setOpportunity(e.target.value)}
                  placeholder="Describe the problem you're solving or value you're creating..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  autoFocus
                />
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key Stakeholders
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newStakeholder}
                    onChange={(e) => setNewStakeholder(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newStakeholder.trim()) {
                        setStakeholders([...stakeholders, newStakeholder.trim()]);
                        setNewStakeholder('');
                      }
                    }}
                    placeholder="Add stakeholder name and role..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (newStakeholder.trim()) {
                        setStakeholders([...stakeholders, newStakeholder.trim()]);
                        setNewStakeholder('');
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {stakeholders.map((stakeholder, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-gray-700">{stakeholder}</span>
                      <button
                        onClick={() => setStakeholders(stakeholders.filter((_, i) => i !== idx))}
                        className="ml-auto text-gray-400 hover:text-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Success Metrics / KPIs
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newMetric}
                    onChange={(e) => setNewMetric(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newMetric.trim()) {
                        setMetrics([...metrics, newMetric.trim()]);
                        setNewMetric('');
                      }
                    }}
                    placeholder="e.g., Reduce churn by 15%"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (newMetric.trim()) {
                        setMetrics([...metrics, newMetric.trim()]);
                        setNewMetric('');
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {metrics.map((metric, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-gray-700">{metric}</span>
                      <button
                        onClick={() => setMetrics(metrics.filter((_, i) => i !== idx))}
                        className="ml-auto text-gray-400 hover:text-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Generate!</h3>
                <p className="text-gray-600 mb-4">
                  We'll create a comprehensive value analysis based on your inputs
                </p>
                <div className="bg-indigo-50 rounded-lg p-4 text-left">
                  <p className="text-sm text-indigo-900 font-medium mb-2">Your inputs:</p>
                  <ul className="text-sm text-indigo-700 space-y-1">
                    <li>• Company: {company}</li>
                    <li>• {stakeholders.length} stakeholders identified</li>
                    <li>• {metrics.length} success metrics defined</li>
                    <li>• Opportunity scope documented</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleSkip}
            className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium"
          >
            Skip demo
          </button>
          <button
            onClick={handleNext}
            disabled={
              (currentStep === 0 && (!company || !website)) ||
              (currentStep === 1 && !opportunity) ||
              (currentStep === 2 && stakeholders.length === 0) ||
              (currentStep === 3 && metrics.length === 0)
            }
            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLastStep ? (
              <>
                <Play className="w-5 h-5" />
                Generate Analysis
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mt-6">
          {steps.map((s, idx) => (
            <div
              key={s.id}
              className={`h-2 rounded-full transition-all ${
                idx < currentStep
                  ? 'w-8 bg-green-500'
                  : idx === currentStep
                  ? 'w-12 bg-indigo-600'
                  : 'w-6 bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
