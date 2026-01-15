/**
 * Scenario-Based Question Template
 * Framework for creating interactive scenario-based quiz questions
 */

export interface ScenarioStep {
  id: string;
  description: string;
  options: Array<{
    id: string;
    text: string;
    feedback: string;
    leadsTo?: string; // Next step ID
    isCorrect?: boolean;
    points?: number;
  }>;
  timeLimit?: number; // seconds
  requiredMaturityLevel?: number;
}

export interface ScenarioQuestion {
  id: number;
  pillarId: number;
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  roleVariants?: Record<string, {
    title: string;
    description: string;
    steps: ScenarioStep[];
  }>;
  steps: ScenarioStep[];
  learningObjectives: string[];
  successCriteria: string[];
  estimatedTime: number; // minutes
  maxScore: number;
  relatedModules: string[];
}

export interface ScenarioAttempt {
  questionId: number;
  stepId: string;
  selectedOptionId: string;
  timeSpent: number;
  isCorrect: boolean;
  feedback: string;
  score: number;
}

export interface ScenarioResult {
  questionId: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  pathTaken: string[];
  timeSpent: number;
  completedSteps: number;
  totalSteps: number;
  learningOutcomes: string[];
}

/**
 * Scenario Question Template Class
 */
export class ScenarioQuestionTemplate {
  private question: ScenarioQuestion;
  private currentStepIndex: number = 0;
  private path: string[] = [];
  private attempts: ScenarioAttempt[] = [];
  private startTime: Date = new Date();

  constructor(question: ScenarioQuestion) {
    this.question = question;
  }

  /**
   * Get current step
   */
  getCurrentStep(): ScenarioStep | null {
    const steps = this.getAdaptedSteps();
    return steps[this.currentStepIndex] || null;
  }

  /**
   * Get adapted steps based on user role
   */
  private getAdaptedSteps(): ScenarioStep[] {
    // This would adapt steps based on user role
    // For now, return base steps
    return this.question.steps;
  }

  /**
   * Process user choice and move to next step
   */
  processChoice(optionId: string): {
    feedback: string;
    isCorrect: boolean;
    score: number;
    nextStep: ScenarioStep | null;
    isComplete: boolean;
  } {
    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      throw new Error('No current step available');
    }

    const selectedOption = currentStep.options.find(opt => opt.id === optionId);
    if (!selectedOption) {
      throw new Error('Invalid option selected');
    }

    const timeSpent = Math.round((new Date().getTime() - this.startTime.getTime()) / 1000);

    // Record attempt
    const attempt: ScenarioAttempt = {
      questionId: this.question.id,
      stepId: currentStep.id,
      selectedOptionId: optionId,
      timeSpent,
      isCorrect: selectedOption.isCorrect || false,
      feedback: selectedOption.feedback,
      score: selectedOption.points || (selectedOption.isCorrect ? 1 : 0)
    };

    this.attempts.push(attempt);
    this.path.push(currentStep.id);

    // Determine next step
    let nextStepIndex = this.currentStepIndex;
    if (selectedOption.leadsTo) {
      // Find step by ID
      const steps = this.getAdaptedSteps();
      const nextStepIdx = steps.findIndex(step => step.id === selectedOption.leadsTo);
      if (nextStepIdx !== -1) {
        nextStepIndex = nextStepIdx;
      }
    } else {
      // Move to next sequential step
      nextStepIndex = this.currentStepIndex + 1;
    }

    this.currentStepIndex = nextStepIndex;
    const nextStep = this.getAdaptedSteps()[nextStepIndex] || null;
    const isComplete = !nextStep;

    return {
      feedback: selectedOption.feedback,
      isCorrect: attempt.isCorrect,
      score: attempt.score,
      nextStep,
      isComplete
    };
  }

  /**
   * Get current progress
   */
  getProgress(): {
    currentStep: number;
    totalSteps: number;
    percentage: number;
    path: string[];
  } {
    const totalSteps = this.getAdaptedSteps().length;
    return {
      currentStep: this.currentStepIndex + 1,
      totalSteps,
      percentage: Math.round(((this.currentStepIndex + 1) / totalSteps) * 100),
      path: [...this.path]
    };
  }

  /**
   * Calculate final result
   */
  getResult(): ScenarioResult {
    const totalScore = this.attempts.reduce((sum, attempt) => sum + attempt.score, 0);
    const totalTime = this.attempts.reduce((sum, attempt) => sum + attempt.timeSpent, 0);

    return {
      questionId: this.question.id,
      totalScore,
      maxScore: this.question.maxScore,
      percentage: Math.round((totalScore / this.question.maxScore) * 100),
      pathTaken: [...this.path],
      timeSpent: totalTime,
      completedSteps: this.attempts.length,
      totalSteps: this.question.steps.length,
      learningOutcomes: this.question.learningObjectives
    };
  }

  /**
   * Reset scenario for retake
   */
  reset(): void {
    this.currentStepIndex = 0;
    this.path = [];
    this.attempts = [];
    this.startTime = new Date();
  }
}

/**
 * Predefined scenario templates for different categories
 */
