# Docs Reorg (Audit → Consolidation → Prune)

Overview
- This utility runs a 3-phase docs reorganization:
  1. **Audit (Clustering)**: compute embeddings for docs, build a similarity map, flag duplicates
  2. **Consolidation**: propose merged files for clusters of similar docs
  3. **Pruning**: detect stale docs and mark them for archiving

What it produces
- `tmp/proposed_merges/similarity-map.json` — clusters and file lists
- `tmp/proposed_merges/*.md` — proposed merged files
- `tmp/proposed_merges/stale.json` — list of flagged stale files
- A Git branch `cleanup/docs-reorg-YYYY-MM-DD` with the proposed files added, and a PR (if enabled)

Configuration
- `config/docs-reorg.config.json` controls thresholds and deprecated terms.

Environment
- EMBEDDING_API_URL — (optional) POST {input: text} → returns embedding array. If unset, a deterministic fallback embedding is used.
  - Example (Nomic / ollama): `EMBEDDING_API_URL=http://localhost:11434/embed` after `ollama pull nomic-embed-text`
- GEMINI_API_URL / GEMINI_API_KEY — (optional) configure Gemini 3 Flash. If present, the synthesize step will use Gemini for merges (recommended).
  - Optionally set `GEMINI_MODEL` (default: `gemini-3.0-flash`).
- GITHUB_TOKEN — (optional) token used to create PRs.
- GITHUB_REPOSITORY — owner/repo used to create PRs (e.g. "Valynt/ValueOS").
- GIT_REMOTE — (optional) default 'origin'
- PR behavior: `config/docs-reorg.config.json` has `prDraftDefault` (default true). Use CLI `--draft` / `--open-pr` / `--no-pr` to override when running.
- Supabase sync (optional): set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` and enable `supabase.enabled` in `config/docs-reorg.config.json` to persist merged docs and vectors to a `docs_embeddings` table.

Run locally
- One-shot: `node scripts/docs-reorg/run.js --once`
- Daemon (schedules a daily 02:00 job): `node scripts/docs-reorg/run.js --daemon`

VS Code background task
- A `.vscode/tasks.json` task is available ("Docs Audit & Reorg (daemon)") to launch `pnpm docs:reorg -- --daemon` as a background job.

Human-in-the-loop
- The tool creates a new branch and commits `tmp/proposed_merges` content; it will open a PR when `GITHUB_TOKEN` and `GITHUB_REPOSITORY` are present.
- The PR body contains a summary; please review proposed merges before merging.

Notes & Safety
- The tool never deletes files automatically; it only proposes merges and marks stale files for archiving inside `tmp/proposed_merges/`.
- We recommend running in `--daemon` mode during off-hours and reviewing the PR the next morning.

Agent Prompt (example)
```
You are the Valynt Documentation Librarian. Your goal is to reduce ~600 files to ~50 high-quality documents.
- Identify redundancy: group files by semantic similarity.
- Synthesize: merge groups into single files using a "Table of Contents" structure.
- Standardize: ensure consistent Markdown headers and math as LaTeX where applicable.
- Propose: do not delete files; move duplicates/stale files to `tmp/proposed_merges/` and generate a summary report for approval.
```
