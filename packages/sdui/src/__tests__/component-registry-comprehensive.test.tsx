/**
 * Comprehensive Component Registry Tests
 * Tests all 25+ pre-registered SDUI components
 */

import { beforeEach, describe, it, vi } from 'vitest';

import {
  getRegistryEntry,
  hotSwapComponent,
  listRegisteredComponents,
  registerComponent,
  resetRegistry,
  resolveComponent,
} from '../registry';
import { SDUIComponentSection } from '../schema';

// Mock all components to avoid import issues in tests
vi.mock('../../components/SDUI', () => ({
  DiscoveryCard: vi.fn(),
  ExpansionBlock: vi.fn(),
  InfoBanner: vi.fn(),
  SectionErrorFallback: vi.fn(),
  UnknownComponentFallback: vi.fn(),
  ValueTreeCard: vi.fn(),
  MetricBadge: vi.fn(),
  KPIForm: vi.fn(),
  ValueCommitForm: vi.fn(),
  RealizationDashboard: vi.fn(),
  LifecyclePanel: vi.fn(),
  IntegrityReviewPanel: vi.fn(),
  SideNavigation: vi.fn(),
  TabBar: vi.fn(),
  Breadcrumbs: vi.fn(),
  DataTable: vi.fn(),
  ConfidenceIndicator: vi.fn(),
  AgentResponseCard: vi.fn(),
  AgentWorkflowPanel: vi.fn(),
  NarrativeBlock: vi.fn(),
  SDUIForm: vi.fn(),
  ScenarioSelector: vi.fn(),
}));

vi.mock('../../components/SDUI/CanvasLayout', () => ({
  VerticalSplit: vi.fn(),
  HorizontalSplit: vi.fn(),
  Grid: vi.fn(),
  DashboardPanel: vi.fn(),
}));

