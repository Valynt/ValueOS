import { logger } from '../lib/logger';
import { CanvasComponent } from '../types';

export interface CalculationDependency {
  sourceId: string;
  targetId: string;
  formula: string;
}

export interface CalculationUpdate {
  componentId: string;
  oldValue: any;
  newValue: any;
  formula?: string;
}

class CalculationEngine {
  private dependencies: Map<string, string[]> = new Map();
  private formulas: Map<string, (components: Map<string, CanvasComponent>) => any> = new Map();

  registerDependency(targetId: string, sourceIds: string[], formula: (components: Map<string, CanvasComponent>) => any) {
    this.dependencies.set(targetId, sourceIds);
    this.formulas.set(targetId, formula);
  }

  getDependents(componentId: string): string[] {
    const dependents: string[] = [];

    this.dependencies.forEach((sources, targetId) => {
      if (sources.includes(componentId)) {
        dependents.push(targetId);
      }
    });

    return dependents;
  }

  calculateCascade(
    changedComponentId: string,
    components: CanvasComponent[]
  ): CalculationUpdate[] {
    const updates: CalculationUpdate[] = [];
    const processed = new Set<string>();
    const queue = [changedComponentId];

    const componentMap = new Map(components.map(c => [c.id, c]));

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (processed.has(currentId)) continue;
      processed.add(currentId);

      const dependents = this.getDependents(currentId);

      for (const dependentId of dependents) {
        const formula = this.formulas.get(dependentId);
        if (!formula) continue;

        const component = componentMap.get(dependentId);
        if (!component) continue;

        const oldValue = component.props.value;
        const newValue = formula(componentMap);

        if (oldValue !== newValue) {
          updates.push({
            componentId: dependentId,
            oldValue,
            newValue,
            formula: this.getFormulaDescription(dependentId)
          });

          componentMap.set(dependentId, {
            ...component,
            props: { ...component.props, value: newValue }
          });

          queue.push(dependentId);
        }
      }
    }

    return updates;
  }

  getFormulaDescription(componentId: string): string {
    const sources = this.dependencies.get(componentId);
    if (!sources || sources.length === 0) {
      return 'Calculated value';
    }

    return `Depends on ${sources.length} component${sources.length > 1 ? 's' : ''}`;
  }

  setupDefaultDependencies() {
    this.registerDependency(
      'roi-metric',
      ['revenue-metric', 'cost-metric'],
      (components) => {
        const revenue = parseFloat(String(components.get('revenue-metric')?.props.value || '0').replace(/[^0-9.-]/g, ''));
        const cost = parseFloat(String(components.get('cost-metric')?.props.value || '0').replace(/[^0-9.-]/g, ''));

        if (cost === 0) return 'N/A';
        const roi = ((revenue - cost) / cost) * 100;
        return `${roi.toFixed(1)}%`;
      }
    );

    this.registerDependency(
      'payback-metric',
      ['revenue-metric', 'cost-metric'],
      (components) => {
        const monthlyRevenue = parseFloat(String(components.get('revenue-metric')?.props.value || '0').replace(/[^0-9.-]/g, '')) / 12;
        const totalCost = parseFloat(String(components.get('cost-metric')?.props.value || '0').replace(/[^0-9.-]/g, ''));

        if (monthlyRevenue === 0) return 'N/A';
        const months = Math.ceil(totalCost / monthlyRevenue);
        return `${months} months`;
      }
    );
  }

  clearDependencies() {
    this.dependencies.clear();
    this.formulas.clear();
  }
}

export const calculationEngine = new CalculationEngine();
