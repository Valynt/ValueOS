/**
 * JSON Layout Definition Tests
 * Tests agent-sent JSON layouts with various component combinations
 */

 

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from '../renderPage';
import { SDUIPageDefinition, SDUIValidationError } from '../schema';

// Mock components
vi.mock('../../components/SDUI', () => ({
  InfoBanner: ({ title, message }: any) => (
    <div data-testid="info-banner">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  ),
  DataTable: ({ data, columns }: any) => (
    <table data-testid="data-table">
      <thead>
        <tr>
          {columns.map((col: any) => (
            <th key={col.key}>{col.title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row: any, i: number) => (
          <tr key={i}>
            {columns.map((col: any) => (
              <td key={col.key}>{row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  MetricBadge: ({ label, value }: any) => (
    <div data-testid="metric-badge">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  ),
}));

vi.mock('../../components/SDUI/CanvasLayout', () => ({
  VerticalSplit: ({ ratios, children }: any) => (
    <div data-testid="vertical-split" data-ratios={JSON.stringify(ratios)}>
      {children}
    </div>
  ),
  Grid: ({ columns, children }: any) => (
    <div data-testid="grid" data-columns={columns}>
      {children}
    </div>
  ),
}));

describe('JSON Layout Definitions - Agent Generated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Layout Structures', () => {
    it('should render simple dashboard layout from agent JSON', () => {
      const agentLayout: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: {
              title: 'Dashboard Overview',
              message: 'Welcome to your value realization dashboard',
            },
          },
          {
            type: 'component',
            component: 'DataTable',
            version: 1,
            props: {
              data: [
                { metric: 'Revenue', value: '$1.2M', change: '+15%' },
                { metric: 'Users', value: '45K', change: '+8%' },
              ],
              columns: [
                { key: 'metric', title: 'Metric' },
                { key: 'value', title: 'Value' },
                { key: 'change', title: 'Change' },
              ],
            },
          },
        ],
        metadata: {
          generated_at: Date.now(),
          agent_name: 'DashboardAgent',
          experienceId: 'dashboard-001',
          theme: 'dark',
        },
      };

      const result = renderPage(agentLayout);

      expect(result.element).toBeDefined();
      expect(result.warnings).toEqual([]);
      expect(result.metadata.componentCount).toBe(2);
    });

    it('should render complex grid layout with multiple components', () => {
      const complexLayout: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'Grid',
            version: 1,
            props: {
              columns: 3,
            },
          },
          {
            type: 'component',
            component: 'MetricBadge',
            version: 1,
            props: { label: 'Revenue', value: '$1.2M' },
          },
          {
            type: 'component',
            component: 'MetricBadge',
            version: 1,
            props: { label: 'Users', value: '45K' },
          },
          {
            type: 'component',
            component: 'MetricBadge',
            version: 1,
            props: { label: 'Conversion', value: '3.2%' },
          },
        ],
      };

      const result = renderPage(complexLayout);

      expect(result.element).toBeDefined();
      expect(result.metadata.componentCount).toBe(4); // Grid + 3 MetricBadges
    });

    it('should render vertical split layout for comparison views', () => {
      const splitLayout: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'VerticalSplit',
            version: 1,
            props: {
              ratios: [1, 2],
            },
          },
          {
            type: 'component',
            component: 'DataTable',
            version: 1,
            props: {
              data: [{ name: 'Q1', value: 100 }],
              columns: [
                { key: 'name', title: 'Quarter' },
                { key: 'value', title: 'Value' },
              ],
            },
          },
          {
            type: 'component',
            component: 'DataTable',
            version: 1,
            props: {
              data: [
                { name: 'Q1', value: 100 },
                { name: 'Q2', value: 120 },
                { name: 'Q3', value: 140 },
              ],
              columns: [
                { key: 'name', title: 'Quarter' },
                { key: 'value', title: 'Value' },
              ],
            },
          },
        ],
      };

      const result = renderPage(splitLayout);

      expect(result.element).toBeDefined();
      expect(result.metadata.componentCount).toBe(3); // VerticalSplit + 2 DataTables
    });
  });

  describe('Agent-Specific Layouts', () => {
    it('should render financial analysis layout from FinanceAgent', () => {
      const financeLayout: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: {
              title: 'Financial Analysis',
              message: 'NPV and ROI calculations for expansion opportunity',
            },
          },
          {
            type: 'component',
            component: 'DataTable',
            version: 1,
            props: {
              data: [
                { scenario: 'Base Case', npv: '$2.1M', irr: '18%', payback: '3.2 years' },
                { scenario: 'Optimistic', npv: '$3.8M', irr: '24%', payback: '2.8 years' },
                { scenario: 'Conservative', npv: '$1.2M', irr: '12%', payback: '4.1 years' },
              ],
              columns: [
                { key: 'scenario', title: 'Scenario' },
                { key: 'npv', title: 'NPV' },
                { key: 'irr', title: 'IRR' },
                { key: 'payback', title: 'Payback Period' },
              ],
            },
          },
        ],
        metadata: {
          agent_name: 'FinancialModelingAgent',
          lifecycle_stage: 'expansion',
          confidence_score: 0.87,
          theme: 'dark',
        },
      };

      const result = renderPage(financeLayout);

      expect(result.element).toBeDefined();
      expect(result.metadata.componentCount).toBe(2);
    });

    it('should render opportunity discovery layout from DiscoveryAgent', () => {
      const discoveryLayout: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: {
              title: 'Opportunity Identified',
              message: 'High-potential value creation opportunity discovered',
            },
          },
          {
            type: 'component',
            component: 'Grid',
            version: 1,
            props: { columns: 2 },
            children: [
              {
                type: 'component',
                component: 'MetricBadge',
                version: 1,
                props: { label: 'Potential Value', value: '$5.2M' },
              },
              {
                type: 'component',
                component: 'MetricBadge',
                version: 1,
                props: { label: 'Confidence', value: '78%' },
              },
            ],
          },
        ],
        metadata: {
          agent_name: 'OpportunityAgent',
          lifecycle_stage: 'discovery',
          confidence_score: 0.78,
          theme: 'light',
        },
      };

      const result = renderPage(discoveryLayout);

      expect(result.element).toBeDefined();
      expect(result.metadata.componentCount).toBe(4); // InfoBanner + Grid + 2 MetricBadges
    });
  });

  describe('Dynamic Layout Generation', () => {
    it('should handle layouts with dynamic data binding', () => {
      const dynamicLayout: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'DataTable',
            version: 1,
            props: {
              data: [], // Will be hydrated
              columns: [
                { key: 'name', title: 'Name' },
                { key: 'value', title: 'Value' },
              ],
            },
            hydrateWith: ['/api/metrics'],
          },
        ],
        metadata: {
          agent_name: 'DataBindingAgent',
          experienceId: 'dynamic-table-001',
          theme: 'light',
        },
      };

      const result = renderPage(dynamicLayout);

      expect(result.element).toBeDefined();
      expect(result.metadata.hydratedComponentCount).toBe(1);
    });

    it('should validate complex nested layouts', () => {
      const nestedLayout: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'VerticalSplit',
            version: 1,
            props: { ratios: [1, 1] },
          },
          {
            type: 'component',
            component: 'Grid',
            version: 1,
            props: { columns: 2 },
          },
          {
            type: 'component',
            component: 'MetricBadge',
            version: 1,
            props: { label: 'Metric 1', value: '100' },
          },
          {
            type: 'component',
            component: 'MetricBadge',
            version: 1,
            props: { label: 'Metric 2', value: '200' },
          },
          {
            type: 'component',
            component: 'DataTable',
            version: 1,
            props: {
              data: [
                { col1: 'Row 1', col2: 'Value 1' },
                { col1: 'Row 2', col2: 'Value 2' },
              ],
              columns: [
                { key: 'col1', title: 'Column 1' },
                { key: 'col2', title: 'Column 2' },
              ],
            },
          },
        ],
      };

      const result = renderPage(nestedLayout);

      expect(result.element).toBeDefined();
      expect(result.metadata.componentCount).toBe(5); // VerticalSplit + Grid + 2 MetricBadges + DataTable
    });
  });

  describe('Layout Validation', () => {
    it('should reject layouts with invalid component references', () => {
      const invalidLayout = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InvalidComponent',
            version: 1,
            props: {},
          },
        ],
      };

      expect(() => renderPage(invalidLayout as any)).toThrow(SDUIValidationError);
    });

    it('should handle layouts with missing required props', () => {
      const incompleteLayout: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'DataTable',
            version: 1,
            props: {
              // Missing required 'data' and 'columns' props
            },
          },
        ],
      };

      // Should still render but may show warnings or fallback
      const result = renderPage(incompleteLayout);
      expect(result.element).toBeDefined();
      // Component may render with empty state or fallback
    });

    it('should validate layout metadata', () => {
      const layoutWithMetadata: SDUIPageDefinition = {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Test' },
          },
        ],
        metadata: {
          debug: true,
          cacheTtlSeconds: 300,
          experienceId: 'test-001',
          theme: 'dark',
          lifecycle_stage: 'discovery',
          generated_at: Date.now(),
          agent_name: 'TestAgent',
          confidence_score: 0.95,
        },
      };

      const result = renderPage(layoutWithMetadata);

      expect(result.element).toBeDefined();
      expect(result.metadata.version).toBe(1);
    });
  });
});