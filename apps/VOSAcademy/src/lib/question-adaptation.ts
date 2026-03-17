/**
 * Question Adaptation Service
 * Adapts quiz questions based on user role and context
 */

import { CurriculumModule } from '../data/curriculum';

export interface AdaptedQuestion {
  id: number;
  pillarId: number;
  questionText: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  options: Array<{
    value: string;
    label: string;
    explanation?: string;
  }>;
  correctAnswer: string;
  explanation: string;
  learningObjectives: string[];
  relatedModules?: string[];
  roleContext?: string;
}

export interface RoleAdaptationRules {
  [role: string]: {
    terminology: Record<string, string>;
    focusAreas: string[];
    complexity: 'simplify' | 'standard' | 'enhance';
    contextAdditions: string[];
  };
}

const ROLE_ADAPTATION_RULES: RoleAdaptationRules = {
  sales: {
    terminology: {
      'customer': 'prospect',
      'implementation': 'deployment',
      'ROI': 'value realization',
      'business case': 'value proposition',
      'stakeholders': 'decision-makers'
    },
    focusAreas: ['value discovery', 'ROI modeling', 'objection handling'],
    complexity: 'enhance',
    contextAdditions: [
      'Focus on how this impacts sales conversations',
      'Consider prospect perspective and concerns',
      'Think about competitive positioning'
    ]
  },

  customer_success: {
    terminology: {
      'prospect': 'customer',
      'deployment': 'adoption',
      'ROI': 'value realization',
      'value proposition': 'success metrics',
      'decision-makers': 'stakeholders'
    },
    focusAreas: ['adoption', 'expansion', 'retention', 'success metrics'],
    complexity: 'standard',
    contextAdditions: [
      'Consider long-term customer relationship',
      'Focus on measurable outcomes',
      'Think about renewal and expansion opportunities'
    ]
  },

  marketing: {
    terminology: {
      'prospect': 'audience',
      'deployment': 'campaign',
      'ROI': 'campaign effectiveness',
      'value proposition': 'messaging',
      'decision-makers': 'target personas'
    },
    focusAreas: ['messaging', 'content strategy', 'lead generation', 'brand positioning'],
    complexity: 'enhance',
    contextAdditions: [
      'Consider audience segmentation and targeting',
      'Focus on content and messaging effectiveness',
      'Think about lead quality and conversion'
    ]
  },

  product: {
    terminology: {
      'prospect': 'user',
      'deployment': 'rollout',
      'ROI': 'product success metrics',
      'value proposition': 'product value',
      'decision-makers': 'product stakeholders'
    },
    focusAreas: ['user experience', 'product-market fit', 'feature adoption', 'technical implementation'],
    complexity: 'enhance',
    contextAdditions: [
      'Consider user journey and experience',
      'Focus on technical feasibility and implementation',
      'Think about product roadmap and prioritization'
    ]
  },

  executive: {
    terminology: {
      'prospect': 'stakeholder',
      'deployment': 'transformation',
      'ROI': 'strategic impact',
      'value proposition': 'business case',
      'decision-makers': 'leadership team'
    },
    focusAreas: ['strategic alignment', 'organizational change', 'leadership', 'governance'],
    complexity: 'enhance',
    contextAdditions: [
      'Consider organizational impact and change management',
      'Focus on strategic alignment and leadership',
      'Think about governance and compliance'
    ]
  },

  value_engineer: {
    terminology: {
      'prospect': 'client',
      'deployment': 'implementation',
      'ROI': 'value engineering metrics',
      'value proposition': 'value engineering framework',
      'decision-makers': 'value stakeholders'
    },
    focusAreas: ['methodology', 'frameworks', 'measurement', 'optimization'],
    complexity: 'enhance',
    contextAdditions: [
      'Apply value engineering principles rigorously',
      'Consider methodological accuracy and completeness',
      'Focus on measurement and optimization frameworks'
    ]
  }
};

/**
 * Adapt a question for a specific user role
 */
