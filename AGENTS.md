# AGENTS.md — ValueOS

This is the repository-root agent guide.

## System Intent

> **ValueOS is a system of intelligence that structures, validates, and operationalizes business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.**

## Canonical instructions

- The detailed cross-repo guidance lives in `docs/AGENTS.md`.
- Treat `docs/AGENTS.md` as the canonical long-form policy for repository-wide architecture, safety, coding conventions, and the full constitutional layer (invariants, rejection criteria, agent preamble).
- More specific `AGENTS.md` files inside subdirectories override this file for their scoped trees.

## Working rules

- Read `docs/AGENTS.md` before making broad architectural, backend, or documentation changes.
- When editing files under a directory with its own `AGENTS.md`, follow the deeper file in addition to this root guide.
- Keep product naming aligned to **ValueOS** unless a file explicitly documents a legacy external identifier.
- Canonical skills live in `docs/skills/`. Tool-specific namespaces (`.windsurf/skills/`, `.gitpod/skills/`) are thin adapters — they must not duplicate or contradict the canonical versions.
