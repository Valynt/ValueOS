import { Briefcase, ChevronLeft, ChevronRight, Target, TrendingUp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SetupData {
  companyName: string;
  role: "build-cases" | "close-deals" | "prove-value" | null;
}

interface SetupWizardProps {
  onComplete: (data: SetupData) => void;
  initialData?: Partial<SetupData>;
}

const TOTAL_STEPS = 3;

const ROLE_OPTIONS = [
  {
    id: "build-cases" as const,
    icon: Briefcase,
    title: "Build Cases",
    description: "Pre-sales, consulting",
  },
  {
    id: "close-deals" as const,
    icon: Target,
    title: "Close Deals",
    description: "Account executive",
  },
  {
    id: "prove-value" as const,
    icon: TrendingUp,
    title: "Prove Value",
    description: "Customer success",
  },
];

export function SetupWizard({ onComplete, initialData }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<SetupData>({
    companyName: initialData?.companyName ?? "",
    role: initialData?.role ?? null,
  });

  const canContinue = () => {
    switch (step) {
      case 1:
        return data.companyName.trim().length > 0;
      case 2:
        return data.role !== null;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleContinue = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      onComplete(data);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-xl">
        <CardContent className="p-8">
          {step === 1 && (
            <Step1Organization
              companyName={data.companyName}
              onChange={(name) => setData({ ...data, companyName: name })}
            />
          )}

          {step === 2 && (
            <Step2Role
              selectedRole={data.role}
              onChange={(role) => setData({ ...data, role })}
            />
          )}

          {step === 3 && (
            <Step3Confirmation data={data} />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-end gap-3 mt-8">
            {step > 1 && (
              <Button variant="ghost" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button onClick={handleContinue} disabled={!canContinue()}>
              {step === TOTAL_STEPS ? "Get Started" : "Continue"}
              {step < TOTAL_STEPS && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mt-6">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              i + 1 === step ? "bg-primary" : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </div>
  );
}

interface Step1Props {
  companyName: string;
  onChange: (name: string) => void;
}

function Step1Organization({ companyName, onChange }: Step1Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Step 1 of 3</p>
        <h1 className="text-2xl font-semibold">What's your company name?</h1>
      </div>

      <Input
        value={companyName}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Acme Corporation"
        inputSize="lg"
        autoFocus
      />

      <p className="text-sm text-muted-foreground">
        This helps us personalize your experience and organize your team's work.
      </p>
    </div>
  );
}

interface Step2Props {
  selectedRole: SetupData["role"];
  onChange: (role: SetupData["role"]) => void;
}

function Step2Role({ selectedRole, onChange }: Step2Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Step 2 of 3</p>
        <h1 className="text-2xl font-semibold">What's your primary role?</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {ROLE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedRole === option.id;

          return (
            <button
              key={option.id}
              onClick={() => onChange(option.id)}
              className={cn(
                "flex flex-col items-center p-4 rounded-lg border-2 transition-all text-center",
                "hover:border-primary/50 hover:bg-primary/5",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background"
              )}
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center mb-3",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <p className="font-medium text-sm">{option.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Step3Props {
  data: SetupData;
}

function Step3Confirmation({ data }: Step3Props) {
  const roleLabel = ROLE_OPTIONS.find((r) => r.id === data.role)?.title ?? "";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Step 3 of 3</p>
        <h1 className="text-2xl font-semibold">You're all set!</h1>
      </div>

      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">Company</p>
          <p className="font-medium">{data.companyName}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Role</p>
          <p className="font-medium">{roleLabel}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        We'll customize your workspace based on your role. You can change these settings anytime.
      </p>
    </div>
  );
}

export default SetupWizard;
