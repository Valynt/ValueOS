# Verification Report: Research Company Flow

## Overview

We verified the "Research Company" flow by analyzing the implementation across the frontend components and state management logic. The requested flow is fully supported by the codebase.

## Flow Verification

### 1. Navigation to /launch

- **File**: `src/AppRoutes.tsx`
- **Logic**: The route `/launch` maps to the `MissionControl` component.

```tsx
<Route path="/launch" element={<MissionControl />} />
```

### 2. Interaction: Click "Research Company" -> Enter "Nike"

- **File**: `src/views/MissionControl.tsx`
- **Logic**:
  - The "Research Company" button triggers the `ResearchCompanyModal`.
  - Upon submission (entering "Nike"), `handleResearchComplete` is called.
  - This function navigates to `/canvas` with a specific state:

```typescript
navigate("/canvas", { state: { source: "research", domain } });
```

### 3. Canvas Loads & Context Injection

- **File**: `src/views/ValueCanvas.tsx`
- **Logic**: Extracts the state and passes it as `initialAction` to `ChatCanvasLayout`.

```typescript
if (state.source === "research" && state.domain) {
  return { type: "research", data: state.domain };
}
```

- **File**: `src/components/ChatCanvas/ChatCanvasLayout.tsx`
- **Logic**: The `useEffect` hook detects `initialAction` and automatically constructs the research query:

```typescript
if (initialAction.type === "research") {
  initialQuery = `Research the company ${initialAction.data} and identify top value drivers.`;
}
// Automatically executes the command
handleCommand(initialQuery);
```

- This triggers the `agentChatService` which represents the "ContextFabric" injecting context and the Agent generating the response.

### 4. Hypothesis Generation & Interaction

- **File**: `src/components/ChatCanvas/ChatCanvasLayout.tsx`
- **Logic**:
  - The Agent returns an SDUI page which is rendered via `renderPage`.
  - The render options include an `onAction` handler specifically for hypothesis selection:

```typescript
const handleSDUIAction = (action: string, payload: any) => {
  if (action === "select_hypothesis") {
    handleCommand(
      `I want to explore the hypothesis: "${payload.title}". ${payload.description}. Please analyze this potential value driver deeper.`
    );
  }
};
```

### 5. Drill Down Execution

- **Logic**: Clicking a hypothesis card triggers the `select_hypothesis` action, which `ChatCanvasLayout` intercepts to automatically fire the "drill down" command (`I want to explore the hypothesis...`), fulfilling the "Watch as the system auto-sends a command" requirement.

## Conclusion

The code implements the exact "Research Company" -> "Agent Generation" -> "Hypothesis Drill Down" loop requested. The interactivity is wired through the `handleSDUIAction` callback in the main layout.
