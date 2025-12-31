# ValueOS Codemap - VS Code Extension

**Context-Aware IDE for ValueOS**

Provides "Satellite Navigation" for developers with live dependency graphs, blast radius visualization, and hot path detection.

## Features

### 🗺️ Live Dependency Graphs

- See what files import the current file
- See what the current file imports
- Visualize the architectural context

### ⚠️ Hot Path Detection

- Queries Prometheus for production traffic metrics
- Highlights high-traffic files (>1M requests/day)
- Warns developers before they edit critical code

### 📊 Blast Radius Analysis

- Shows how many files will be affected by changes
- Calculates risk score (0-10)
- Identifies affected services

### 🚀 Local CI Simulation

- Run CI pipeline locally before pushing
- Smart test selection based on impact
- Faster feedback loop

## Installation

### From Source

```bash
cd .vscode-extension/valueos-codemap
npm install
npm run compile
npm run package
```

Then install the `.vsix` file in VS Code:

1. Open VS Code
2. Go to Extensions
3. Click "..." → "Install from VSIX"
4. Select `valueos-codemap-0.1.0.vsix`

## Usage

### Commands

- **ValueOS: Show Dependencies** - Display dependency graph for current file
- **ValueOS: Show Blast Radius** - Analyze impact of recent changes
- **ValueOS: Analyze Impact** - Full impact analysis with risk scoring

### Configuration

```json
{
  "valueos.codemap.enabled": true,
  "valueos.codemap.showDependencies": true,
  "valueos.codemap.prometheusUrl": "http://localhost:9090",
  "valueos.codemap.hotPathThreshold": 1000000
}
```

## How It Works

1. **Dependency Analysis**: Uses TypeScript Compiler API to build call graphs
2. **Hot Path Detection**: Queries Prometheus for production metrics
3. **Risk Scoring**: Combines fan-out, criticality, and blast radius
4. **Test Selection**: Maps affected files to test files

## Integration with Cognitive Pipeline

This extension is **Phase 0.1** of the Cognitive Delivery Pipeline:

- ✅ **Phase 0.1**: Context-Aware IDE (this extension)
- 🔄 **Phase 1**: Intelligent CI (smart test selection in GitHub Actions)
- 🔄 **Phase 2**: Progressive Delivery (canary deployments, auto-rollback)

## Example

When you open `LlmProxyClient.ts`:

```
⚠️  High Traffic Zone (10.5M requests/day)
Changes may impact cost ($5K/day). Run perf tests before merging.

Imports (3):
  • lib/agent-fabric/llm-types.ts
  • config/llm.ts
  • lib/logger.ts

Imported By (12):
  • AgentOrchestrator.ts
  • SessionManager.ts
  • SemanticMemory.ts
  • ... 9 more files
```

## Development

```bash
# Watch mode
npm run watch

# Compile
npm run compile

# Package
npm run package
```

## Future Features

- [ ] Mermaid diagram generation
- [ ] Inline code lens with blast radius
- [ ] Git pre-commit hook integration
- [ ] AI-powered risk assessment
- [ ] Historical impact trends

## Support

Part of the ValueOS Cognitive Pipeline project. See `implementation_plan.md` for full roadmap.
