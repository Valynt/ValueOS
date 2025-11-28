# SDUI Phase 4: Migration & Optimization Guide

## Overview

Phase 4 focuses on migrating existing React views to SDUI and optimizing performance. This is the final phase that brings the SDUI implementation to 100% completion.

**Status**: 🔲 Not Started  
**Estimated Duration**: 2-3 weeks  
**Priority**: Medium (core infrastructure complete)

---

## 4.1 View Migration

### Views to Migrate

| View | Template | Priority | Complexity | Estimated Effort |
|------|----------|----------|------------|------------------|
| OpportunityWorkspace | sof-opportunity-template | High | Medium | 2 days |
| TargetROIWorkspace | sof-target-template | High | Medium | 2 days |
| ExpansionInsightPage | sof-expansion-template | High | Medium | 2 days |
| IntegrityCompliancePage | sof-integrity-template | High | Low | 1.5 days |
| PerformanceDashboard | New template | Medium | High | 2.5 days |

**Total**: 10 days

---

### Migration Process (Per View)

#### Step 1: Analyze Current View Structure

**Objective**: Understand what the view does and what data it needs

**Tasks**:
1. Document all components used
2. Identify data sources (props, state, API calls)
3. List all user interactions (buttons, forms, etc.)
4. Map state management (useState, useContext, etc.)
5. Identify side effects (useEffect, API calls)

**Example: OpportunityWorkspace**

```typescript
// Current structure analysis
Components:
- Search bar
- Metric cards (4)
- Discovery card list
- System map visualization
- Persona cards

Data Sources:
- Local state: searchQuery, selectedMetric
- API: /api/opportunities, /api/system-maps
- Context: WorkspaceContext

User Interactions:
- Search opportunities
- Filter by metric
- Create new opportunity
- View system map
- Edit persona

State Management:
- useState for local UI state
- useContext for workspace data
- useQuery for API data
```

**Deliverable**: View Analysis Document

---

#### Step 2: Map Components to SDUI Registry

**Objective**: Identify which SDUI components to use

**Tasks**:
1. Review SDUI component registry
2. Map each UI element to SDUI component
3. Identify missing components (need to create)
4. Document component props mapping

**Example: OpportunityWorkspace Mapping**

```typescript
// Component mapping
Current Component → SDUI Component

Search bar → SearchInput (need to create)
Metric cards → MetricBadge (exists)
Discovery card → DiscoveryCard (exists)
System map → SystemMapCanvas (need to create)
Persona cards → PersonaCard (need to create)
```

**Deliverable**: Component Mapping Document

---

#### Step 3: Create/Update SDUI Template

**Objective**: Define the SDUI page schema

**Tasks**:
1. Open existing template (or create new)
2. Add all mapped components
3. Define component props
4. Set up data bindings
5. Define layout directives

**Example: Update sof-opportunity-template.ts**

```typescript
export function generateSOFOpportunityPage(data: OpportunityData): SDUIPageDefinition {
  return {
    type: 'page',
    version: 2, // Increment version
    sections: [
      // Header with search
      {
        type: 'component',
        component: 'SearchInput',
        version: 1,
        props: {
          placeholder: 'Search opportunities...',
          onSearch: {
            action: 'searchOpportunities',
            debounce: 300,
          },
        },
      },
      
      // Metrics row
      {
        type: 'component',
        component: 'MetricRow',
        version: 1,
        props: {
          metrics: [
            {
              label: 'Total Opportunities',
              value: data.metrics.total,
              trend: data.metrics.totalTrend,
            },
            // ... more metrics
          ],
        },
      },
      
      // Discovery cards
      {
        type: 'component',
        component: 'DiscoveryCardList',
        version: 1,
        props: {
          discoveries: data.discoveries,
          onSelect: {
            action: 'selectDiscovery',
          },
          onCreate: {
            action: 'createDiscovery',
          },
        },
      },
      
      // System map (if available)
      ...(data.systemMap ? [{
        type: 'component' as const,
        component: 'SystemMapCanvas',
        version: 1,
        props: {
          entities: data.systemMap.entities,
          relationships: data.systemMap.relationships,
          onEntityClick: {
            action: 'viewEntity',
          },
        },
      }] : []),
    ],
  };
}
```

