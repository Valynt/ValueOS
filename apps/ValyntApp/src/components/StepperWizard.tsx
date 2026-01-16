// /workspaces/ValueOS/apps/ValyntApp/src/components/StepperWizard.tsx
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Step {
  label: string;
  content: React.ReactNode;
}

interface StepperWizardProps {
  steps: Step[];
  currentStep: number;
  onNext: () => void;
  onBack: () => void;
  canNext: boolean;
  canBack: boolean;
}

const StepperWizard: React.FC<StepperWizardProps> = ({
  steps,
  currentStep,
  onNext,
  onBack,
  canNext,
  canBack,
}) => {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex mb-8">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`flex-1 text-center ${index <= currentStep ? "text-blue-600" : "text-gray-400"}`}
          >
            <div
              className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center border-2 ${index === currentStep ? "border-blue-600 bg-blue-600 text-white" : index < currentStep ? "border-blue-600 bg-blue-600 text-white" : "border-gray-400"}`}
            >
              {index + 1}
            </div>
            <p className="mt-2 text-sm">{step.label}</p>
          </div>
        ))}
      </div>
      <div className="mb-8">{steps[currentStep]?.content || <div>Invalid step</div>}</div>
      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={!canBack}
          className="flex items-center px-4 py-2 bg-gray-300 text-gray-700 rounded disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canNext}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
};

export default StepperWizard;
