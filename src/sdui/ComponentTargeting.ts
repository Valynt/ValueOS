/**
 * Component Targeting System
 * 
 * Intelligent component identification and selection for atomic mutations.
 * Supports fuzzy matching, natural language descriptions, and semantic search.
 */

import { SDUIPageDefinition, SDUIComponentSection } from './schema';
import { ComponentSelector } from './AtomicUIActions';
import { logger } from '../lib/logger';

/**
 * Component match result
 */
export interface ComponentMatch {
  /**
   * Matched component section
   */
  section: SDUIComponentSection;

  /**
   * Index in sections array
   */
  index: number;

  /**
   * Match confidence (0-1)
   */
  confidence: number;

  /**
   * Reason for match
   */
  reason: string;
}

/**
 * Component Targeting Service
 */
export class ComponentTargeting {
  /**
   * Find components matching selector
   */
  findComponents(
    layout: SDUIPageDefinition,
    selector: ComponentSelector
  ): ComponentMatch[] {
    const matches: ComponentMatch[] = [];

    for (let i = 0; i < layout.sections.length; i++) {
      const section = layout.sections[i];
      const match = this.matchComponent(section, i, selector);

      if (match) {
        matches.push(match);
      }
    }

    // Sort by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);

    return matches;
  }

  /**
   * Find single best matching component
   */
  findBestMatch(
    layout: SDUIPageDefinition,
    selector: ComponentSelector
  ): ComponentMatch | null {
    const matches = this.findComponents(layout, selector);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Match a component against selector
   */
  private matchComponent(
    section: SDUIComponentSection,
    index: number,
    selector: ComponentSelector
  ): ComponentMatch | null {
    let confidence = 0;
    const reasons: string[] = [];

    // ID match (exact, highest priority)
    if (selector.id) {
      const componentId = this.getComponentId(section, index);
      if (componentId === selector.id) {
        return {
          section,
          index,
          confidence: 1.0,
          reason: 'Exact ID match',
        };
      }
      // ID specified but doesn't match - no match
      return null;
    }

    // Index match (exact)
    if (selector.index !== undefined) {
      if (index === selector.index) {
        confidence += 0.9;
        reasons.push('Index match');
      } else {
        // Index specified but doesn't match - no match
        return null;
      }
    }

    // Type match (exact)
    if (selector.type) {
      if (section.component === selector.type) {
        confidence += 0.8;
        reasons.push('Type match');
      } else {
        // Type specified but doesn't match - no match
        return null;
      }
    }

    // Props match (partial)
    if (selector.props) {
      const propsMatch = this.matchProps(section.props, selector.props);
      if (propsMatch.matches) {
        confidence += 0.7 * propsMatch.score;
        reasons.push(`Props match (${Math.round(propsMatch.score * 100)}%)`);
      } else {
        // Props specified but don't match - no match
        return null;
      }
    }

    // Description match (fuzzy)
    if (selector.description) {
      const descMatch = this.matchDescription(section, selector.description);
      if (descMatch.matches) {
        confidence += 0.6 * descMatch.score;
        reasons.push(`Description match (${Math.round(descMatch.score * 100)}%)`);
      }
      // Description is fuzzy, so we don't exclude on mismatch
    }

    // Normalize confidence
    if (confidence > 0) {
      // Adjust confidence based on number of criteria
      const criteriaCount = [
        selector.index !== undefined,
        selector.type,
        selector.props,
        selector.description,
      ].filter(Boolean).length;

      confidence = confidence / criteriaCount;

      return {
        section,
        index,
        confidence: Math.min(confidence, 1.0),
        reason: reasons.join(', '),
      };
    }

    return null;
  }

  /**
   * Match component props against selector props
   */
  private matchProps(
    componentProps: Record<string, any>,
    selectorProps: Record<string, any>
  ): { matches: boolean; score: number } {
    const selectorKeys = Object.keys(selectorProps);
    if (selectorKeys.length === 0) {
      return { matches: true, score: 1.0 };
    }

    let matchedKeys = 0;

    for (const key of selectorKeys) {
      const componentValue = componentProps[key];
      const selectorValue = selectorProps[key];

      if (this.valuesMatch(componentValue, selectorValue)) {
        matchedKeys++;
      }
    }

    const score = matchedKeys / selectorKeys.length;
    return {
      matches: score > 0.5, // At least 50% of props must match
      score,
    };
  }

  /**
   * Check if two values match
   */
  private valuesMatch(a: any, b: any): boolean {
    // Exact match
    if (a === b) return true;

    // String comparison (case-insensitive)
    if (typeof a === 'string' && typeof b === 'string') {
      return a.toLowerCase() === b.toLowerCase();
    }

    // Deep equality for objects/arrays
    if (typeof a === 'object' && typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    return false;
  }

  /**
   * Match component against natural language description
   */
  private matchDescription(
    section: SDUIComponentSection,
    description: string
  ): { matches: boolean; score: number } {
    const descLower = description.toLowerCase();
    const tokens = descLower.split(/\s+/);

    let matchScore = 0;
    const maxScore = tokens.length;

    // Check component name
    const componentName = section.component.toLowerCase();
    for (const token of tokens) {
      if (componentName.includes(token)) {
        matchScore += 1;
      }
    }

    // Check props
    const propsStr = JSON.stringify(section.props).toLowerCase();
    for (const token of tokens) {
      if (propsStr.includes(token)) {
        matchScore += 0.5;
      }
    }

    // Check common aliases
    const aliases = this.getComponentAliases(section.component);
    for (const alias of aliases) {
      if (descLower.includes(alias.toLowerCase())) {
        matchScore += 1;
      }
    }

    const score = Math.min(matchScore / maxScore, 1.0);

    return {
      matches: score > 0.3, // At least 30% match
      score,
    };
  }

  /**
   * Get common aliases for component types
   */
  private getComponentAliases(componentType: string): string[] {
    const aliasMap: Record<string, string[]> = {
      StatCard: ['metric', 'stat', 'kpi', 'card', 'number'],
      InteractiveChart: ['chart', 'graph', 'visualization', 'plot'],
      DataTable: ['table', 'grid', 'list'],
      PageHeader: ['header', 'title', 'heading'],
      Card: ['card', 'panel', 'box'],
      Grid: ['grid', 'layout'],
      Stack: ['stack', 'column'],
      Tabs: ['tabs', 'tabbed'],
      Alert: ['alert', 'message', 'notification'],
    };

    return aliasMap[componentType] || [];
  }

  /**
   * Get component ID
   */
  private getComponentId(section: SDUIComponentSection, index: number): string {
    // Use component name + index as ID
    return `${section.component}_${index}`;
  }

  /**
   * Generate selector from natural language
   */
  generateSelector(description: string): ComponentSelector {
    const descLower = description.toLowerCase();

    // Extract component type
    let type: string | undefined;
    const typePatterns = [
      { pattern: /chart|graph/, type: 'InteractiveChart' },
      { pattern: /metric|stat|kpi/, type: 'StatCard' },
      { pattern: /table|grid/, type: 'DataTable' },
      { pattern: /card/, type: 'Card' },
      { pattern: /header|title/, type: 'PageHeader' },
    ];

    for (const { pattern, type: componentType } of typePatterns) {
      if (pattern.test(descLower)) {
        type = componentType;
        break;
      }
    }

    // Extract index
    let index: number | undefined;
    const indexPatterns = [
      /first/i,
      /second/i,
      /third/i,
      /fourth/i,
      /fifth/i,
    ];

    for (let i = 0; i < indexPatterns.length; i++) {
      if (indexPatterns[i].test(descLower)) {
        index = i;
        break;
      }
    }

    // Extract numeric index
    const numMatch = descLower.match(/(\d+)(st|nd|rd|th)?/);
    if (numMatch) {
      index = parseInt(numMatch[1], 10) - 1; // Convert to 0-based
    }

    return {
      type,
      index,
      description,
    };
  }

  /**
   * Explain why a component matched
   */
  explainMatch(match: ComponentMatch): string {
    return `Matched ${match.section.component} at index ${match.index} with ${Math.round(match.confidence * 100)}% confidence (${match.reason})`;
  }

  /**
   * Get all components of a specific type
   */
  getComponentsByType(
    layout: SDUIPageDefinition,
    type: string
  ): ComponentMatch[] {
    return this.findComponents(layout, { type });
  }

  /**
   * Get component at specific index
   */
  getComponentAtIndex(
    layout: SDUIPageDefinition,
    index: number
  ): ComponentMatch | null {
    if (index < 0 || index >= layout.sections.length) {
      return null;
    }

    const section = layout.sections[index];
    return {
      section,
      index,
      confidence: 1.0,
      reason: 'Direct index access',
    };
  }

  /**
   * Find components with specific prop value
   */
  findComponentsByProp(
    layout: SDUIPageDefinition,
    propPath: string,
    value: any
  ): ComponentMatch[] {
    const matches: ComponentMatch[] = [];

    for (let i = 0; i < layout.sections.length; i++) {
      const section = layout.sections[i];
      const propValue = this.getNestedProp(section.props, propPath);

      if (this.valuesMatch(propValue, value)) {
        matches.push({
          section,
          index: i,
          confidence: 0.9,
          reason: `Prop ${propPath} matches ${value}`,
        });
      }
    }

    return matches;
  }

  /**
   * Get nested property value
   */
  private getNestedProp(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }
}

// Singleton instance
let targetingInstance: ComponentTargeting | null = null;

export function getComponentTargeting(): ComponentTargeting {
  if (!targetingInstance) {
    targetingInstance = new ComponentTargeting();
  }
  return targetingInstance;
}

export default ComponentTargeting;
