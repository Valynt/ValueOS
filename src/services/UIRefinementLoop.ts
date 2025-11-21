/**
 * UI Refinement Loop
 * 
 * Implements the Evaluator-Optimizer pattern for iterative UI improvement.
 * Evaluates generated UIs and refines them based on feedback.
 */

import { LLMGateway } from '../lib/agent-fabric/LLMGateway';
import { getUIGenerationTracker } from './UIGenerationTracker';
import { validateComponentSelection } from '../sdui/ComponentToolRegistry';
import type { SDUIPageDefinition } from '../sdui/types';
import type { Subgoal } from '../types/Subgoal';

export interface UIEvaluationResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  component_issues: Array<{
    component: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  layout_issues: Array<{
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export interface RefinementResult {
  layout: SDUIPageDefinition;
  iterations: number;
  final_score: number;
  improvement_history: Array<{
    iteration: number;
    score: number;
    changes_made: string[];
  }>;
}

export class UIRefinementLoop {
  private llmGateway: LLMGateway;
  private tracker: ReturnType<typeof getUIGenerationTracker>;
  private config: {
    maxIterations: number;
    targetScore: number;
    minImprovement: number;
  };

  constructor() {
    this.llmGateway = new LLMGateway('together', true);
    this.tracker = getUIGenerationTracker();
    this.config = {
      maxIterations: 3,
      targetScore: 85,
      minImprovement: 5,
    };
  }

  /**
   * Generate and refine UI layout iteratively
   */
  async generateAndRefine(
    subgoal: Subgoal,
    initialLayout: SDUIPageDefinition
  ): Promise<RefinementResult> {
    let currentLayout = initialLayout;
    let currentScore = await this.evaluateLayout(currentLayout, subgoal);
    const improvementHistory: RefinementResult['improvement_history'] = [];

    let iteration = 0;

    while (
      iteration < this.config.maxIterations &&
      currentScore.score < this.config.targetScore
    ) {
      iteration++;

      // Evaluate current layout
      const evaluation = await this.evaluateLayout(currentLayout, subgoal);

      // Check if we should continue
      if (evaluation.score >= this.config.targetScore) {
        break;
      }

      // If this is not the first iteration, check for improvement
      if (iteration > 1) {
        const improvement = evaluation.score - currentScore.score;
        if (improvement < this.config.minImprovement) {
          // Not improving enough, stop
          break;
        }
      }

      // Generate refinement
      const refinedLayout = await this.refineLayout(
        currentLayout,
        evaluation,
        subgoal
      );

      // Track changes
      const changesMade = this.identifyChanges(currentLayout, refinedLayout);

      improvementHistory.push({
        iteration,
        score: evaluation.score,
        changes_made: changesMade,
      });

      currentLayout = refinedLayout;
      currentScore = evaluation;
    }

    // Final evaluation
    const finalEvaluation = await this.evaluateLayout(currentLayout, subgoal);

    return {
      layout: currentLayout,
      iterations: iteration,
      final_score: finalEvaluation.score,
      improvement_history: improvementHistory,
    };
  }

  /**
   * Evaluate a UI layout
   */
  async evaluateLayout(
    layout: SDUIPageDefinition,
    subgoal: Subgoal
  ): Promise<UIEvaluationResult> {
    const messages = [
      {
        role: 'system' as const,
        content: `You are a UI/UX expert evaluating interface designs. Evaluate the UI layout and provide:
1. Overall score (0-100)
2. Strengths (what works well)
3. Weaknesses (what needs improvement)
4. Specific suggestions for improvement
5. Component-specific issues
6. Layout issues

Output valid JSON matching this structure:
{
  "score": number,
  "strengths": string[],
  "weaknesses": string[],
  "suggestions": string[],
  "component_issues": [{"component": string, "issue": string, "severity": "low"|"medium"|"high"}],
  "layout_issues": [{"issue": string, "severity": "low"|"medium"|"high"}]
}`,
      },
      {
        role: 'user' as const,
        content: `Evaluate this UI layout:

Task: ${subgoal.description}
Task Type: ${subgoal.subgoal_type}

Layout:
${JSON.stringify(layout, null, 2)}

Data to Display:
${JSON.stringify(subgoal.output, null, 2)}

Evaluate the layout's effectiveness for this task.`,
      },
    ];

    const response = await this.llmGateway.complete(
      messages,
      { use_gating: true, temperature: 0.3 },
      { task_type: 'ui_evaluation', complexity: 0.4 }
    );

    // Parse response
    let evaluation: UIEvaluationResult;
    try {
      let jsonContent = response.content.trim();
      if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
      }
      evaluation = JSON.parse(jsonContent);
    } catch (error) {
      // Fallback evaluation
      evaluation = {
        score: 50,
        strengths: ['Layout is functional'],
        weaknesses: ['Could not parse detailed evaluation'],
        suggestions: ['Review layout manually'],
        component_issues: [],
        layout_issues: [],
      };
    }

    return evaluation;
  }

  /**
   * Refine a UI layout based on evaluation feedback
   */
  async refineLayout(
    currentLayout: SDUIPageDefinition,
    evaluation: UIEvaluationResult,
    subgoal: Subgoal
  ): Promise<SDUIPageDefinition> {
    const messages = [
      {
        role: 'system' as const,
        content: `You are a UI designer improving interface layouts. Given a layout and evaluation feedback, generate an improved version.

Output valid JSON matching the SDUI schema:
{
  "type": "page",
  "version": 1,
  "sections": [...],
  "metadata": {...}
}

Focus on addressing the weaknesses and implementing the suggestions.`,
      },
      {
        role: 'user' as const,
        content: `Improve this UI layout:

Current Layout:
${JSON.stringify(currentLayout, null, 2)}

Evaluation Feedback:
Score: ${evaluation.score}/100

Weaknesses:
${evaluation.weaknesses.map((w) => `- ${w}`).join('\n')}

Suggestions:
${evaluation.suggestions.map((s) => `- ${s}`).join('\n')}

Component Issues:
${evaluation.component_issues.map((i) => `- ${i.component}: ${i.issue} (${i.severity})`).join('\n')}

Layout Issues:
${evaluation.layout_issues.map((i) => `- ${i.issue} (${i.severity})`).join('\n')}

Generate an improved layout that addresses these issues.`,
      },
    ];

    const response = await this.llmGateway.complete(
      messages,
      { use_gating: true, temperature: 0.4 },
      { task_type: 'ui_refinement', complexity: 0.6 }
    );

    // Parse response
    let refinedLayout: SDUIPageDefinition;
    try {
      let jsonContent = response.content.trim();
      if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
      }
      refinedLayout = JSON.parse(jsonContent);
    } catch (error) {
      // If parsing fails, return current layout
      console.error('Failed to parse refined layout:', error);
      return currentLayout;
    }

    // Validate refined layout
    const validation = this.validateLayout(refinedLayout);
    if (!validation.valid) {
      console.warn('Refined layout validation failed:', validation.errors);
      return currentLayout;
    }

    return refinedLayout;
  }

