# ValueOS Cleanup Commander: Execution Toolkit

This toolkit contains the automated scripts and specific AI prompts required to execute the ValueOS Cleanup Blueprint across all five phases.

## 1. The "God File" Dissector (AI Prompts)

### For ChatCanvasLayout.tsx (2,127 lines)

```
I am refactoring a 2,000+ line 'God File' in an enterprise SaaS repo: ChatCanvasLayout.tsx.

Goal: Decompose this file into a 'Feature-Based' structure while maintaining functional parity.

Tasks:

1. Identify and extract all Pure Utility Functions into a new utils.ts.
2. Identify and extract TypeScript Interfaces/Types into a sibling types.ts.
3. Identify Sub-components within the file and suggest a breakdown (e.g., LibrarySidebar.tsx, CanvasArea.tsx, CommandBarWrapper.tsx, ModalManager.tsx).
4. Extract Business Logic/Data Fetching into a custom React Hook (e.g., useCanvasLayout.ts).
5. Provide a 'Slimmed Down' version of the main file that only handles orchestration and imports these new modules.

Current imports and structure analysis needed:
- 36+ import statements from lucide-react
- Multiple modal components (UploadNotesModal, EmailAnalysisModal, CRMImportModal, SalesCallModal)
- Complex state management with useState hooks
- SDUI rendering logic integration
- Agent orchestration via UnifiedAgentOrchestrator
```

### For UnifiedAgentOrchestrator.ts (1,687 lines)

```
I am refactoring a 1,600+ line 'God File' in an enterprise SaaS repo: UnifiedAgentOrchestrator.ts.

Goal: Decompose this file into a 'Feature-Based' structure while maintaining functional parity.

Tasks:

1. Identify and extract all Pure Utility Functions into a new utils.ts.
2. Identify and extract TypeScript Interfaces/Types into a sibling types.ts.
3. Identify Service Classes within the file and suggest a breakdown (e.g., AgentExecutor.ts, WorkflowManager.ts, CircuitBreakerService.ts, MessageBroker.ts).
4. Extract Configuration and Setup logic into a separate config.ts.
5. Provide a 'Slimmed Down' version of the main file that only handles orchestration and imports these new modules.

Current complexity indicators:
- 45+ import statements including multiple internal services
- Multiple design patterns consolidated (Circuit Breaker, Message Broker, Workflow DAG)
- Complex type definitions and interfaces
- Integration with GroundtruthAPI, LLMGateway, MemorySystem
- Audit logging and observability features
```

## 2. Dependency Purge Script (dep-audit.sh)

```bash
#!/bin/bash
# ValueOS Dependency Audit Script
# Run this to identify unused packages and version mismatches before Phase 3 cleanup

echo "🔍 Starting ValueOS Dependency Audit..."

# Install depcheck if not present
if ! command -v depcheck &> /dev/null; then
    echo "📦 Installing depcheck..."
    npm install -g depcheck
fi

# Generate comprehensive dependency report
echo "📊 Analyzing unused dependencies..."
npx depcheck --json > dep-report.json 2>/dev/null
npx depcheck --html > dep-report.html 2>/dev/null

# Identify duplicate versions of major libraries
echo "🔍 Checking for duplicate library versions..."
echo "=== Radix UI Components ==="
npm ls @radix-ui 2>/dev/null | grep -E "(deduped|UNMET PEER DEPENDENCY)" || echo "No duplicates found"

echo "=== Lucide React ==="
npm ls lucide-react 2>/dev/null | grep -E "(deduped|UNMET PEER DEPENDENCY)" || echo "No duplicates found"

echo "=== TypeScript ==="
npm ls typescript 2>/dev/null | grep -E "(deduped|UNMET PEER DEPENDENCY)" || echo "No duplicates found"

echo "=== Testing Libraries ==="
npm ls @testing-library 2>/dev/null | grep -E "(deduped|UNMET PEER DEPENDENCY)" || echo "No duplicates found"

# Check for security vulnerabilities
echo "🔒 Checking for security vulnerabilities..."
npm audit --audit-level=high > security-audit.txt

# Analyze bundle size impact
echo "📦 Analyzing bundle size..."
npm run build 2>/dev/null
if [ -d "dist" ]; then
    du -sh dist/* | sort -hr
fi

# Generate summary report
echo "📋 Generating summary report..."
cat > audit-summary.md << EOF
# ValueOS Dependency Audit Summary

## Unused Dependencies
\`\`\`json
$(cat dep-report.json | jq -r '.dependencies[]' 2>/dev/null || echo "Analysis failed")
\`\`\`

## Security Issues
\`\`\`
$(cat security-audit.txt | head -20)
\`\`\`

## Bundle Size Analysis
\`\`\`
$(du -sh dist 2>/dev/null || echo "Build analysis failed")
\`\`\`

## Recommendations
1. Remove unused dependencies identified by depcheck
2. Address high-severity security vulnerabilities
3. Consolidate duplicate library versions
4. Optimize bundle size through tree shaking
EOF

echo "✅ Dependency audit complete! Check dep-report.html and audit-summary.md"
```

## 3. Architecture Migration Map (Phase 2)

