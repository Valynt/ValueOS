import { logger } from '../lib/logger';
import { CanvasComponent } from '../types';
import { Suggestion } from '../components/Agent/SuggestionCard';

export interface SuggestionContext {
  components: CanvasComponent[];
  selectedComponent: CanvasComponent | null;
  recentChanges: Array<{ componentId: string; changeType: string; timestamp: Date }>;
}

class SuggestionEngine {
  private suggestionHistory: Set<string> = new Set();
  private lastSuggestionTime: number = 0;
  private readonly SUGGESTION_COOLDOWN_MS = 10000;

  generateSuggestions(context: SuggestionContext): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const now = Date.now();

    if (now - this.lastSuggestionTime < this.SUGGESTION_COOLDOWN_MS) {
      return suggestions;
    }

    const metricCount = context.components.filter(c => c.type === 'metric-card').length;
    const chartCount = context.components.filter(c => c.type === 'interactive-chart').length;
    const narrativeCount = context.components.filter(c => c.type === 'narrative-block').length;

    if (metricCount >= 3 && chartCount === 0) {
      const suggestionId = 'suggest-visualization';
      if (!this.suggestionHistory.has(suggestionId)) {
        suggestions.push({
          id: suggestionId,
          title: 'Visualize your metrics',
          content: 'You have multiple metrics. A chart would help visualize trends and relationships between them.',
          agentName: 'Visualization Agent',
          position: this.calculateOptimalPosition(context.components, { width: 320, height: 200 }),
          priority: 'normal',
          actions: [
            { label: 'Create Chart', action: 'create visualization from metrics' },
            { label: 'Not Now', action: 'dismiss' }
          ]
        });
        this.suggestionHistory.add(suggestionId);
      }
    }

    if (context.recentChanges.length >= 3 && narrativeCount === 0) {
      const suggestionId = 'suggest-narrative';
      if (!this.suggestionHistory.has(suggestionId)) {
        suggestions.push({
          id: suggestionId,
          title: 'Add context to your analysis',
          content: 'Your analysis is taking shape. Consider adding a narrative block to explain key insights to stakeholders.',
          agentName: 'Narrative Agent',
          position: this.calculateOptimalPosition(context.components, { width: 320, height: 150 }),
          priority: 'normal',
          actions: [
            { label: 'Add Narrative', action: 'create executive narrative' },
            { label: 'Dismiss', action: 'dismiss' }
          ]
        });
        this.suggestionHistory.add(suggestionId);
      }
    }

    if (context.selectedComponent?.type === 'metric-card') {
      const value = context.selectedComponent.props.value;
      if (value && typeof value === 'string' && value.includes('%')) {
        const suggestionId = `suggest-breakdown-${context.selectedComponent.id}`;
        if (!this.suggestionHistory.has(suggestionId)) {
          suggestions.push({
            id: suggestionId,
            title: 'Show calculation breakdown',
            content: 'This metric could benefit from a detailed breakdown table showing how this percentage was calculated.',
            agentName: 'Calculation Agent',
            position: {
              x: context.selectedComponent.position.x + context.selectedComponent.size.width + 20,
              y: context.selectedComponent.position.y
            },
            priority: 'normal',
            actions: [
              { label: 'Add Breakdown', action: `create breakdown for ${context.selectedComponent.props.title}` },
              { label: 'Dismiss', action: 'dismiss' }
            ]
          });
          this.suggestionHistory.add(suggestionId);
        }
      }
    }

    const recentCalculationChanges = context.recentChanges.filter(
      c => c.changeType === 'calculation' && (now - c.timestamp.getTime()) < 5000
    );

    if (recentCalculationChanges.length >= 2) {
      const suggestionId = 'suggest-scenario';
      if (!this.suggestionHistory.has(suggestionId)) {
        suggestions.push({
          id: suggestionId,
          title: 'Create scenario analysis',
          content: 'Multiple values are changing. Consider creating best-case and worst-case scenarios to show sensitivity.',
          agentName: 'Scenario Agent',
          position: this.calculateOptimalPosition(context.components, { width: 320, height: 180 }),
          priority: 'critical',
          actions: [
            { label: 'Create Scenarios', action: 'create scenario comparison' },
            { label: 'Later', action: 'dismiss' }
          ]
        });
        this.suggestionHistory.add(suggestionId);
      }
    }

    if (suggestions.length > 0) {
      this.lastSuggestionTime = now;
    }

    return suggestions;
  }

  private calculateOptimalPosition(
    components: CanvasComponent[],
    suggestionSize: { width: number; height: number }
  ): { x: number; y: number } {
    if (components.length === 0) {
      return { x: 100, y: 100 };
    }

    const rightmostComponent = components.reduce((max, comp) =>
      comp.position.x + comp.size.width > max.position.x + max.size.width ? comp : max
    );

    const x = rightmostComponent.position.x + rightmostComponent.size.width + 40;
    const y = rightmostComponent.position.y;

    return { x, y };
  }

  dismissSuggestion(suggestionId: string) {
    this.suggestionHistory.add(suggestionId);
  }

  clearHistory() {
    this.suggestionHistory.clear();
    this.lastSuggestionTime = 0;
  }

  canShowSuggestion(suggestionId: string): boolean {
    return !this.suggestionHistory.has(suggestionId);
  }
}

export const suggestionEngine = new SuggestionEngine();
