# System Architecture Map

## Purpose

Provide a shared understanding of this repository’s structure and constraints.

## Architecture Overview

- Frontend: React + Vite (src/)
- Backend/API: Node/Express (src/backend/)
- Agents: src/agents/
- Shared libs: src/lib/
- Config: config/, scripts/, .env\*

## Critical Constraints

- Do not bypass the orchestration layer
- Do not access the database directly outside approved modules
- Environment variables must go through the env adapter

## High-Risk Areas

- Authentication flows
- Agent orchestration logic
- Migrations and schema changes
