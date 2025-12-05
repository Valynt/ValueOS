import { logger } from '../lib/logger';
import { CanvasComponent } from '../types';
import { createCurrencyBinding, createPercentageBinding, createMetricBinding } from '../sdui/DataBindingSchema';

export interface ComponentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'metrics' | 'charts' | 'tables' | 'narratives' | 'composite';
  thumbnail?: string;
  components: Omit<CanvasComponent, 'id' | 'position'>[];
  tags: string[];
}

class TemplateLibrary {
  private templates: ComponentTemplate[] = [];

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates() {
    this.templates = [
      {
        id: 'roi-dashboard',
        name: 'ROI Dashboard',
        description: 'Complete ROI analysis with metrics, breakdown, and timeline',
        category: 'composite',
        tags: ['roi', 'finance', 'analysis'],
        components: [
          {
            type: 'metric-card',
            size: { width: 280, height: 120 },
            props: {
              title: 'Total ROI',
              value: '245%',
              trend: 'up',
              change: '+12% vs baseline'
            }
          },
          {
            type: 'metric-card',
            size: { width: 280, height: 120 },
            props: {
              title: 'Payback Period',
              value: '14 Months',
              trend: 'neutral',
              change: 'Within target'
            }
          },
          {
            type: 'interactive-chart',
            size: { width: 580, height: 300 },
            props: {
              title: 'ROI Timeline',
              type: 'line',
              data: [
                { name: 'Q1', value: 50, id: 'q1', color: '#3b82f6' },
                { name: 'Q2', value: 120, id: 'q2', color: '#3b82f6' },
                { name: 'Q3', value: 180, id: 'q3', color: '#3b82f6' },
                { name: 'Q4', value: 245, id: 'q4', color: '#3b82f6' }
              ],
              config: { showValue: true, showLegend: false }
            }
          }
        ]
      },
      {
        id: 'realization-dashboard-live',
        name: 'Realization Dashboard (Live)',
        description: 'Live realization metrics with dynamic data bindings - always shows latest data',
        category: 'composite',
        tags: ['realization', 'live', 'metrics', 'feedback-loops'],
        components: [
          {
            type: 'metric-card',
            size: { width: 280, height: 120 },
            props: {
              title: 'Revenue Uplift',
              value: createCurrencyBinding('metrics.revenue_uplift', 'realization_engine', {
                $fallback: 'Calculating...',
                $refresh: 30000,
              }),
              trend: 'up',
              icon: 'dollar-sign'
            }
          },
          {
            type: 'metric-card',
            size: { width: 280, height: 120 },
            props: {
              title: 'Active Feedback Loops',
              value: createMetricBinding('loops.filter(realization_stage=active).length', {
                $fallback: 0,
                $refresh: 30000,
              }),
              trend: 'neutral',
              icon: 'activity'
            }
          },
          {
            type: 'metric-card',
            size: { width: 280, height: 120 },
            props: {
              title: 'Loop Strength',
              value: {
                $bind: 'loops[0].loop_strength',
                $source: 'realization_engine',
                $fallback: 'Unknown',
                $refresh: 30000,
              },
              trend: 'up',
              icon: 'trending-up'
            }
          },
          {
            type: 'metric-card',
            size: { width: 280, height: 120 },
            props: {
              title: 'Behavior Changes',
              value: createMetricBinding('behavior_changes.length', {
                $fallback: 0,
                $refresh: 60000,
              }),
              trend: 'up',
              icon: 'users'
            }
          },
          {
            type: 'data-table',
            size: { width: 600, height: 300 },
            props: {
              title: 'Recent Behavior Changes',
              headers: ['Entity', 'Change', 'Evidence', 'Time'],
              rows: {
                $bind: 'behavior_changes',
                $source: 'realization_engine',
                $params: { limit: 5 },
                $fallback: [],
                $refresh: 60000,
              }
            }
          }
        ]
      },
      {
        id: 'cost-breakdown',
        name: 'Cost Breakdown',
        description: 'Detailed cost analysis with pie chart and table',
        category: 'composite',
        tags: ['cost', 'finance', 'breakdown'],
        components: [
          {
            type: 'interactive-chart',
            size: { width: 450, height: 300 },
            props: {
              title: 'Cost Breakdown',
              type: 'pie',
              data: [
                { name: 'Software', value: 120000, id: 'software', color: '#3b82f6' },
                { name: 'Implementation', value: 75000, id: 'implementation', color: '#10b981' },
                { name: 'Training', value: 25000, id: 'training', color: '#f59e0b' },
                { name: 'Support', value: 35000, id: 'support', color: '#ef4444' }
              ],
              config: { showValue: true, showLegend: true }
            }
          },
          {
            type: 'data-table',
            size: { width: 500, height: 250 },
            props: {
              title: 'Cost Details',
              headers: ['Category', 'Amount', 'Percentage'],
              rows: [
                ['Software', '$120,000', '47%'],
                ['Implementation', '$75,000', '29%'],
                ['Training', '$25,000', '10%'],
                ['Support', '$35,000', '14%']
              ],
              editableColumns: []
            }
          }
        ]
      },
      {
        id: 'kpi-grid',
        name: 'KPI Grid',
        description: 'Four key performance indicators in a grid layout',
        category: 'metrics',
        tags: ['kpi', 'metrics', 'dashboard'],
        components: [
          {
            type: 'metric-card',
            size: { width: 280, height: 120 },
            props: {
              title: 'Revenue',
              value: '$2.4M',
              trend: 'up',
              change: '+18%'
            }
          },
          {
            type: 'metric-card',
            size: { width: 280, height: 120 },
            props: {
              title: 'Users',
              value: '15,234',
              trend: 'up',
              change: '+23%'
            }
          },
          {
            type: 'metric-card',
            size: { width: 280, height: 120 },
            props: {
              title: 'Conversion',
              value: '3.2%',
              trend: 'down',
              change: '-0.4%'
            }
          },
          {
            type: 'metric-card',
            size: { width: 280, height: 120 },
            props: {
              title: 'Retention',
              value: '92%',
              trend: 'up',
              change: '+5%'
            }
          }
        ]
      },
      {
        id: 'scenario-comparison',
        name: 'Scenario Comparison',
        description: 'Compare best, likely, and worst case scenarios',
        category: 'charts',
        tags: ['scenario', 'comparison', 'analysis'],
        components: [
          {
            type: 'interactive-chart',
            size: { width: 600, height: 350 },
            props: {
              title: 'Scenario Analysis',
              type: 'bar',
              data: [
                { name: 'Conservative', value: 180, id: 'conservative', color: '#ef4444' },
                { name: 'Likely', value: 245, id: 'likely', color: '#3b82f6' },
                { name: 'Optimistic', value: 320, id: 'optimistic', color: '#10b981' }
              ],
              config: { showValue: true, showLegend: true }
            }
          },
          {
            type: 'narrative-block',
            size: { width: 600, height: 180 },
            props: {
              title: 'Scenario Context',
              content: 'Our analysis shows three potential outcomes based on market conditions and adoption rates. The likely scenario assumes 75% user adoption with moderate market growth.',
              style: 'default'
            }
          }
        ]
      },
      {
        id: 'assumptions-table',
        name: 'Assumptions Table',
        description: 'Key assumptions with sources and confidence levels',
        category: 'tables',
        tags: ['assumptions', 'data', 'validation'],
        components: [
          {
            type: 'data-table',
            size: { width: 700, height: 280 },
            props: {
              title: 'Key Assumptions',
              headers: ['Assumption', 'Value', 'Source', 'Confidence'],
              rows: [
                ['User Adoption', '85%', 'Industry Benchmark', 'High'],
                ['Efficiency Gain', '15%', 'Vendor Claims', 'Medium'],
                ['Implementation Time', '3 months', 'Historical Data', 'High'],
                ['Annual Growth', '12%', 'Market Analysis', 'Medium']
              ],
              editableColumns: [1]
            }
          }
        ]
      }
    ];
  }

  getAllTemplates(): ComponentTemplate[] {
    return this.templates;
  }

  getTemplatesByCategory(category: ComponentTemplate['category']): ComponentTemplate[] {
    return this.templates.filter(t => t.category === category);
  }

  getTemplateById(id: string): ComponentTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  searchTemplates(query: string): ComponentTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.templates.filter(
      t =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  instantiateTemplate(templateId: string, startPosition: { x: number; y: number }): CanvasComponent[] {
    const template = this.getTemplateById(templateId);
    if (!template) return [];

    let currentX = startPosition.x;
    let currentY = startPosition.y;
    const spacing = 20;

    return template.components.map((comp, index) => {
      const component: CanvasComponent = {
        ...comp,
        id: crypto.randomUUID(),
        position: { x: currentX, y: currentY }
      };

      if (index < template.components.length - 1) {
        const nextComp = template.components[index + 1];
        if (comp.type === nextComp.type) {
          currentX += comp.size.width + spacing;
        } else {
          currentX = startPosition.x;
          currentY += comp.size.height + spacing;
        }
      }

      return component;
    });
  }
}

export const templateLibrary = new TemplateLibrary();