**Deliverable**: Updated SDUI Template

---

#### Step 4: Implement Data Fetching

**Objective**: Fetch data needed for the template

**Tasks**:
1. Identify all data requirements
2. Implement fetch methods in Canvas Schema Service
3. Handle loading states
4. Handle error states
5. Implement caching strategy

**Example: Add to CanvasSchemaService**

```typescript
// In CanvasSchemaService.ts

/**
 * Fetch opportunity data
 */
private async fetchOpportunityData(workspaceId: string): Promise<OpportunityData> {
  try {
    // Fetch metrics
    const { data: metrics } = await supabase
      .from('opportunity_metrics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    // Fetch discoveries
    const { data: discoveries } = await supabase
      .from('discoveries')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    // Fetch system map
    const { data: systemMap } = await supabase
      .from('system_maps')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    // Fetch personas
    const { data: personas } = await supabase
      .from('personas')
      .select('*')
      .eq('workspace_id', workspaceId);

    return {
      metrics: metrics || this.getDefaultMetrics(),
      discoveries: discoveries || [],
      systemMap: systemMap || null,
      personas: personas || [],
    };
  } catch (error) {
    logger.error('Failed to fetch opportunity data', {
      workspaceId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Return default data on error
    return this.getDefaultOpportunityData();
  }
}

/**
 * Get default opportunity data
 */
private getDefaultOpportunityData(): OpportunityData {
  return {
    metrics: this.getDefaultMetrics(),
    discoveries: [],
    systemMap: null,
    personas: [],
  };
}
```

**Deliverable**: Data Fetching Implementation

---

#### Step 5: Add Action Handlers

**Objective**: Handle all user interactions

**Tasks**:
1. List all actions from template
2. Implement handler for each action
3. Add validation
4. Add error handling
5. Test each action

**Example: Add to ActionRouter**

```typescript
// In ActionRouter.ts

// Search opportunities
this.registerHandler('searchOpportunities', async (action: any, context) => {
  try {
    const { query } = action;
    
    const { data, error } = await supabase
      .from('discoveries')
      .select('*')
      .eq('workspace_id', context.workspaceId)
      .ilike('title', `%${query}%`);

    if (error) throw error;

    return {
      success: true,
      data: { discoveries: data },
      // Trigger atomic update to show results
      atomicActions: [
        createMutateAction(
          { type: 'DiscoveryCardList' },
          [{ path: 'props.discoveries', operation: 'set', value: data }],
          'Update search results'
        ),
      ],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
});

// Select discovery
this.registerHandler('selectDiscovery', async (action: any, context) => {
  try {
    const { discoveryId } = action;
    
    // Navigate to discovery detail
    return {
      success: true,
      data: { discoveryId },
      schemaUpdate: await canvasSchemaService.generateSchema(
        context.workspaceId,
        { ...context, view: 'discovery-detail', discoveryId }
      ),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Selection failed',
    };
  }
});

// Create discovery
this.registerHandler('createDiscovery', async (action: any, context) => {
  try {
    const { title, description } = action;
    
    const { data, error } = await supabase
      .from('discoveries')
      .insert({
        workspace_id: context.workspaceId,
        title,
        description,
        created_by: context.userId,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: { discovery: data },
      // Trigger atomic update to add new discovery
      atomicActions: [
        createAddAction(
          {
            component: 'DiscoveryCard',
            props: {
              discovery: data,
              onSelect: { action: 'selectDiscovery' },
            },
          },
          { position: 'top', append: false },
          'Add new discovery'
        ),
      ],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Creation failed',
    };
  }
});
```

**Deliverable**: Action Handler Implementation

---

#### Step 6: Test End-to-End

**Objective**: Verify everything works

**Tasks**:
1. Enable SDUI mode
2. Navigate to migrated view
3. Test all components render
4. Test all actions work
5. Test error states
6. Test loading states
7. Performance testing

