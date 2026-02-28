# Gemini CLI Project Context

This `GEMINI.md` file provides essential context and protocols for the Gemini CLI to interact effectively with the `ValueOS` project. It outlines conventions, file resolution strategies, and project-specific guidelines.

## Project Overview
ValueOS is an AI-powered value engineering platform for B2B SaaS. It helps customer success and sales teams quantify, track, and expand business value through a multi-agent orchestration system.

## Repository Layout
- `apps/ValyntApp/`: Primary web application (React + Vite + Tailwind).
- `apps/VOSAcademy/`: Training and certification portal.
- `packages/agents/`: AI agent implementations.
- `packages/backend/`: Express API server.
- `packages/components/`: Shared UI component library.
- `packages/infra/`: Infrastructure utilities and queue abstractions.
- `packages/integrations/`: Third-party integrations (Stripe, CRM, etc.).
- `packages/mcp/`: Model Context Protocol tooling.
- `packages/memory/`: Agent memory and vector store layer.
- `packages/sdui/`: Server-Driven UI renderer.
- `packages/shared/`: Shared types, utilities, and constants.
- `infra/`: Kubernetes, Terraform, Supabase, and observability configs.
- `conductor/`: Project tracks, plans, and guidelines.

## Key Tech Stack
- **Frontend:** React, Vite, Tailwind CSS, Radix UI.
- **Backend:** Node.js (Express), pnpm monorepo with Turborepo.
- **AI/Agents:** 7-agent fabric, Orchestrator, Memory layer, MCP tools, BullMQ queues.
- **Infrastructure:** Supabase (Postgres + RLS), Redis, Kafka.
- **Deployment:** Kubernetes (k8s), Docker Compose.
- **Security:** TruffleHog, CodeQL, Semgrep, Trivy, Checkov, Gitleaks.

## Universal File Resolution Protocol


**PROTOCOL: How to locate files.**
To find a file (e.g., "**Product Definition**") within a specific context (Project Root or a specific Track):

1.  **Identify Index:** Determine the relevant index file:
    -   **Project Context:** `conductor/index.md`
    -   **Track Context:**
        a. Resolve and read the **Tracks Registry** (via Project Context).
        b. Find the entry for the specific `<track_id>`.
        c. Follow the link provided in the registry to locate the track's folder. The index file is `<track_folder>/index.md`.
        d. **Fallback:** If the track is not yet registered (e.g., during creation) or the link is broken:
            1. Resolve the **Tracks Directory** (via Project Context).
            2. The index file is `<Tracks Directory>/<track_id>/index.md`.

2.  **Check Index:** Read the index file and look for a link with a matching or semantically similar label.

3.  **Resolve Path:** If a link is found, resolve its path **relative to the directory containing the `index.md` file**.
    -   *Example:* If `conductor/index.md` links to `./workflow.md`, the full path is `conductor/workflow.md`.

4.  **Fallback:** If the index file is missing or the link is absent, use the **Default Path** keys below.

5.  **Verify:** You MUST verify the resolved file actually exists on the disk.

**Standard Default Paths (Project):**
- **Product Definition**: `conductor/product.md`
- **Tech Stack**: `conductor/tech-stack.md`
- **Workflow**: `conductor/workflow.md`
- **Product Guidelines**: `conductor/product-guidelines.md`
- **Tracks Registry**: `conductor/tracks.md`
- **Tracks Directory**: `conductor/tracks/`

**Standard Default Paths (Track):**
- **Specification**: `conductor/tracks/<track_id>/spec.md`
- **Implementation Plan**: `conductor/tracks/<track_id>/plan.md`
- **Metadata**: `conductor/tracks/<track_id>/metadata.json`

## Project-Specific Instructions

### Conductor Extension
The `conductor` extension is used to manage project tracks and plans. If a user mentions a "plan" or asks about the "plan", refer to `conductor/tracks.md` or the specific track plan at `conductor/tracks/<track_id>/plan.md`.

### Endor Labs Code Security Extension
The `Endor-Labs-Code-Security` extension integrates with Endor Labs for code analysis and security scanning.
- **Initialize:** Use "Initialize Endor Labs" to set up.
- **Scanning:** Use "Scan my project for security vulnerabilities" or "Check dependencies for known CVEs".
- **Reports:** Use "Generate a security report for this repository".
- **MCP Server:** This extension uses the `endor-labs` MCP server.

