import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export interface DialogStep {
  id: string;
  question: string;
  inputType: 'text' | 'select' | 'multiselect' | 'number';
  options?: string[];
  placeholder?: string;
  defaultValue?: any;
}

export interface MultiStepDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (responses: Record<string, any>) => void;
  steps: DialogStep[];
  title: string;
  agentName?: string;
}

export const MultiStepDialog: React.FC<MultiStepDialogProps> = ({
  isOpen,
  onClose,
  onComplete,
  steps,
  title,
  agentName = 'Agent'
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});

  if (!isOpen || steps.length === 0) return null;

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  const handleNext = () => {
    if (isLastStep) {
      onComplete(responses);
      handleClose();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleClose = () => {
    setCurrentStepIndex(0);
    setResponses({});
    onClose();
  };

  const updateResponse = (value: any) => {
    setResponses(prev => ({ ...prev, [currentStep.id]: value }));
  };

  const currentValue = responses[currentStep.id] ?? currentStep.defaultValue ?? '';
  const canProceed = currentValue !== '' && currentValue !== null && currentValue !== undefined;

  const renderInput = () => {
    switch (currentStep.inputType) {
      case 'text':
        return (
          <input
            type="text"
            value={currentValue}
            onChange={(e) => updateResponse(e.target.value)}
            placeholder={currentStep.placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            autoFocus
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={currentValue}
            onChange={(e) => updateResponse(parseFloat(e.target.value))}
            placeholder={currentStep.placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            autoFocus
          />
        );

      case 'select':
        return (
          <select
            value={currentValue}
            onChange={(e) => updateResponse(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            autoFocus
          >
            <option value="">Select an option...</option>
            {currentStep.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );

      case 'multiselect':
        const selectedValues = currentValue as string[] || [];
        return (
          <div className="space-y-2">
            {currentStep.options?.map(option => (
              <label key={option} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, option]
                      : selectedValues.filter(v => v !== option);
                    updateResponse(newValues);
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-30 z-50" onClick={handleClose} />

      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-xl">
        <div className="bg-white rounded-xl shadow-2xl">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <p className="text-sm text-gray-600">{agentName} is asking</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-white rounded transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
                <span className="text-xs text-gray-500">
                  {Math.round(((currentStepIndex + 1) / steps.length) * 100)}% complete
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-base font-medium text-gray-900 mb-3">
                {currentStep.question}
              </label>
              {renderInput()}
            </div>

            <div className="flex items-center justify-between space-x-3">
              <button
                onClick={handleBack}
                disabled={isFirstStep}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  isFirstStep
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              <div className="flex space-x-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNext}
                  disabled={!canProceed}
                  className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                    canProceed
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <span>{isLastStep ? 'Complete' : 'Next'}</span>
                  {!isLastStep && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