export function adaptQuestionForRole(
  baseQuestion: AdaptedQuestion,
  userRole?: string,
  userMaturityLevel: number = 0
): AdaptedQuestion {
  if (!userRole || !ROLE_ADAPTATION_RULES[userRole]) {
    // Return base question if no adaptation needed
    return {
      id: baseQuestion.id,
      pillarId: baseQuestion.pillarId,
      questionText: baseQuestion.questionText,
      category: baseQuestion.category,
      difficulty: baseQuestion.difficulty,
      options: baseQuestion.options,
      correctAnswer: baseQuestion.correctAnswer,
      explanation: baseQuestion.explanation,
      learningObjectives: baseQuestion.learningObjectives,
      relatedModules: baseQuestion.relatedModules
    };
  }

  const rules = ROLE_ADAPTATION_RULES[userRole];

  // Apply terminology substitutions
  let adaptedQuestionText = baseQuestion.questionText;
  let adaptedExplanation = baseQuestion.explanation;

  Object.entries(rules.terminology).forEach(([generic, specific]) => {
    const regex = new RegExp(`\\b${generic}\\b`, 'gi');
    adaptedQuestionText = adaptedQuestionText.replace(regex, specific);
    adaptedExplanation = adaptedExplanation.replace(regex, specific);
  });

  // Add role context to question
  const contextAddition = rules.contextAdditions[Math.floor(Math.random() * rules.contextAdditions.length)];
  adaptedQuestionText += ` (${contextAddition})`;

  // Adjust difficulty based on role complexity preference
  let adaptedDifficulty = baseQuestion.difficulty;
  if (rules.complexity === 'simplify' && userMaturityLevel < 3) {
    // Make easier for roles that prefer simpler content
    adaptedDifficulty = baseQuestion.difficulty === 'hard' ? 'medium' : baseQuestion.difficulty;
  } else if (rules.complexity === 'enhance' && userMaturityLevel >= 2) {
    // Make harder for roles that can handle complexity
    adaptedDifficulty = baseQuestion.difficulty === 'easy' ? 'medium' : baseQuestion.difficulty;
  }

  // Adapt options based on role terminology
  const adaptedOptions = baseQuestion.options.map((option) => {
    let adaptedLabel = option.label;
    Object.entries(rules.terminology).forEach(([generic, specific]) => {
      const regex = new RegExp(`\\b${generic}\\b`, 'gi');
      adaptedLabel = adaptedLabel.replace(regex, specific);
    });

    return {
      value: option.value,
      label: adaptedLabel,
      explanation: option.explanation
    };
  });

  return {
    id: baseQuestion.id,
    pillarId: baseQuestion.pillarId,
    questionText: adaptedQuestionText,
    category: baseQuestion.category,
    difficulty: adaptedDifficulty,
    options: adaptedOptions,
    correctAnswer: baseQuestion.correctAnswer,
    explanation: adaptedExplanation,
    learningObjectives: baseQuestion.learningObjectives,
    relatedModules: baseQuestion.relatedModules,
    roleContext: contextAddition
  };
}

/**
 * Get role-specific question pool
 */
export function getRoleSpecificQuestions(
  baseQuestions: AdaptedQuestion[],
  userRole?: string,
  userMaturityLevel: number = 0
): AdaptedQuestion[] {
  return baseQuestions.map(question =>
    adaptQuestionForRole(question, userRole, userMaturityLevel)
  );
}

/**
 * Filter questions based on role relevance
 */
export function filterQuestionsByRoleRelevance(
  questions: AdaptedQuestion[],
  userRole?: string
): AdaptedQuestion[] {
  if (!userRole || !ROLE_ADAPTATION_RULES[userRole]) {
    return questions;
  }

  const roleFocusAreas = ROLE_ADAPTATION_RULES[userRole].focusAreas;

  // Prioritize questions that match role focus areas
  const relevantQuestions = questions.filter(question =>
    roleFocusAreas.some(area =>
      question.category.toLowerCase().includes(area.toLowerCase()) ||
      question.questionText.toLowerCase().includes(area.toLowerCase())
    )
  );

  // If we have enough relevant questions, return them
  if (relevantQuestions.length >= Math.min(10, questions.length * 0.6)) {
    return relevantQuestions;
  }

  // Otherwise, return a mix of relevant and general questions
  const generalQuestions = questions.filter(q => !relevantQuestions.includes(q));
  return [...relevantQuestions, ...generalQuestions.slice(0, 10 - relevantQuestions.length)];
}

/**
 * Generate role-specific hints for incorrect answers
 */
export function generateRoleSpecificHints(
  question: AdaptedQuestion,
  userRole?: string
): string[] {
  if (!userRole || !ROLE_ADAPTATION_RULES[userRole]) {
    return [
      "Review the fundamental concepts in this area",
      "Consult the learning modules for more context",
      "Practice with similar examples"
    ];
  }

  const rules = ROLE_ADAPTATION_RULES[userRole];
  const hints: string[] = [];

  // Role-specific hints based on focus areas
  rules.focusAreas.forEach(area => {
    hints.push(`Consider how this relates to ${area} in your role`);
  });

  // Add general learning hints
  hints.push("Review the pillar content for deeper understanding");
  hints.push("Practice applying this concept in real scenarios");

  return hints.slice(0, 3);
}

/**
 * Adapt learning objectives for role context
 */
export function adaptLearningObjectives(
  objectives: string[],
  userRole?: string
): string[] {
  if (!userRole || !ROLE_ADAPTATION_RULES[userRole]) {
    return objectives;
  }

  const rules = ROLE_ADAPTATION_RULES[userRole];

  return objectives.map(objective => {
    let adapted = objective;
    Object.entries(rules.terminology).forEach(([generic, specific]) => {
      const regex = new RegExp(`\\b${generic}\\b`, 'gi');
      adapted = adapted.replace(regex, specific);
    });
    return adapted;
  });
}
