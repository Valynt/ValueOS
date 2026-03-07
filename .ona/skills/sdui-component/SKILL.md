---
name: sdui-component
description: |
  Use when the user asks to add a new UI component, widget, card, panel, chart,
  or dashboard block to the SDUI system. Handles requests like "add a KPI card",
  "create a new chart component", "add a dashboard widget", "build a new SDUI
  panel", or "add a realization summary card". Covers component file creation,
  dual registration in registry.tsx and ui-registry.json, prop interface
  definition, and validation.
---

# SDUI Component

SDUI components are React components rendered server-side by the agent output pipeline.
They must be registered in **two places** — missing either causes a silent runtime fallback
to `JsonViewer` or `UnknownComponentFallback`.

## Workflow

### Step 1: Create the component file

Location: `packages/sdui/src/components/SDUI/<ComponentName>.tsx`

Follow the template in [references/component-template.tsx](references/component-template.tsx).

Rules:
- Named export only — no `export default`
- Functional component with typed props interface
- Props interface named `<ComponentName>Props`
- No direct data fetching — components receive all data via props from agent output
- Use Tailwind classes for styling; match the visual style of adjacent components

### Step 2: Export from the SDUI barrel

Add to `packages/sdui/src/components/SDUI/index.ts`:
```typescript
export { ComponentName } from "./ComponentName";
```

### Step 3: Register in registry.tsx

File: `packages/sdui/src/registry.tsx`

1. Import the component at the top with the other SDUI imports
2. Add a `versionedRegistry.register(...)` call:

```typescript
versionedRegistry.register({
  component: ComponentName,
  version: 1,
  description: "One-line description of what this component displays",
  requiredProps: ["prop1", "prop2"],   // props that must be present
  optionalProps: ["title", "variant"], // props that may be absent
  tags: ["ui", "<category>"],
});
```

### Step 4: Register in ui-registry.json

File: `scripts/config/ui-registry.json`

Add an intent entry that maps an agent output intent to this component:

```json
{
  "intentType": "display_<your_intent>",
  "component": "ComponentName",
  "fallback": "JsonViewer",
  "description": "When to use this component",
  "propMappings": {
    "prop1": "data.prop1",
    "prop2": "data.prop2"
  }
}
```

### Step 5: Verify

```bash
pnpm run lint
pnpm run dev:frontend   # confirm component renders without errors
```

## Do not proceed if

- The component name already exists in `registry.tsx` — you would silently overwrite it
- The component fetches its own data — all data must come from agent output props
- The `intentType` in `ui-registry.json` conflicts with an existing entry

## Completion report

```
Component file:     packages/sdui/src/components/SDUI/<ComponentName>.tsx
Barrel export:      packages/sdui/src/components/SDUI/index.ts
Registry entry:     packages/sdui/src/registry.tsx
Intent entry:       scripts/config/ui-registry.json
Commands run:       pnpm run lint  →  no errors
Unresolved:         [any open items]
```

## Anti-patterns

| Pattern | Fix |
|---|---|
| Registered in `registry.tsx` but not `ui-registry.json` | Add intent entry to both files |
| `export default` | Use named export |
| Data fetching inside component | Receive all data via props |
| Props typed as `any` | Define a typed `<ComponentName>Props` interface |
| Version not set | Always set `version: 1` for new components |
