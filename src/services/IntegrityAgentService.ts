/**
 * Integrity Agent Service
 * 
 * Service for evaluating Value Commits and quiz submissions
 * against governance standards and conservative modeling principles.
 */

import { LLMGateway } from '../lib/agent-fabric/LLMGateway';
import { logger } from '../lib/logger';
import { llmConfig } from '../config/llm';
import { QuizQuestion, LabSuccessCriterion } from '../types/academy';

// Lab message type (also defined in LabPanel)
interface LabMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
}

// ============================================================================
// Types
// ============================================================================

export interface IntegrityCheck {
  passed: boolean;
  score: number;
  issues: IntegrityIssue[];
  recommendations: string[];
}

export interface IntegrityIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'assumption' | 'baseline' | 'methodology' | 'governance';
  description: string;
  location?: string;
  suggestion?: string;
}

export interface QuizGradingResult {
  score: number;
  passed: boolean;
  questionResults: QuestionResult[];
  feedback: string;
}

export interface QuestionResult {
  questionId: string;
  correct: boolean;
  userAnswer: string | string[];
  correctAnswer: string | string[];
  explanation: string;
  partialCredit?: number;
}

export interface LabEvaluationResult {
  overallScore: number;
  criteriaResults: CriterionResult[];
  strengths: string[];
  areasForImprovement: string[];
  feedback: string;
}

export interface CriterionResult {
  criterionId: string;
  met: boolean;
  score: number;
  evidence: string[];
  feedback: string;
}

// ============================================================================
// Integrity Agent Service
// ============================================================================

class IntegrityAgentService {
  private llmGateway: LLMGateway;

  constructor() {
    this.llmGateway = new LLMGateway(llmConfig.provider, llmConfig.gatingEnabled);
  }

  /**
   * Check a Value Commit document against governance standards
   */
  async checkValueCommit(valueCommitContent: string): Promise<IntegrityCheck> {
    try {
      const prompt = this.buildValueCommitCheckPrompt(valueCommitContent);
      
      const messages = [
        {
          role: 'system' as const,
          content: `You are the Integrity Agent, responsible for ensuring Value Commits meet governance standards.

Your standards:
1. All assumptions must be evidence-based (customer data or industry benchmarks)
2. ROI projections must include risk adjustment (minimum 20% haircut)
3. Baseline metrics must be from verifiable sources, not estimates
4. Success criteria must be specific, measurable, and time-bound
5. Payback period must be calculated net of all costs

Respond with a JSON object containing:
{
  "passed": boolean,
  "score": number (0-100),
  "issues": [{"severity": "critical|warning|info", "category": "assumption|baseline|methodology|governance", "description": string, "suggestion": string}],
  "recommendations": [string]
}`
        },
        { role: 'user' as const, content: prompt }
      ];

      const response = await this.llmGateway.complete(messages, {
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        temperature: 0.3,
        max_tokens: 1500,
      });

      const content = response.content || '{}';
      const result = this.parseJSONResponse(content) as {
        passed?: boolean;
        score?: number;
        issues?: IntegrityIssue[];
        recommendations?: string[];
      };

      return {
        passed: result.passed ?? false,
        score: result.score ?? 0,
        issues: result.issues ?? [],
        recommendations: result.recommendations ?? [],
      };
    } catch (error) {
      logger.error('Failed to check value commit', error instanceof Error ? error : undefined);
      return {
        passed: false,
        score: 0,
        issues: [{
          severity: 'critical',
          category: 'methodology',
          description: 'Unable to evaluate document',
        }],
        recommendations: ['Please try again or contact support'],
      };
    }
  }