  /**
   * Identify changes between two layouts
   */
  private identifyChanges(
    oldLayout: SDUIPageDefinition,
    newLayout: SDUIPageDefinition
  ): string[] {
    const changes: string[] = [];

    // Compare number of sections
    if (oldLayout.sections.length !== newLayout.sections.length) {
      changes.push(
        `Section count changed from ${oldLayout.sections.length} to ${newLayout.sections.length}`
      );
    }

    // Compare components
    const oldComponents = oldLayout.sections.map((s) => s.component);
    const newComponents = newLayout.sections.map((s) => s.component);

    const added = newComponents.filter((c) => !oldComponents.includes(c));
    const removed = oldComponents.filter((c) => !newComponents.includes(c));

    if (added.length > 0) {
      changes.push(`Added components: ${added.join(', ')}`);
    }

    if (removed.length > 0) {
      changes.push(`Removed components: ${removed.join(', ')}`);
    }

    // Compare layouts
    const oldLayouts = oldLayout.sections
      .filter((s) => s.type === 'layout.directive')
      .map((s) => s.layout);
    const newLayouts = newLayout.sections
      .filter((s) => s.type === 'layout.directive')
      .map((s) => s.layout);

    if (JSON.stringify(oldLayouts) !== JSON.stringify(newLayouts)) {
      changes.push('Layout configuration changed');
    }

    if (changes.length === 0) {
      changes.push('Minor prop adjustments');
    }

    return changes;
  }

  /**
   * Validate layout structure
   */
  private validateLayout(layout: any): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!layout || typeof layout !== 'object') {
      errors.push('Layout must be an object');
      return { valid: false, errors };
    }

    if (layout.type !== 'page') {
      errors.push('Layout type must be "page"');
    }

    if (!Array.isArray(layout.sections)) {
      errors.push('Layout must have sections array');
    } else if (layout.sections.length === 0) {
      errors.push('Layout must have at least one section');
    } else {
      // Validate each section
      for (const section of layout.sections) {
        if (!section.component) {
          errors.push('Section missing component name');
        } else {
          const validation = validateComponentSelection(
            section.component,
            section.props || {}
          );
          errors.push(...validation.errors);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Set refinement configuration
   */
  setConfig(config: Partial<UIRefinementLoop['config']>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): UIRefinementLoop['config'] {
    return { ...this.config };
  }
}

// Singleton instance
let refinementLoopInstance: UIRefinementLoop | null = null;

export function getUIRefinementLoop(): UIRefinementLoop {
  if (!refinementLoopInstance) {
    refinementLoopInstance = new UIRefinementLoop();
  }
  return refinementLoopInstance;
}

export default UIRefinementLoop;
