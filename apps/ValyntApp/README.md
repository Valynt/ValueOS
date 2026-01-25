# Valynt App

Modern SaaS frontend built with Vite, React, TypeScript, and Tailwind CSS.

## Getting Started

For a full local stack (frontend + backend + Supabase), follow the repo quickstart:
- [`docs/getting-started/quickstart.md`](../../docs/getting-started/quickstart.md)

If you only need the frontend:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm run dx:env -- --mode local --force
pnpm --filter valynt-app dev
```

## Project Structure

```
ValyntApp/
├── public/              # Static assets
├── src/
│   ├── main.tsx         # App entry point
│   ├── App.tsx          # Root component
│   ├── styles/          # Global styles
│   ├── app/             # App shell (routes, providers, config)
│   ├── pages/           # Route-level screens
│   ├── layouts/         # Page layouts
│   ├── components/      # UI components
│   ├── features/        # Feature modules
│   ├── services/        # API clients
│   ├── lib/             # Utilities
│   ├── hooks/           # Custom hooks
│   ├── types/           # TypeScript types
│   └── assets/          # Images, icons
└── tests/               # Test files
```

## Scripts

Run these from the repo root:

- `pnpm --filter valynt-app dev` — Start dev server
- `pnpm --filter valynt-app build` — Production build
- `pnpm run lint` — Lint code
- `pnpm run format` — Format code
- `pnpm run typecheck` — Type check
- `pnpm run test` — Run tests