**Test Checklist**:

```markdown
## OpportunityWorkspace Migration Test

### Visual Tests
- [ ] Page loads without errors
- [ ] All components render correctly
- [ ] Layout matches original design
- [ ] Responsive design works
- [ ] Loading states show correctly
- [ ] Error states show correctly

### Functional Tests
- [ ] Search works
- [ ] Metric cards display correct data
- [ ] Discovery cards are clickable
- [ ] Create discovery works
- [ ] System map (if present) is interactive
- [ ] Persona cards display correctly

### Performance Tests
- [ ] Initial load < 2 seconds
- [ ] Search response < 500ms
- [ ] Action response < 300ms
- [ ] No memory leaks
- [ ] No console errors

### Edge Cases
- [ ] Empty state (no discoveries)
- [ ] Error state (API failure)
- [ ] Large dataset (100+ discoveries)
- [ ] Slow network (throttled)
```

**Deliverable**: Test Report

---

#### Step 7: Remove Old React Component

**Objective**: Clean up legacy code

**Tasks**:
1. Verify SDUI version works in production
2. Remove old component file
3. Remove unused imports
4. Remove unused dependencies
5. Update routing (if needed)
6. Update tests

**Example**:

```bash
# Backup old component (just in case)
git mv src/views/OpportunityWorkspace.tsx src/views/_deprecated/OpportunityWorkspace.tsx.bak

# Or delete if confident
rm src/views/OpportunityWorkspace.tsx

# Update imports in App.tsx
# Remove: import { OpportunityWorkspace } from './views/OpportunityWorkspace';

# Commit changes
git add .
git commit -m "Migrate OpportunityWorkspace to SDUI

- Remove traditional React component
- Now using sof-opportunity-template
- All functionality preserved
- Performance improved

Co-authored-by: Ona <no-reply@ona.com>"
```

**Deliverable**: Clean Codebase

---

## 4.2 Performance Optimization

### Optimization Checklist

#### 1. Schema Caching Strategy

**Current**: 5-minute TTL, simple cache invalidation

**Optimizations**:
- [ ] Implement cache warming (pre-generate common schemas)
- [ ] Add cache versioning (invalidate only when schema changes)
- [ ] Implement cache compression (reduce memory usage)
- [ ] Add cache metrics (hit rate, miss rate)
- [ ] Implement distributed caching (Redis cluster)

**Implementation**:

```typescript
// Enhanced caching in CanvasSchemaService

private readonly CACHE_VERSIONS = new Map<string, number>();

/**
 * Cache schema with version
 */
private cacheSchemaWithVersion(
  workspaceId: string,
  schema: SDUIPageDefinition,
  version: number
): void {
  const cacheKey = `${this.CACHE_PREFIX}${workspaceId}:v${version}`;
  const entry: SchemaCacheEntry = {
    schema,
    timestamp: Date.now(),
    ttl: this.CACHE_TTL,
    workspaceId,
    version,
  };
  
  this.cacheService.set(cacheKey, entry, this.CACHE_TTL);
  this.CACHE_VERSIONS.set(workspaceId, version);
}

/**
 * Warm cache for common workspaces
 */
async warmCache(workspaceIds: string[]): Promise<void> {
  logger.info('Warming schema cache', { count: workspaceIds.length });
  
  await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      try {
        await this.generateSchema(workspaceId, {
          workspaceId,
          userId: 'system',
          lifecycleStage: 'opportunity',
        });
      } catch (error) {
        logger.error('Failed to warm cache', { workspaceId, error });
      }
    })
  );
}
```

**Expected Impact**: 50% reduction in schema generation time

---

#### 2. Data Hydration Optimization

**Current**: Sequential data fetching

**Optimizations**:
- [ ] Implement parallel data fetching
- [ ] Add data prefetching (fetch before needed)
- [ ] Implement incremental hydration (load critical data first)
- [ ] Add data streaming (stream large datasets)
- [ ] Implement GraphQL (reduce over-fetching)

**Implementation**:

