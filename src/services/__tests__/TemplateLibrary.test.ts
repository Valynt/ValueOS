import { beforeEach, describe, expect, it } from 'vitest';
import { 
  ComponentTemplate, 
  isCanvasTemplate, 
  isReactTemplate,
  templateLibrary
} from '../TemplateLibrary';
import { 
  getTemplateComponent, 
  hasTemplateComponent,
  TEMPLATE_COMPONENT_MAP
} from '../../components/templates/TemplateMap';

describe('TemplateLibrary', () => {
  // ============================================================================
  // Core Retrieval Tests
  // ============================================================================
  
  describe('Core Retrieval', () => {
    it('getAllTemplates returns 11 templates (6 canvas + 5 financial)', () => {
      const templates = templateLibrary.getAllTemplates();
      expect(templates.length).toBe(11);
    });

    it('getTemplateById returns correct template', () => {
      const roiDashboard = templateLibrary.getTemplateById('roi-dashboard');
      expect(roiDashboard).toBeDefined();
      expect(roiDashboard?.name).toBe('ROI Dashboard');
      expect(roiDashboard?.category).toBe('composite');
    });

    it('getTemplateById returns undefined for non-existent ID', () => {
      const nonExistent = templateLibrary.getTemplateById('non-existent-template');
      expect(nonExistent).toBeUndefined();
    });

    it('getTemplatesByCategory("financial") returns 5 templates', () => {
      const financialTemplates = templateLibrary.getTemplatesByCategory('financial');
      expect(financialTemplates.length).toBe(5);
      financialTemplates.forEach(t => {
        expect(t.category).toBe('financial');
      });
    });

    it('getTemplatesByCategory("composite") returns canvas templates', () => {
      const compositeTemplates = templateLibrary.getTemplatesByCategory('composite');
      expect(compositeTemplates.length).toBeGreaterThan(0);
      compositeTemplates.forEach(t => {
        expect(t.category).toBe('composite');
      });
    });
  });

  // ============================================================================
  // Discriminated Union Type Tests
  // ============================================================================

  describe('Discriminated Union Types', () => {
    it('all canvas templates have type: "canvas"', () => {
      const canvasTemplates = templateLibrary.getCanvasTemplates();
      canvasTemplates.forEach(t => {
        expect(t.type).toBe('canvas');
      });
    });

    it('all canvas templates have components array', () => {
      const canvasTemplates = templateLibrary.getCanvasTemplates();
      canvasTemplates.forEach(t => {
        if (isCanvasTemplate(t)) {
          expect(Array.isArray(t.components)).toBe(true);
          expect(t.components.length).toBeGreaterThan(0);
        }
      });
    });

    it('all react templates have type: "react"', () => {
      const reactTemplates = templateLibrary.getFinancialTemplates();
      reactTemplates.forEach(t => {
        expect(t.type).toBe('react');
      });
    });

    it('all react templates have componentKey', () => {
      const reactTemplates = templateLibrary.getFinancialTemplates();
      reactTemplates.forEach(t => {
        if (isReactTemplate(t)) {
          expect(t.componentKey).toBeDefined();
          expect(typeof t.componentKey).toBe('string');
        }
      });
    });

    it('react templates have minDataRequirements', () => {
      const reactTemplates = templateLibrary.getFinancialTemplates();
      reactTemplates.forEach(t => {
        if (isReactTemplate(t)) {
          expect(t.minDataRequirements).toBeDefined();
        }
      });
    });
  });

  // ============================================================================
  // Type Filter Tests
  // ============================================================================

  describe('Type Filters', () => {
    it('getFinancialTemplates returns only react templates', () => {
      const financialTemplates = templateLibrary.getFinancialTemplates();
      expect(financialTemplates.length).toBe(5);
      financialTemplates.forEach(t => {
        expect(t.type).toBe('react');
      });
    });

    it('getCanvasTemplates returns only canvas templates', () => {
      const canvasTemplates = templateLibrary.getCanvasTemplates();
      expect(canvasTemplates.length).toBe(6);
      canvasTemplates.forEach(t => {
        expect(t.type).toBe('canvas');
      });
    });

    it('isCanvasTemplate type guard works correctly', () => {
      const roiDashboard = templateLibrary.getTemplateById('roi-dashboard');
      const impactCascade = templateLibrary.getTemplateById('impact-cascade');
      
      expect(isCanvasTemplate(roiDashboard!)).toBe(true);
      expect(isCanvasTemplate(impactCascade!)).toBe(false);
    });

    it('isReactTemplate type guard works correctly', () => {
      const roiDashboard = templateLibrary.getTemplateById('roi-dashboard');
      const impactCascade = templateLibrary.getTemplateById('impact-cascade');
      
      expect(isReactTemplate(roiDashboard!)).toBe(false);
      expect(isReactTemplate(impactCascade!)).toBe(true);
    });
  });

  // ============================================================================
  // Search Tests
  // ============================================================================

  describe('Search', () => {
    it('searchTemplates finds by name', () => {
      const results = templateLibrary.searchTemplates('Trinity');
      expect(results.length).toBeGreaterThan(0);
      expect(results.find(t => t.id === 'trinity-dashboard')).toBeDefined();
    });

    it('searchTemplates finds by tag', () => {
      const results = templateLibrary.searchTemplates('roi');
      expect(results.length).toBeGreaterThan(0);
      // Should find both ROI Dashboard and Trinity Dashboard
      const ids = results.map(t => t.id);
      expect(ids).toContain('roi-dashboard');
    });

    it('searchTemplates finds by description content', () => {
      const results = templateLibrary.searchTemplates('waterfall');
      expect(results.length).toBeGreaterThan(0);
      expect(results.find(t => t.id === 'impact-cascade')).toBeDefined();
    });

    it('searchTemplates returns empty for no match', () => {
      const results = templateLibrary.searchTemplates('xyznonexistent123');
      expect(results.length).toBe(0);
    });

    it('searchTemplates is case-insensitive', () => {
      const upperResults = templateLibrary.searchTemplates('TRINITY');
      const lowerResults = templateLibrary.searchTemplates('trinity');
      expect(upperResults.length).toBe(lowerResults.length);
    });
  });

  // ============================================================================
  // Instantiation Tests
  // ============================================================================

  describe('Instantiation', () => {
    it('instantiateTemplate works for canvas templates', () => {
      const components = templateLibrary.instantiateTemplate('roi-dashboard', { x: 0, y: 0 });
      expect(components.length).toBeGreaterThan(0);
      components.forEach(c => {
        expect(c.id).toBeDefined();
        expect(c.position).toBeDefined();
        expect(c.position.x).toBeGreaterThanOrEqual(0);
        expect(c.position.y).toBeGreaterThanOrEqual(0);
      });
    });

    it('instantiateTemplate returns empty array for react templates', () => {
      const components = templateLibrary.instantiateTemplate('impact-cascade', { x: 0, y: 0 });
      expect(components.length).toBe(0);
    });

    it('instantiateTemplate returns empty array for non-existent template', () => {
      const components = templateLibrary.instantiateTemplate('non-existent', { x: 0, y: 0 });
      expect(components.length).toBe(0);
    });

    it('instantiateTemplate assigns unique IDs to each component', () => {
      const components = templateLibrary.instantiateTemplate('kpi-grid', { x: 0, y: 0 });
      const ids = components.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('instantiateTemplate positions components from start position', () => {
      const startPos = { x: 100, y: 200 };
      const components = templateLibrary.instantiateTemplate('roi-dashboard', startPos);
      
      // First component should be at start position
      if (components.length > 0) {
        expect(components[0].position.x).toBe(startPos.x);
        expect(components[0].position.y).toBe(startPos.y);
      }
    });
  });

  // ============================================================================
  // Financial Template Specific Tests
  // ============================================================================

  describe('Financial Templates', () => {
    const financialTemplateIds = [
      'impact-cascade',
      'trinity-dashboard',
      'story-arc',
      'scenario-matrix',
      'quantum-view',
    ];

    it('all 5 expected financial templates exist', () => {
      financialTemplateIds.forEach(id => {
        const template = templateLibrary.getTemplateById(id);
        expect(template).toBeDefined();
        expect(template?.category).toBe('financial');
      });
    });

    it('each financial template has appropriate tags', () => {
      financialTemplateIds.forEach(id => {
        const template = templateLibrary.getTemplateById(id);
        expect(template?.tags.length).toBeGreaterThan(0);
      });
    });

    it('financial templates have componentKey matching id pattern', () => {
      financialTemplateIds.forEach(id => {
        const template = templateLibrary.getTemplateById(id);
        if (isReactTemplate(template!)) {
          expect(template.componentKey).toBe(id);
        }
      });
    });
  });
});

// ============================================================================
// TemplateMap Tests
// ============================================================================

describe('TemplateMap', () => {
  it('TEMPLATE_COMPONENT_MAP has 5 entries', () => {
    const keys = Object.keys(TEMPLATE_COMPONENT_MAP);
    expect(keys.length).toBe(5);
  });

  it('TEMPLATE_COMPONENT_MAP contains all expected keys', () => {
    const expectedKeys = [
      'impact-cascade',
      'trinity-dashboard',
      'story-arc',
      'scenario-matrix',
      'quantum-view',
    ];
    expectedKeys.forEach(key => {
      expect(TEMPLATE_COMPONENT_MAP[key]).toBeDefined();
    });
  });

  it('getTemplateComponent returns component for valid key', () => {
    const component = getTemplateComponent('impact-cascade');
    expect(component).toBeDefined();
    expect(typeof component).toBe('function'); // React components are functions
  });

  it('getTemplateComponent returns undefined for unknown key', () => {
    const component = getTemplateComponent('non-existent-key');
    expect(component).toBeUndefined();
  });

  it('hasTemplateComponent returns true for valid key', () => {
    expect(hasTemplateComponent('trinity-dashboard')).toBe(true);
  });

  it('hasTemplateComponent returns false for unknown key', () => {
    expect(hasTemplateComponent('non-existent-key')).toBe(false);
  });

  it('all componentKeys in templates exist in TEMPLATE_COMPONENT_MAP', () => {
    const financialTemplates = templateLibrary.getFinancialTemplates();
    financialTemplates.forEach(t => {
      if (isReactTemplate(t)) {
        expect(hasTemplateComponent(t.componentKey)).toBe(true);
      }
    });
  });
});
