# Tech Stack: ValueOS

## Frontend
- **Framework**: React 18
- **Styling**: Tailwind CSS, PostCSS, Lucide React
- **UI Components**: Radix UI (Dialog, Dropdown, Tabs, etc.)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Forms**: React Hook Form with Zod validation
- **Visualization**: Recharts, html2canvas, jspdf

## Backend
- **Runtime**: Node.js (v20+)
- **Framework**: Express.js
- **Task Queue**: BullMQ
- **Streaming**: Server-Sent Events (SSE) for agent progress
- **Events**: Kafka (via kafkajs)

## Persistence & Infrastructure
- **Primary Database**: Supabase (PostgreSQL)
- **Security**: Row-Level Security (RLS) via JWT context
- **Caching & State**: Redis (ioredis)
- **Vault**: node-vault for secret management

## AI & Orchestration
- **Agent Fabric**: Custom `LLMGateway` supporting multi-provider circuit breaking.
- **Validation**: Zod for structured agent outputs.
- **Orchestration**: Distributed Saga Pattern for long-running workflows.
- **UI Strategy**: Server-Driven UI (SDUI) for dynamic agent-driven interfaces.

## Observability & Quality
- **Tracing/Metrics**: OpenTelemetry
- **Error Tracking**: Sentry
- **Logging**: Winston with CloudWatch integration
- **Testing**: Vitest, Playwright
- **Linting**: ESLint, Prettier