```typescript
// Parallel data fetching

private async fetchWorkspaceData(state: WorkspaceState): Promise<any> {
  // Fetch all data in parallel
  const [
    businessCase,
    systemMap,
    personas,
    kpis,
    interventions,
  ] = await Promise.all([
    this.fetchBusinessCase(state.workspaceId),
    this.fetchSystemMap(state.workspaceId),
    this.fetchPersonas(state.workspaceId),
    this.fetchKPIs(state.workspaceId),
    this.fetchInterventions(state.workspaceId),
  ]);

  return {
    businessCase,
    systemMap,
    personas,
    kpis,
    interventions,
  };
}
```

**Expected Impact**: 60% reduction in data loading time

---

#### 3. Component Lazy Loading

**Current**: All components loaded upfront

**Optimizations**:
- [ ] Implement React.lazy for all SDUI components
- [ ] Add loading skeletons
- [ ] Implement intersection observer (load when visible)
- [ ] Add prefetching for likely-needed components
- [ ] Implement code splitting by route

**Implementation**:

```typescript
// Enhanced component registry with lazy loading

export const COMPONENT_REGISTRY: ComponentRegistry = {
  // Critical components (loaded immediately)
  InfoBanner: React.lazy(() => import('../components/Common/InfoBanner')),
  
  // Non-critical components (loaded on demand)
  SystemMapCanvas: React.lazy(() => 
    import(/* webpackChunkName: "system-map" */ '../components/SystemMap/SystemMapCanvas')
  ),
  
  InterventionDesigner: React.lazy(() =>
    import(/* webpackChunkName: "intervention" */ '../components/Intervention/InterventionDesigner')
  ),
  
  // ... more components
};

// Add loading fallback
function SDUIComponentLoader({ component, props }: any) {
  return (
    <Suspense fallback={<ComponentSkeleton />}>
      <Component {...props} />
    </Suspense>
  );
}
```

**Expected Impact**: 40% reduction in initial bundle size

---

#### 4. Bundle Size Reduction

**Current**: ~2MB bundle size

**Optimizations**:
- [ ] Analyze bundle with webpack-bundle-analyzer
- [ ] Remove unused dependencies
- [ ] Implement tree shaking
- [ ] Use dynamic imports for large libraries
- [ ] Optimize images and assets
- [ ] Enable compression (gzip/brotli)

**Commands**:

```bash
# Analyze bundle
npm run build -- --analyze

# Check for unused dependencies
npx depcheck

# Optimize images
npx imagemin src/assets/**/*.{jpg,png} --out-dir=src/assets/optimized
```

**Expected Impact**: 50% reduction in bundle size (to ~1MB)

---

#### 5. Server-Side Rendering (SSR)

**Current**: Client-side rendering only

**Optimizations**:
- [ ] Implement SSR for initial page load
- [ ] Add hydration for interactive components
- [ ] Implement streaming SSR
- [ ] Add edge caching (CDN)
- [ ] Implement static generation for common pages

**Implementation** (using Vite SSR):

```typescript
// server.ts
import { renderToString } from 'react-dom/server';
import { SDUIApp } from './components/SDUIApp';

export async function render(url: string, workspaceId: string) {
  // Generate schema on server
  const schema = await canvasSchemaService.generateSchema(workspaceId, {
    workspaceId,
    userId: 'ssr',
    lifecycleStage: 'opportunity',
  });

  // Render to string
  const html = renderToString(
    <SDUIApp
      workspaceId={workspaceId}
      userId="ssr"
      initialSchema={schema}
    />
  );

  return { html, schema };
}
```

**Expected Impact**: 70% improvement in First Contentful Paint (FCP)

---

## 4.3 Documentation & Training

### Documentation Checklist

#### 1. Architecture Documentation

- [ ] Update system architecture diagram
- [ ] Document data flow
- [ ] Document component lifecycle
- [ ] Document caching strategy
- [ ] Document security model

**File**: `docs/SDUI_ARCHITECTURE.md`

---

#### 2. SDUI Developer Guide

