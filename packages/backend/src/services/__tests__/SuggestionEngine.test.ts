import { describe, it, expect, beforeEach } from 'vitest';
import { suggestionEngine } from '../SuggestionEngine.js';
import type { SuggestionContext } from '../SuggestionEngine.js';

function makeComponent(
  overrides: Partial<{
    id: string;
    type: string;
    props: Record<string, unknown>;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }> = {}
) {
  return {
    id: overrides.id ?? 'comp-1',
    type: overrides.type ?? 'metric-card',
    props: overrides.props ?? {},
    position: overrides.position ?? { x: 0, y: 0 },
    size: overrides.size ?? { width: 200, height: 100 },
  };
}

describe('SuggestionEngine', () => {
  beforeEach(() => {
    suggestionEngine.clearHistory();
  });

  it('suggests a chart when 3+ metric-cards exist and no chart is present', () => {
    const context: SuggestionContext = {
      components: [
        makeComponent({ id: 'm1', type: 'metric-card' }),
        makeComponent({ id: 'm2', type: 'metric-card' }),
        makeComponent({ id: 'm3', type: 'metric-card' }),
      ],
      selectedComponent: null,
      recentChanges: [],
    };

    const suggestions = suggestionEngine.generateSuggestions(context);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].id).toBe('suggest-visualization');
    expect(suggestions[0].agentName).toBe('Visualization Agent');
  });

  it('does not suggest a chart when a chart already exists', () => {
    const context: SuggestionContext = {
      components: [
        makeComponent({ id: 'm1', type: 'metric-card' }),
        makeComponent({ id: 'm2', type: 'metric-card' }),
        makeComponent({ id: 'm3', type: 'metric-card' }),
        makeComponent({ id: 'c1', type: 'interactive-chart' }),
      ],
      selectedComponent: null,
      recentChanges: [],
    };

    const suggestions = suggestionEngine.generateSuggestions(context);
    const vizSuggestion = suggestions.find(s => s.id === 'suggest-visualization');

    expect(vizSuggestion).toBeUndefined();
  });

  it('suggests a narrative when 3+ recent changes exist and no narrative block is present', () => {
    const now = new Date();
    const context: SuggestionContext = {
      components: [makeComponent({ id: 'm1', type: 'metric-card' })],
      selectedComponent: null,
      recentChanges: [
        { componentId: 'a', changeType: 'edit', timestamp: now },
        { componentId: 'b', changeType: 'edit', timestamp: now },
        { componentId: 'c', changeType: 'edit', timestamp: now },
      ],
    };

    const suggestions = suggestionEngine.generateSuggestions(context);
    const narrative = suggestions.find(s => s.id === 'suggest-narrative');

    expect(narrative).toBeDefined();
    expect(narrative!.agentName).toBe('Narrative Agent');
  });

  it('suggests a breakdown when a selected metric-card has a percentage value', () => {
    const selected = makeComponent({
      id: 'pct-1',
      type: 'metric-card',
      props: { value: '42%', title: 'Win Rate' },
      position: { x: 100, y: 50 },
      size: { width: 200, height: 100 },
    });

    const context: SuggestionContext = {
      components: [selected],
      selectedComponent: selected,
      recentChanges: [],
    };

    const suggestions = suggestionEngine.generateSuggestions(context);
    const breakdown = suggestions.find(s => s.id === 'suggest-breakdown-pct-1');

    expect(breakdown).toBeDefined();
    expect(breakdown!.position.x).toBe(320); // 100 + 200 + 20
    expect(breakdown!.position.y).toBe(50);
  });

  it('suggests scenario analysis when 2+ recent calculation changes within 5s', () => {
    const now = new Date();
    const context: SuggestionContext = {
      components: [makeComponent({ id: 'm1' })],
      selectedComponent: null,
      recentChanges: [
        { componentId: 'a', changeType: 'calculation', timestamp: now },
        { componentId: 'b', changeType: 'calculation', timestamp: now },
      ],
    };

    const suggestions = suggestionEngine.generateSuggestions(context);
    const scenario = suggestions.find(s => s.id === 'suggest-scenario');

    expect(scenario).toBeDefined();
    expect(scenario!.priority).toBe('critical');
  });

  it('respects cooldown — returns empty on rapid successive calls', () => {
    const now = new Date();
    const contextA: SuggestionContext = {
      components: [
        makeComponent({ id: 'm1', type: 'metric-card' }),
        makeComponent({ id: 'm2', type: 'metric-card' }),
        makeComponent({ id: 'm3', type: 'metric-card' }),
      ],
      selectedComponent: null,
      recentChanges: [],
    };

    // First call produces suggestions and sets cooldown
    const first = suggestionEngine.generateSuggestions(contextA);
    expect(first.length).toBeGreaterThan(0);

    // Second call with a different trigger — narrative suggestion should qualify
    // but cooldown blocks all suggestions
    const contextB: SuggestionContext = {
      components: [makeComponent({ id: 'x1', type: 'metric-card' })],
      selectedComponent: null,
      recentChanges: [
        { componentId: 'a', changeType: 'edit', timestamp: now },
        { componentId: 'b', changeType: 'edit', timestamp: now },
        { componentId: 'c', changeType: 'edit', timestamp: now },
      ],
    };

    const second = suggestionEngine.generateSuggestions(contextB);
    expect(second).toHaveLength(0);
  });

  it('does not repeat a dismissed suggestion', () => {
    const context: SuggestionContext = {
      components: [
        makeComponent({ id: 'm1', type: 'metric-card' }),
        makeComponent({ id: 'm2', type: 'metric-card' }),
        makeComponent({ id: 'm3', type: 'metric-card' }),
      ],
      selectedComponent: null,
      recentChanges: [],
    };

    suggestionEngine.dismissSuggestion('suggest-visualization');
    const suggestions = suggestionEngine.generateSuggestions(context);
    const viz = suggestions.find(s => s.id === 'suggest-visualization');

    expect(viz).toBeUndefined();
  });

  it('positions suggestions to the right of the rightmost component', () => {
    const context: SuggestionContext = {
      components: [
        makeComponent({ id: 'm1', position: { x: 0, y: 10 }, size: { width: 200, height: 100 } }),
        makeComponent({ id: 'm2', position: { x: 300, y: 20 }, size: { width: 150, height: 100 } }),
        makeComponent({ id: 'm3', type: 'metric-card', position: { x: 100, y: 30 }, size: { width: 200, height: 100 } }),
      ],
      selectedComponent: null,
      recentChanges: [],
    };

    const suggestions = suggestionEngine.generateSuggestions(context);
    const viz = suggestions.find(s => s.id === 'suggest-visualization');

    expect(viz).toBeDefined();
    // Rightmost: x=300 + width=150 + gap=40 = 490
    expect(viz!.position.x).toBe(490);
    expect(viz!.position.y).toBe(20);
  });
});