### File Migration Strategy

| Current Path                                     | New Feature-Based Path                                     | Migration Priority |
| ------------------------------------------------ | ---------------------------------------------------------- | ------------------ |
| `src/components/ChatCanvas/ChatCanvasLayout.tsx` | `src/features/canvas/components/ChatCanvasLayout.tsx`      | High               |
| `src/services/UnifiedAgentOrchestrator.ts`       | `src/features/agents/services/UnifiedAgentOrchestrator.ts` | High               |
| `src/hooks/useAgent.ts`                          | `src/features/agents/hooks/useAgent.ts`                    | Medium             |
| `src/services/billingService.ts`                 | `src/features/billing/services/billing.service.ts`         | Medium             |
| `src/types/eso-data.ts`                          | `src/shared/types/eso-data.ts`                             | High               |
| `src/types/structural-data.ts`                   | `src/shared/types/structural-data.ts`                      | High               |
| `src/types/vos-pt1-seed.ts`                      | `src/shared/types/vos-pt1-seed.ts`                         | High               |
| `src/services/CanvasSchemaService.ts`            | `src/features/canvas/services/CanvasSchemaService.ts`      | High               |
| `src/services/TenantProvisioning.ts`             | `src/features/tenant/services/TenantProvisioning.ts`       | Medium             |
| `src/causal/business-case-generator-enhanced.ts` | `src/features/causal/services/business-case-generator.ts`  | Low                |

### Migration Script (migrate-structure.sh)

```bash
#!/bin/bash
# ValueOS Architecture Migration Script
# Execute this to restructure from folder-by-type to feature-based architecture

echo "🏗️ Starting ValueOS Architecture Migration..."

# Create new feature-based directory structure
mkdir -p src/features/{agents,canvas,billing,tenant,causal,integrations}/{components,services,hooks,types,utils}
mkdir -p src/shared/{components/ui,services,utils,types,config}
mkdir -p src/infrastructure/{config,database,monitoring}
mkdir -p src/api/{routes,middleware,clients}

# High-priority migrations (God Files)
echo "🔄 Migrating high-priority files..."

# ChatCanvasLayout.tsx
if [ -f "src/components/ChatCanvas/ChatCanvasLayout.tsx" ]; then
    mkdir -p src/features/canvas/components
    mv src/components/ChatCanvas/ChatCanvasLayout.tsx src/features/canvas/components/
    echo "✅ Moved ChatCanvasLayout.tsx"
fi

# UnifiedAgentOrchestrator.ts
if [ -f "src/services/UnifiedAgentOrchestrator.ts" ]; then
    mkdir -p src/features/agents/services
    mv src/services/UnifiedAgentOrchestrator.ts src/features/agents/services/
    echo "✅ Moved UnifiedAgentOrchestrator.ts"
fi

# Type files
if [ -f "src/types/eso-data.ts" ]; then
    mkdir -p src/shared/types
    mv src/types/eso-data.ts src/shared/types/
    echo "✅ Moved eso-data.ts"
fi

if [ -f "src/types/structural-data.ts" ]; then
    mkdir -p src/shared/types
    mv src/types/structural-data.ts src/shared/types/
    echo "✅ Moved structural-data.ts"
fi

# Update import paths in moved files
echo "🔄 Updating import paths..."
find src/features -name "*.ts" -o -name "*.tsx" | while read file; do
    # Update relative imports to new structure
    sed -i 's|from "\.\./\.\./types/|from "@shared/types/|g' "$file"
    sed -i 's|from "\.\./\.\./services/|from "@shared/services/|g' "$file"
    sed -i 's|from "\.\./\.\./components/|from "@shared/components/|g' "$file"
done

echo "✅ Architecture migration complete!"
echo "📝 Next steps: Update tsconfig.json paths and run TypeScript compilation"
```

## 4. The "Anti-Any" ESLint Shield (Phase 4)

### Enhanced ESLint Configuration

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json",
    "tsconfigRootDir": "."
  },
  "plugins": ["@typescript-eslint", "import"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/explicit-module-boundary-types": "warn",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    "import/no-relative-parent-imports": "error",
    "import/no-unresolved": "error",
    "max-lines": ["error", { "max": 500, "skipBlankLines": true, "skipComments": true }],
    "complexity": ["error", { "max": 15 }],
    "max-depth": ["error", { "max": 4 }],
    "max-params": ["error", { "max": 5 }]
  },
  "overrides": [
    {
      "files": ["*.test.ts", "*.test.tsx", "*.spec.ts", "*.spec.tsx"],
      "rules": {
        "@typescript-eslint/no-explicit-any": "warn",
        "max-lines": "off"
      }
    }
  ]
}
```

### Type Safety Migration Script (fix-any-types.sh)

```bash
#!/bin/bash
# ValueOS Type Safety Migration Script
# Execute this to systematically eliminate 'any' types

echo "🔒 Starting ValueOS Type Safety Migration..."

# Find all files with 'any' type usage
echo "🔍 Scanning for 'any' type usage..."
grep -r "as any\|: any\|<any>" src/ --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort -u > any-type-files.txt

