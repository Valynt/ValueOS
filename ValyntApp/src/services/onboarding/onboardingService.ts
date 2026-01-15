import { storage, STORAGE_KEYS } from "../storage";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  steps: OnboardingStep[];
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: "profile",
    title: "Complete your profile",
    description: "Add your name and profile picture",
    completed: false,
  },
  {
    id: "workspace",
    title: "Create a workspace",
    description: "Set up your first workspace",
    completed: false,
  },
  {
    id: "invite",
    title: "Invite team members",
    description: "Collaborate with your team",
    completed: false,
  },
  {
    id: "project",
    title: "Create your first project",
    description: "Start working on something great",
    completed: false,
  },
];

class OnboardingService {
  private state: OnboardingState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): OnboardingState {
    const saved = storage.get<OnboardingState>(STORAGE_KEYS.ONBOARDING_COMPLETED);
    if (saved) return saved;

    return {
      completed: false,
      currentStep: 0,
      steps: DEFAULT_STEPS,
    };
  }

  private saveState(): void {
    storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, this.state);
  }

  getState(): OnboardingState {
    return { ...this.state };
  }

  getCurrentStep(): OnboardingStep | null {
    if (this.state.completed) return null;
    return this.state.steps[this.state.currentStep] || null;
  }

  completeStep(stepId: string): void {
    const stepIndex = this.state.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) return;

    const step = this.state.steps[stepIndex];
    if (step) step.completed = true;

    // Move to next incomplete step
    const nextIncomplete = this.state.steps.findIndex((s) => !s.completed);
    if (nextIncomplete === -1) {
      this.state.completed = true;
      this.state.currentStep = this.state.steps.length;
    } else {
      this.state.currentStep = nextIncomplete;
    }

    this.saveState();
  }

  skipOnboarding(): void {
    this.state.completed = true;
    this.saveState();
  }

  resetOnboarding(): void {
    this.state = {
      completed: false,
      currentStep: 0,
      steps: DEFAULT_STEPS.map((s) => ({ ...s, completed: false })),
    };
    this.saveState();
  }

  isCompleted(): boolean {
    return this.state.completed;
  }

  getProgress(): number {
    const completedCount = this.state.steps.filter((s) => s.completed).length;
    return Math.round((completedCount / this.state.steps.length) * 100);
  }
}

export const onboardingService = new OnboardingService();