export const SCENARIO_TEMPLATES = {
  sales_discovery: {
    title: "Value Discovery Scenario",
    description: "Guide a prospect through value discovery conversation",
    difficulty: 'medium' as const,
    steps: [
      {
        id: "initial_contact",
        description: "You meet with a prospect who mentions they're struggling with inefficient processes. How do you begin the discovery conversation?",
        options: [
          {
            id: "generic_questions",
            text: "Ask generic questions about their business",
            feedback: "Good start, but you could be more specific about value-related challenges.",
            leadsTo: "surface_pain",
            isCorrect: false,
            points: 1
          },
          {
            id: "value_focused",
            text: "Ask about specific value gaps and opportunities",
            feedback: "Excellent! This focuses on quantifiable value opportunities.",
            leadsTo: "quantify_impact",
            isCorrect: true,
            points: 3
          }
        ]
      },
      {
        id: "surface_pain",
        description: "The prospect mentions they spend too much time on manual processes. What do you explore next?",
        options: [
          {
            id: "technical_solution",
            text: "Immediately suggest a technical solution",
            feedback: "Jumping to solution too early. Need to understand the full impact first.",
            isCorrect: false,
            points: 0
          },
          {
            id: "business_impact",
            text: "Explore the business impact and cost of these inefficiencies",
            feedback: "Perfect! This helps quantify the value opportunity.",
            isCorrect: true,
            points: 2
          }
        ]
      }
    ],
    learningObjectives: [
      "Conduct effective value discovery conversations",
      "Identify and quantify value opportunities",
      "Build compelling business cases"
    ],
    successCriteria: [
      "Follow structured discovery process",
      "Uncover quantifiable value gaps",
      "Build towards business case"
    ],
    estimatedTime: 15,
    maxScore: 10
  },

  customer_success_expansion: {
    title: "Expansion Opportunity Scenario",
    description: "Identify and pursue expansion opportunities with existing customers",
    difficulty: 'hard' as const,
    steps: [
      {
        id: "usage_analysis",
        description: "Your customer has been using your solution for 6 months. Usage analytics show they're only using 40% of available features. What's your first step?",
        options: [
          {
            id: "immediate_sale",
            text: "Immediately try to sell additional features",
            feedback: "Too aggressive. Need to understand why they're not using features first.",
            isCorrect: false,
            points: 0
          },
          {
            id: "adoption_discovery",
            text: "Conduct adoption discovery to understand barriers",
            feedback: "Smart approach! Understanding adoption barriers is key to expansion.",
            leadsTo: "value_realization",
            isCorrect: true,
            points: 2
          }
        ]
      }
    ],
    learningObjectives: [
      "Monitor customer adoption and usage",
      "Identify expansion opportunities",
      "Develop customer success-driven sales strategies"
    ],
    successCriteria: [
      "Monitor adoption metrics effectively",
      "Identify unused value opportunities",
      "Create expansion strategies"
    ],
    estimatedTime: 12,
    maxScore: 8
  },

  product_prioritization: {
    title: "Product Prioritization Scenario",
    description: "Prioritize features based on value engineering principles",
    difficulty: 'medium' as const,
    steps: [
      {
        id: "feature_evaluation",
        description: "Your product team has proposed three new features. How do you evaluate which ones to prioritize?",
        options: [
          {
            id: "gut_feel",
            text: "Use gut feel and team preferences",
            feedback: "Not systematic. Value engineering requires data-driven decisions.",
            isCorrect: false,
            points: 0
          },
          {
            id: "value_metrics",
            text: "Evaluate based on customer value and business impact metrics",
            feedback: "Excellent! This applies value engineering principles systematically.",
            leadsTo: "roi_modeling",
            isCorrect: true,
            points: 3
          }
        ]
      }
    ],
    learningObjectives: [
      "Apply value engineering to product decisions",
      "Evaluate features based on customer value",
      "Balance business and customer impact"
    ],
    successCriteria: [
      "Use systematic evaluation framework",
      "Consider both customer and business value",
      "Make data-driven prioritization decisions"
    ],
    estimatedTime: 10,
    maxScore: 6
  }
};

/**
 * Create a scenario question from template
 */
export function createScenarioQuestion(
  templateKey: keyof typeof SCENARIO_TEMPLATES,
  pillarId: number,
  role?: string
): ScenarioQuestion {
  const template = SCENARIO_TEMPLATES[templateKey];

  return {
    id: Date.now(), // Generate unique ID
    pillarId,
    ...template,
    category: templateKey.split('_')[0], // Extract category from key
    difficulty: template.difficulty || 'medium', // Add default difficulty
    relatedModules: [`pillar-${pillarId}-modules`]
  };
}

/**
 * Validate scenario question structure
 */
export function validateScenarioQuestion(question: ScenarioQuestion): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!question.title) errors.push('Missing title');
  if (!question.steps || question.steps.length === 0) errors.push('No steps defined');
  if (!question.learningObjectives || question.learningObjectives.length === 0) {
    errors.push('No learning objectives defined');
  }

  // Validate steps
  question.steps.forEach((step, index) => {
    if (!step.id) errors.push(`Step ${index}: missing id`);
    if (!step.description) errors.push(`Step ${index}: missing description`);
    if (!step.options || step.options.length === 0) errors.push(`Step ${index}: no options defined`);

    step.options.forEach((option, optIndex) => {
      if (!option.id) errors.push(`Step ${index}, Option ${optIndex}: missing id`);
      if (!option.text) errors.push(`Step ${index}, Option ${optIndex}: missing text`);
      if (!option.feedback) errors.push(`Step ${index}, Option ${optIndex}: missing feedback`);
    });
  });

  return { valid: errors.length === 0, errors };
}
