# ValueOS Engineering Onboarding (Current Guidance)

> **Status:** This onboarding document previously referenced Taskfile and Nix workflows that are not present in the current repository. Use the canonical quickstart instead.

## Canonical Onboarding Path

```bash
git clone https://github.com/valynt/valueos.git
cd valueos
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm run dx:env -- --mode local --force
pnpm run dx
```

**Expected outcome:** local environment files are generated, Docker dependencies + Supabase start, and the app is served at `http://localhost:5173`.

## Follow-on References

- [Local Development Setup (Options A/B)](../getting-started/local-setup.md)
- [Environment Configuration](../ENVIRONMENT.md)
- [Common Issues + Fixes](../getting-started/troubleshooting.md)