  /**
   * Grade a quiz submission
   */
  async gradeQuiz(
    questions: QuizQuestion[],
    userAnswers: Record<string, string | string[]>,
    passingScore: number
  ): Promise<QuizGradingResult> {
    const questionResults: QuestionResult[] = [];
    let totalPoints = 0;
    let earnedPoints = 0;

    for (const question of questions) {
      totalPoints += question.points;
      const userAnswer = userAnswers[question.id];
      
      const result = this.gradeQuestion(question, userAnswer);
      questionResults.push(result);
      
      if (result.correct) {
        earnedPoints += question.points;
      } else if (result.partialCredit) {
        earnedPoints += question.points * result.partialCredit;
      }
    }

    const score = Math.round((earnedPoints / totalPoints) * 100);
    const passed = score >= passingScore;

    // Generate feedback using LLM for failed attempts
    let feedback = passed 
      ? 'Great job! You demonstrated strong understanding of the material.'
      : 'Review the explanations for incorrect answers and try again.';

    if (!passed) {
      const incorrectQuestions = questionResults.filter(r => !r.correct);
      if (incorrectQuestions.length > 0) {
        feedback = await this.generateQuizFeedback(incorrectQuestions);
      }
    }

    return {
      score,
      passed,
      questionResults,
      feedback,
    };
  }