describe('Component Registry - Comprehensive Coverage', () => {
  beforeEach(() => {
    resetRegistry();
  });

  describe('Registry Initialization', () => {
    it('should contain all 25+ registered components', () => {
      const components = listRegisteredComponents();
      expect(components.length).toBeGreaterThan(25);

      // Check that all expected components are registered
      const componentNames = components.map(c => c.description).filter(Boolean);
      expect(componentNames.length).toBeGreaterThan(20);
    });

    it('should have proper version arrays for all components', () => {
      const components = listRegisteredComponents();
      components.forEach(component => {
        expect(Array.isArray(component.versions)).toBe(true);
        expect(component.versions.length).toBeGreaterThan(0);
        expect(component.versions.every(v => typeof v === 'number')).toBe(true);
      });
    });
  });

  describe('Component Resolution', () => {
    it('should resolve all layout components', () => {
      const layoutComponents = ['VerticalSplit', 'HorizontalSplit', 'Grid', 'DashboardPanel'];

      layoutComponents.forEach(componentName => {
        const section: SDUIComponentSection = {
          type: 'component',
          component: componentName,
          version: 1,
          props: {},
        };

        const entry = resolveComponent(section);
        expect(entry).toBeDefined();
        expect(entry?.component).toBeDefined();
        expect(entry?.versions).toContain(1);
      });
    });

    it('should resolve all data display components', () => {
      const dataComponents = ['DataTable', 'ConfidenceIndicator', 'MetricBadge'];

      dataComponents.forEach(componentName => {
        const section: SDUIComponentSection = {
          type: 'component',
          component: componentName,
          version: 1,
          props: {},
        };

        const entry = resolveComponent(section);
        expect(entry).toBeDefined();
        expect(entry?.component).toBeDefined();
      });
    });

    it('should resolve all form components', () => {
      const formComponents = ['KPIForm', 'ValueCommitForm', 'SDUIForm'];

      formComponents.forEach(componentName => {
        const section: SDUIComponentSection = {
          type: 'component',
          component: componentName,
          version: 1,
          props: {},
        };

        const entry = resolveComponent(section);
        expect(entry).toBeDefined();
        expect(entry?.component).toBeDefined();
      });
    });

    it('should resolve all navigation components', () => {
      const navComponents = ['SideNavigation', 'TabBar', 'Breadcrumbs'];

      navComponents.forEach(componentName => {
        const section: SDUIComponentSection = {
          type: 'component',
          component: componentName,
          version: 1,
          props: {},
        };

        const entry = resolveComponent(section);
        expect(entry).toBeDefined();
        expect(entry?.component).toBeDefined();
      });
    });

    it('should resolve all agent-specific components', () => {
      const agentComponents = [
        'AgentResponseCard',
        'AgentWorkflowPanel',
        'NarrativeBlock',
        'ScenarioSelector'
      ];

      agentComponents.forEach(componentName => {
        const section: SDUIComponentSection = {
          type: 'component',
          component: componentName,
          version: 1,
          props: {},
        };

        const entry = resolveComponent(section);
        expect(entry).toBeDefined();
        expect(entry?.component).toBeDefined();
      });
    });

    it('should resolve all lifecycle components', () => {
      const lifecycleComponents = [
        'InfoBanner',
        'DiscoveryCard',
        'ValueTreeCard',
        'ExpansionBlock',
        'RealizationDashboard',
        'LifecyclePanel',
        'IntegrityReviewPanel'
      ];

      lifecycleComponents.forEach(componentName => {
        const section: SDUIComponentSection = {
          type: 'component',
          component: componentName,
          version: 1,
          props: {},
        };

        const entry = resolveComponent(section);
        expect(entry).toBeDefined();
        expect(entry?.component).toBeDefined();
      });
    });

    it('should handle version coercion for unsupported versions', () => {
      const section: SDUIComponentSection = {
        type: 'component',
        component: 'InfoBanner',
        version: 99, // Unsupported version
        props: {},
      };

      const entry = resolveComponent(section);
      expect(entry).toBeDefined();
      expect(entry?.description).toContain('coerced version');
    });

    it('should return undefined for unregistered components', () => {
      const section: SDUIComponentSection = {
        type: 'component',
        component: 'NonExistentComponent',
        version: 1,
        props: {},
      };

      const entry = resolveComponent(section);
      expect(entry).toBeUndefined();
    });
  });

  describe('Registry Management', () => {
    it('should allow registering new components', () => {
      const mockComponent = vi.fn();
      const newEntry = {
        component: mockComponent,
        versions: [1, 2],
        requiredProps: ['test'],
        description: 'Test component',
      };

      registerComponent('TestComponent', newEntry);

      const retrieved = getRegistryEntry('TestComponent');
      expect(retrieved).toEqual(newEntry);
    });

    it('should allow hot-swapping components', () => {
      const originalComponent = vi.fn();
      const newComponent = vi.fn();

      registerComponent('HotSwapTest', {
        component: originalComponent,
        versions: [1],
        description: 'Original',
      });

      const result = hotSwapComponent('HotSwapTest', newComponent);
      expect(result).toBeDefined();
      expect(result?.component).toBe(newComponent);
      expect(result?.description).toBe('Original');
    });

    it('should return undefined when hot-swapping non-existent component', () => {
      const result = hotSwapComponent('NonExistent', vi.fn());
      expect(result).toBeUndefined();
    });

    it('should reset registry to base state', () => {
      const originalCount = listRegisteredComponents().length;

      registerComponent('TempComponent', {
        component: vi.fn(),
        versions: [1],
      });

      expect(listRegisteredComponents().length).toBe(originalCount + 1);

      resetRegistry();
      expect(listRegisteredComponents().length).toBe(originalCount);
    });
  });

  describe('Component Metadata Validation', () => {
    it('should have required props defined for critical components', () => {
      const criticalComponents = [
        'KPIForm',
        'ValueCommitForm',
        'DataTable',
        'SideNavigation',
        'TabBar',
        'Breadcrumbs',
      ];

      criticalComponents.forEach(componentName => {
        const entry = getRegistryEntry(componentName);
        expect(entry).toBeDefined();
        expect(entry?.requiredProps).toBeDefined();
        expect(Array.isArray(entry?.requiredProps)).toBe(true);
        expect(entry?.requiredProps?.length).toBeGreaterThan(0);
      });
    });

    it('should have descriptions for all components', () => {
      const components = listRegisteredComponents();
      components.forEach(component => {
        expect(component.description).toBeDefined();
        expect(typeof component.description).toBe('string');
        expect(component.description?.length).toBeGreaterThan(0);
      });
    });

    it('should have valid version arrays', () => {
      const components = listRegisteredComponents();
      components.forEach(component => {
        expect(Array.isArray(component.versions)).toBe(true);
        expect(component.versions.length).toBeGreaterThan(0);
        expect(component.versions.every(v => Number.isInteger(v) && v > 0)).toBe(true);
      });
    });
  });

    it('should categorize components correctly', () => {
      const components = listRegisteredComponents();

      // Layout components - check by description or other means
      const layoutComponents = components.filter(c =>
        c.description?.includes('layout') || c.description?.includes('split') || c.description?.includes('grid')
      );
      expect(layoutComponents.length).toBeGreaterThan(0);

      // Data components
      const dataComponents = components.filter(c =>
        c.description?.includes('data') || c.description?.includes('table') || c.description?.includes('metric')
      );
      expect(dataComponents.length).toBeGreaterThan(0);

      // Form components
      const formComponents = components.filter(c =>
        c.description?.includes('form') || c.description?.includes('KPI')
      );
      expect(formComponents.length).toBeGreaterThan(0);
    });
});