- [ ] Getting started guide
- [ ] Creating SDUI components
- [ ] Creating SDUI templates
- [ ] Creating canonical actions
- [ ] Testing SDUI components
- [ ] Debugging SDUI issues

**File**: `docs/SDUI_DEVELOPER_GUIDE.md`

---

#### 3. Canonical Actions Reference

- [ ] List all canonical actions
- [ ] Document action parameters
- [ ] Document action handlers
- [ ] Provide usage examples
- [ ] Document error handling

**File**: `docs/SDUI_ACTIONS_REFERENCE.md`

---

#### 4. Component Authoring Guide

- [ ] Component structure
- [ ] Props schema definition
- [ ] Data binding
- [ ] Action handling
- [ ] Error boundaries
- [ ] Testing components

**File**: `docs/SDUI_COMPONENT_GUIDE.md`

---

#### 5. Troubleshooting Guide

- [ ] Common issues and solutions
- [ ] Debugging techniques
- [ ] Performance profiling
- [ ] Error messages reference
- [ ] FAQ

**File**: `docs/SDUI_TROUBLESHOOTING.md`

---

### Training Materials

#### 1. Video Tutorials

- [ ] SDUI Overview (15 min)
- [ ] Creating Your First SDUI Component (20 min)
- [ ] Migrating a View to SDUI (30 min)
- [ ] Advanced SDUI Patterns (25 min)
- [ ] Performance Optimization (20 min)

---

#### 2. Hands-On Workshops

- [ ] Workshop 1: SDUI Basics (2 hours)
- [ ] Workshop 2: Component Development (3 hours)
- [ ] Workshop 3: View Migration (4 hours)
- [ ] Workshop 4: Performance Tuning (2 hours)

---

#### 3. Code Examples

- [ ] Simple SDUI component
- [ ] Complex SDUI template
- [ ] Custom action handler
- [ ] Data fetching pattern
- [ ] Error handling pattern
- [ ] Testing pattern

---

## Phase 4 Timeline

### Week 1: View Migration (Part 1)

**Days 1-2**: OpportunityWorkspace
- Analyze structure
- Map components
- Update template
- Implement data fetching
- Add action handlers
- Test end-to-end

**Days 3-4**: TargetROIWorkspace
- Same process as above

**Day 5**: ExpansionInsightPage (start)

---

### Week 2: View Migration (Part 2) + Optimization

**Days 1-2**: ExpansionInsightPage (complete) + IntegrityCompliancePage

**Days 3-4**: PerformanceDashboard (new template)

**Day 5**: Performance optimization (start)
- Schema caching
- Data hydration

---

### Week 3: Optimization + Documentation

**Days 1-2**: Performance optimization (complete)
- Component lazy loading
- Bundle size reduction
- SSR implementation

**Days 3-5**: Documentation
- Architecture docs
- Developer guide
- Component guide
- Troubleshooting guide

---

## Success Criteria

Phase 4 will be considered complete when:

- ✅ All 5 views migrated to SDUI
- ✅ Traditional React views removed
- ✅ Performance targets met:
  - Initial load < 2 seconds
  - Action response < 300ms
  - Bundle size < 1MB
  - FCP < 1 second
- ✅ Test coverage > 90%
- ✅ Documentation complete
- ✅ Team trained

---

## Risk Mitigation

### Risk: Breaking Existing Functionality

**Mitigation**:
- Feature flag allows rollback
- Keep old components until verified
- Comprehensive testing before removal
- Gradual rollout to users

### Risk: Performance Degradation

**Mitigation**:
- Benchmark before and after
- Monitor performance metrics
- Implement optimizations incrementally
- Have rollback plan

### Risk: Team Adoption

**Mitigation**:
- Comprehensive documentation
- Hands-on training
- Code examples
- Ongoing support

---

## Conclusion

Phase 4 completes the SDUI implementation by:
1. Migrating all views to SDUI
2. Optimizing performance
3. Providing comprehensive documentation

**Estimated Duration**: 2-3 weeks  
**Expected Outcome**: 100% SDUI implementation with optimized performance

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-27  
**Author**: Ona (AI Software Engineering Agent)