  /**
   * Evaluate a lab conversation against success criteria
   */
  async evaluateLab(
    messages: LabMessage[],
    criteria: LabSuccessCriterion[],
    agentType: string,
    scenario: string
  ): Promise<LabEvaluationResult> {
    try {
      const conversationText = messages
        .filter(m => m.role !== 'system')
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');

      const prompt = `Evaluate this ${agentType} lab conversation for the scenario: "${scenario}"

CONVERSATION:
${conversationText}

SUCCESS CRITERIA TO EVALUATE:
${criteria.map(c => `- ${c.id}: ${c.description} (weight: ${c.weight})`).join('\n')}

For each criterion, determine if it was met based on the conversation.
Look for specific evidence in the user's messages.

Respond with JSON:
{
  "criteriaResults": [
    {
      "criterionId": string,
      "met": boolean,
      "score": number (0-100),
      "evidence": [string],
      "feedback": string
    }
  ],
  "strengths": [string],
  "areasForImprovement": [string],
  "overallFeedback": string
}`;

      const evalMessages = [
        {
          role: 'system' as const,
          content: 'You are an expert evaluator for sales and value engineering training labs. Be fair but rigorous in your assessment. Look for specific evidence in the conversation.'
        },
        { role: 'user' as const, content: prompt }
      ];

      const response = await this.llmGateway.complete(evalMessages, {
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.content || '{}';
      const result = this.parseJSONResponse(content) as {
        criteriaResults?: Array<{
          criterionId: string;
          met: boolean;
          score: number;
          evidence: string[];
          feedback: string;
        }>;
        strengths?: string[];
        areasForImprovement?: string[];
        overallFeedback?: string;
      };

      // Calculate overall score
      const criteriaResults = result.criteriaResults || [];
      const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
      const earnedScore = criteriaResults.reduce((sum: number, r) => {
        const criterion = criteria.find(c => c.id === r.criterionId);
        return sum + (r.met ? (criterion?.weight || 0) : 0);
      }, 0);
      const overallScore = Math.round((earnedScore / totalWeight) * 100);

      return {
        overallScore,
        criteriaResults: criteriaResults.map((r) => ({
          criterionId: r.criterionId,
          met: r.met,
          score: r.met ? 100 : 0,
          evidence: r.evidence || [],
          feedback: r.feedback || '',
        })),
        strengths: result.strengths || [],
        areasForImprovement: result.areasForImprovement || [],
        feedback: result.overallFeedback || 'Evaluation complete.',
      };
    } catch (error) {
      logger.error('Failed to evaluate lab', error instanceof Error ? error : undefined);
      
      // Return default evaluation
      return {
        overallScore: 0,
        criteriaResults: criteria.map(c => ({
          criterionId: c.id,
          met: false,
          score: 0,
          evidence: [],
          feedback: 'Unable to evaluate',
        })),
        strengths: [],
        areasForImprovement: ['Unable to complete evaluation'],
        feedback: 'An error occurred during evaluation. Please try again.',
      };
    }
  }

  /**
   * Check assumptions against industry benchmarks
   */
  async validateAssumptions(assumptions: Record<string, number>): Promise<{
    valid: boolean;
    issues: Array<{
      metric: string;
      value: number;
      benchmark: { min: number; max: number };
      status: 'within_range' | 'aggressive' | 'conservative';
    }>;
  }> {
    const benchmarks: Record<string, { min: number; max: number; label: string }> = {
      efficiency_improvement: { min: 5, max: 15, label: 'Efficiency improvement %' },
      adoption_rate: { min: 60, max: 85, label: 'Year 1 adoption rate %' },
      productivity_gain: { min: 8, max: 20, label: 'Productivity gain %' },
      cost_reduction: { min: 5, max: 12, label: 'Cost reduction %' },
      revenue_increase: { min: 3, max: 10, label: 'Revenue increase %' },
      time_to_value_months: { min: 3, max: 9, label: 'Time to value (months)' },
      implementation_success_rate: { min: 60, max: 75, label: 'Implementation success rate %' },
    };

    const issues: Array<{
      metric: string;
      value: number;
      benchmark: { min: number; max: number };
      status: 'within_range' | 'aggressive' | 'conservative';
    }> = [];

    for (const [metric, value] of Object.entries(assumptions)) {
      const benchmark = benchmarks[metric];
      if (!benchmark) continue;

      let status: 'within_range' | 'aggressive' | 'conservative';
      
      if (value > benchmark.max) {
        status = 'aggressive';
      } else if (value < benchmark.min) {
        status = 'conservative';
      } else {
        status = 'within_range';
      }

      issues.push({
        metric: benchmark.label,
        value,
        benchmark: { min: benchmark.min, max: benchmark.max },
        status,
      });
    }

    const hasAggressiveAssumptions = issues.some(i => i.status === 'aggressive');

    return {
      valid: !hasAggressiveAssumptions,
      issues,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildValueCommitCheckPrompt(content: string): string {
    return `Please review the following Value Commit document for compliance with governance standards:

---
${content}
---

Check for:
1. Are all assumptions supported by evidence?
2. Is there appropriate risk adjustment in projections?
3. Are baseline metrics from verifiable sources?
4. Are success criteria specific and measurable?
5. Is the methodology sound and conservative?

Provide your assessment.`;
  }

  private gradeQuestion(question: QuizQuestion, userAnswer: string | string[] | undefined): QuestionResult {
    const correctAnswer = question.correctAnswer;
    let correct = false;
    let partialCredit: number | undefined;

    if (!userAnswer) {
      return {
        questionId: question.id,
        correct: false,
        userAnswer: '',
        correctAnswer,
        explanation: question.explanation,
      };
    }

    switch (question.type) {
      case 'multiple_choice':
      case 'true_false':
        correct = userAnswer === correctAnswer;
        break;
        
      case 'drag_drop':
        if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
          const correctCount = userAnswer.filter((a, i) => a === correctAnswer[i]).length;
          correct = correctCount === correctAnswer.length;
          if (!correct && correctCount > 0) {
            partialCredit = correctCount / correctAnswer.length;
          }
        }
        break;
        
      case 'fill_blank':
        const normalizedUser = String(userAnswer).toLowerCase().trim();
        const normalizedCorrect = Array.isArray(correctAnswer) 
          ? correctAnswer.map(a => a.toLowerCase().trim())
          : [String(correctAnswer).toLowerCase().trim()];
        correct = normalizedCorrect.includes(normalizedUser);
        break;
    }

    return {
      questionId: question.id,
      correct,
      userAnswer,
      correctAnswer,
      explanation: question.explanation,
      partialCredit,
    };
  }

  private async generateQuizFeedback(incorrectQuestions: QuestionResult[]): Promise<string> {
    try {
      const questionsText = incorrectQuestions
        .map(q => `- Question ${q.questionId}: User answered "${q.userAnswer}", correct was "${q.correctAnswer}"`)
        .join('\n');

      const feedbackMessages = [
        {
          role: 'system' as const,
          content: 'Generate brief, encouraging feedback for a learner who got some quiz questions wrong. Focus on key concepts to review.'
        },
        {
          role: 'user' as const,
          content: `The learner missed these questions:\n${questionsText}\n\nProvide 2-3 sentences of constructive feedback.`
        }
      ];

      const response = await this.llmGateway.complete(feedbackMessages, {
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        temperature: 0.5,
        max_tokens: 200,
      });

      return response.content || 'Review the explanations and try again.';
    } catch {
      return 'Review the explanations for incorrect answers and try again.';
    }
  }

  private parseJSONResponse(content: string): Record<string, unknown> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch {
      logger.warn('Failed to parse JSON response', { content: content.slice(0, 200) });
      return {};
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const integrityAgentService = new IntegrityAgentService();
