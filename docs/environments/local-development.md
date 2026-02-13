# Local Development

**Last Updated**: 2026-02-08

**Consolidated from 1 source documents**

---

## ValueOS Local Development Environment

*Source: `dev-environment.md`*

Technical Design Brief

## 1. Purpose

This document defines the canonical local development environment for ValueOS.

The goal is to provide a deterministic, reproducible, one-command developer experience where:

Opening the repository in a Dev Container brings up a fully functional, login-capable application, including authentication, database, and supporting services.

This environment is optimized for:

- reliability (no "works on my machine")
- fast iteration
- minimal cognitive overhead
- alignment with production topology where appropriate

## 2. Problem Statement

ValueOS uses Supabase for authentication and database access.

Without Supabase running locally and the database migrated, the application cannot authenticate users or function meaningfully in development.

Historically, the environment was split into:

- a dev container (editor/runtime)
- a separate dev environment (Supabase, Redis, Postgres)

This split caused:

- unclear source of truth
- inconsistent startup procedures
- hidden dependencies
- fragile onboarding
- confusion around Docker usage (Docker-in-Docker vs host Docker)

## 3. Design Goals

### Primary Goals

- **Single Source of Truth**: One canonical definition of the local stack.
- **One-Step Startup**: "Reopen in Container" yields a working, login-capable app.
- **No Docker-in-Docker**: One Docker engine only.
- **Supabase First-Class**: Auth and DB are always present and correctly wired.
- **Fast & Idempotent**: No unnecessary reinstalls or rebuilds on every open.

### Non-Goals

- Running production-grade infrastructure locally
- Supporting multiple mutually incompatible local setups
- Optimizing for non-containerized workflows

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────┐
│ Docker Engine (WSL2 / Docker Desktop)                     │
│                                                          │
│ ┌──────────────┐                                         │
│ │ app          │ ← VS Code Dev Container attaches here   │
│ │ (ValueOS)    │                                         │
│ └──────┬───────┘                                         │
│        │ internal DNS                                    │
│        ▼                                                 │
│ ┌──────────────┐ ┌──────────────┐                        │
│ │ Supabase     │ │ Redis        │                        │
│ │ (Auth + DB)  │ │              │                        │
│ └──────────────┘ └──────────────┘                        │
│                                                          │
│ Shared Docker network: valueos-network                   │
│ Named volumes for persistence                            │
└──────────────────────────────────────────────────────────┘
```

**Key Principle**: The devcontainer is not the environment — it is the workspace service inside a multi-container environment defined by Docker Compose.

## 5. Technology Stack

### Core Components

- **VS Code Dev Containers**: Development workspace
- **Docker Compose**: Single project orchestration
- **Supabase (local)**: Authentication (GoTrue), Postgres database, REST/Realtime/Storage
- **Redis**: Cache and background coordination
- **Node.js + pnpm**: Application runtime

### Tooling Decisions

- One Docker engine (host/WSL2)
- No Docker daemon inside containers
- Optional Docker CLI access only if explicitly required

## 6. Source of Truth

| File                                            | Responsibility                  |
| ----------------------------------------------- | ------------------------------- |
| `.devcontainer/devcontainer.json`               | Entry point, VS Code attachment |
| `ops/compose/profiles/devcontainer.yml` | Entire local stack              |
| `.devcontainer/Dockerfile.optimized`            | App tooling image               |
| `.deps_installed`                               | Install marker (generated)      |

There is no separate "dev env" compose for local development.

## 7. Docker Compose Design

### Services Defined

**Mandatory (default profile):**

- `app` – ValueOS devcontainer service
- `db` – Supabase Postgres
- `auth` – Supabase GoTrue
- `rest` – PostgREST
- `realtime` – Supabase Realtime
- `storage` – Supabase Storage API
- `meta` – Postgres Meta (introspection)
- `kong` – API gateway
- `redis` – Cache service

**Optional profiles:**

- `studio` – Supabase Studio UI
- `debug` – Publishes DB/Redis ports to host

### Networking

- Single named network: `valueos-network`
- All services communicate via service DNS names, never localhost

### Persistence

Named volumes:

- `postgres-data`
- `storage-data`
- `redis-data`
- `pnpm-store` (for performance)

## 8. Devcontainer Responsibilities

### What the Devcontainer Does

- Hosts the application runtime
- Provides consistent toolchain (Node, pnpm, git)
- Attaches VS Code to the correct container
- Bootstraps dependencies once
- Applies DB migrations to ensure login works

### What It Explicitly Does Not Do

- Run Docker daemon
- Orchestrate infrastructure imperatively
- Start background services manually

## 9. Provisioning & Lifecycle

### Startup Flow

1. Developer opens repo in VS Code
2. VS Code runs Dev Containers
3. Docker Compose starts full stack
4. VS Code attaches to app
5. `postCreateCommand` runs:
   - Installs dependencies once
   - Applies DB migrations
6. App is ready for login

### Idempotency Guarantees

- Dependency installation is marker-gated (`.deps_installed`)
- Migrations are safe to rerun
- Rebuild ≠ reinstall

## 10. postCreateCommand Strategy

### Principles

- Must be fast
- Must be idempotent
- Must guarantee auth works

### Responsibilities

- `pnpm install` (once per container)
- Apply Supabase DB migrations

### Explicitly Excluded

- Heavy diagnostics
- Destructive resets
- CI-like validation

Diagnostics (`dx:doctor`) are run manually.

## 11. Supabase Strategy

### Why Supabase Is Embedded

- Auth is a hard dependency
- Login must work by default
- DB schema must match application expectations

### Chosen Pattern

Supabase runs as Compose services, not via CLI-managed containers.

**Benefits:**

- Deterministic
- Inspectable
- Debuggable
- No Docker socket exposure needed

## 12. Docker Usage Policy

### Default

- No docker commands executed inside app
- No `/var/run/docker.sock` mount

### Optional Extension (if ever needed)

If a future workflow requires Docker commands inside the devcontainer:

- Install docker CLI only
- Mount docker.sock
- Still no Docker-in-Docker

This is a deliberate opt-in, not default behavior.

## 13. Security & Isolation

- No privileged containers
- No nested daemons
- Minimal surface area
- Credentials scoped to local dev only
- Volumes isolated per project

## 14. Developer Experience Outcomes

After this design:

**New contributor:**

1. Clones repo
2. Clicks "Reopen in Container"
3. Logs in successfully

No README archaeology, no "run this script first", no hidden infra assumptions, no Docker confusion.

## 15. Verification Checklist

A valid environment satisfies:

- [ ] `docker compose ps` shows app + supabase + redis
- [ ] App can authenticate locally
- [ ] Supabase DB persists across restarts
- [ ] Rebuild does not reinstall deps unless marker removed
- [ ] No Docker daemon inside containers
- [ ] Service hostnames resolve correctly

## 16. Future Extensions (Explicitly Planned)

- Compose profiles for observability
- CI reuse of the same compose stack
- Optional test-only services
- Devcontainer Tasks for common workflows

## 17. Summary

This design makes the devcontainer the owner of the entire local development environment without collapsing boundaries or introducing unnecessary complexity.

It aligns tooling, infrastructure, and developer workflow around one principle:

**Local development should be boring, predictable, and invisible.**

---