# Process each file
while read file; do
    echo "🔄 Processing: $file"

    # Create backup
    cp "$file" "$file.backup"

    # Replace common 'any' patterns with proper types
    sed -i 's/as any/as unknown/g' "$file"
    sed -i 's/: any/: unknown/g' "$file"
    sed -i 's/<any>/<unknown>/g' "$file"

    # Add TODO comments for manual review
    sed -i 's/: unknown/: unknown // TODO: Replace with proper type/g' "$file"

    echo "✅ Processed: $file"
done < any-type-files.txt

echo "📋 Type safety migration complete!"
echo "📝 Next steps: Review all files with 'unknown' types and replace with proper TypeScript types"
```

## 5. Automated ADR Generator (Phase 5)

### ADR Generation Prompt

```
Generate an Architectural Decision Record (ADR) for the ValueOS Repository Cleanup.

Context:
- 370,000 lines of TypeScript code across 1,387 files
- High cyclomatic complexity with 21 "God Files" exceeding 1,000 lines
- Mixed architectural patterns (folder-by-type vs feature-based)
- 50+ instances of 'any' type usage indicating weak type safety
- Complex dependency structure with 290+ packages
- Scattered API layer and inconsistent state management

Decision:
- Migration to Feature-Based Architecture from folder-by-type structure
- Implementation of strict Type-Safety with ESLint enforcement
- Decomposition of God Files into focused, single-responsibility modules
- Consolidation of API layer and standardization of state management
- Implementation of comprehensive documentation and knowledge management

Consequences:
- Higher initial development effort for migration phase
- Temporary disruption to development workflow during transition
- Need for comprehensive testing to ensure functional parity
- Expected 20% increase in development velocity post-migration
- 40% reduction in code duplication and technical debt
- Improved onboarding time from weeks to days
- Enhanced code maintainability and reduced bug surface area

Please generate a formal ADR document with:
1. Title and context
2. Decision details
3. Rationale with supporting data
4. Consequences (positive and negative)
5. Implementation timeline
6. Success metrics and verification methods
```

### ADR Template Generator (generate-adr.sh)

```bash
#!/bin/bash
# ValueOS ADR Generator Script
# Execute this to create standardized ADR documents

echo "📝 Generating ValueOS Architectural Decision Records..."

# Create ADR directory structure
mkdir -p docs/adr

# Generate ADR for repository cleanup
cat > docs/adr/001-repository-cleanup.md << 'EOF'
# ADR-001: Repository Architecture Cleanup

## Status
Accepted

## Context
The ValueOS repository has grown to 370,000+ lines of TypeScript code with significant technical debt:
- 21 "God Files" exceeding 1,000 lines each
- Mixed architectural patterns
- Weak type safety with 50+ 'any' usages
- Complex dependency structure
- Scattered API layer and state management

## Decision
Implement a comprehensive repository cleanup with the following changes:
1. Migrate from folder-by-type to feature-based architecture
2. Decompose God Files into focused modules
3. Implement strict type safety
4. Consolidate API layer
5. Standardize state management
6. Create comprehensive documentation

## Rationale
- **Maintainability**: Feature-based architecture improves code organization
- **Scalability**: Smaller, focused modules are easier to maintain
- **Developer Experience**: Better onboarding and navigation
- **Code Quality**: Strict typing reduces runtime errors
- **Performance**: Optimized dependency management improves build times

## Consequences
### Positive
- 20% increase in development velocity
- 40% reduction in code duplication
- Onboarding time reduced from weeks to days
- Enhanced code maintainability
- Improved type safety

### Negative
- 2-3 month migration period
- Temporary disruption to development
- Learning curve for new architecture
- Initial complexity in setup

## Implementation
- Phase 1: Audit and analysis (2 weeks)
- Phase 2: Structural refactoring (4 weeks)
- Phase 3: Dependency cleanup (2 weeks)
- Phase 4: Core modernization (4 weeks)
- Phase 5: Documentation (2 weeks)

## Success Metrics
- Build time reduced by 20-40%
- Type coverage达到95%+
- Code review time reduced by 30%
- Bug rate reduced by 25%
- Developer satisfaction improved

EOF

echo "✅ ADR-001 generated: docs/adr/001-repository-cleanup.md"
echo "📝 Use this template for future architectural decisions"
```

## Execution Checklist

### Pre-Execution Checklist

- [ ] Create feature branch for cleanup work
- [ ] Backup current state with git tag
- [ ] Run full test suite to establish baseline
- [ ] Document current metrics (build time, bundle size, coverage)

### Phase Execution Order

1. **Phase 1**: Run dependency audit script
2. **Phase 2**: Execute architecture migration script
3. **Phase 3**: Apply dependency purge recommendations
4. **Phase 4**: Implement ESLint shield and type safety
5. **Phase 5**: Generate ADRs and documentation

### Post-Execution Verification

- [ ] All tests pass with new structure
- [ ] Build time improved by target percentage
- [ ] ESLint reports zero violations
- [ ] Type coverage meets targets
- [ ] Documentation is complete and accurate

This toolkit provides everything needed to execute the ValueOS cleanup blueprint systematically while maintaining code quality and minimizing disruption to development workflows.
