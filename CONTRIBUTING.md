# Contributing to ValueOS

Welcome to the ValueOS monorepo! This document provides guidelines for contributing to the project.

## Project Structure

This is a modular monorepo managed with **pnpm workspaces**.

- `apps/`: End-user applications (e.g., ValyntApp, mcp-dashboard).
- `packages/`: Shared libraries and services (e.g., backend, shared types).
- `infra/`: Infrastructure as Code (Terraform) and deployment configurations.
- `docs/`: Comprehensive documentation, ADRs, and runbooks.

## Getting Started

### Prerequisites

- Node.js >= 20.19.0
- pnpm >= 9.15.0
- Docker (for local services)
- Supabase CLI (for database development)

### Local Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
4. Start local development services:
   ```bash
   pnpm run docker:up
   ```

## Development Workflow

### Branching Strategy

- `main`: Production-ready code.
- `develop`: Integration branch for features.
- Feature branches: `feature/your-feature-name`.

### Coding Standards

- **Linting**: We use ESLint with security and accessibility plugins. Run `pnpm run lint` to check.
- **Formatting**: Prettier is enforced. Run `pnpm run format` before committing.
- **Type Checking**: TypeScript is used throughout. Run `pnpm run typecheck`.

### Testing

We use Vitest for unit and integration tests, and Playwright for E2E/accessibility tests.

- Unit tests: `pnpm run test:unit`
- Integration tests: `pnpm run test:integration`
- RLS tests: `pnpm run test:rls`
- Accessibility tests: `pnpm run test:a11y`

## CI/CD Pipeline

Our CI pipeline (GitHub Actions) enforces:

1. Linting and Type Checking
2. Unit and Integration Tests
3. Security Scans (CodeQL, Trivy, Semgrep, TruffleHog)
4. SBOM Generation
5. RLS Leakage and Accessibility Gates

### Branch Protection Requirements

To maintain high quality and security standards, the following checks are **required** for all pull requests to `main` and `develop`:

- **Linting and Type Checking**: Ensures code consistency and type safety.
- **Unit and Integration Tests**: Validates core business logic.
- **RLS Leakage Tests**: Critical for multi-tenant isolation.
- **Accessibility Tests**: Ensures WCAG 2.1 AA compliance.
- **Security Scans**: No high or critical vulnerabilities in dependencies or code.

Administrators should enforce these as "Required" status checks in GitHub repository settings.

## Documentation

- **ADRs**: Architectural decisions are recorded in `docs/architecture/adr/`.
- **Runbooks**: Operational guides are in `docs/runbooks/`.
- **API**: OpenAPI specs are located in `packages/backend/openapi.yaml`.

## Security

- Never commit secrets. Use the provided secret management guidance.
- All database changes must include Row Level Security (RLS) policies.
- Report security vulnerabilities via the process defined in `SECURITY.md`.

---

Thank you for contributing to ValueOS!
