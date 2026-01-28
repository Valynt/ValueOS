# Frontend & UX Context

## 1. Tech Stack

- **React 18.3:** Concurrent rendering for responsive agentic UI.
- **Vite 7.2:** Fast HMR and optimized bundling.
- **Zustand:** Lightweight state management for the Agent Store.
- **Radix UI + Tailwind:** Accessible, themeable component library.

## 2. Application Layout

- **AppShell:** Dark sidebar navigation with "Platform" and "Organization" sections.
- **SettingsLayout:** Horizontal tabs for user and team configuration.
- **CaseWorkspace:** Split-pane view with Conversational AI (left) and SDUI Canvas (right).

## 3. Key Components

- **SDUI Canvas:** Dynamic interface driven by JSON schemas from the Agent Fabric.
- **7-State UI Machine:**
  - `Idle`: Indigo pulse.
  - `Clarify`: Amber glow.
  - `Plan`: Task-card reveal.
  - `Execute`: Scanning beam.
  - `Review`: Side-by-side diff.
  - `Finalize`: Success lock.
  - `Resume`: Context restoration.
- **ValueDriverEditor:** Admin modal for managing strategic value propositions.

## 4. Coding Conventions

- **TypeScript:** Strict mode, no `any`, interfaces over types.
- **Precision:** All financial displays must handle `decimal.js` string serialization.
- **Performance:** Lazy loading for all routes; memoization for expensive ROI charts.

---

**Last Updated:** 2026-01-28
**Related:** `apps/ValyntApp/src/components/`, `apps/ValyntApp/src/features/workspace/`
