# Valynt App

Modern SaaS frontend built with Vite, React, TypeScript, and Tailwind CSS.

## Getting Started

```bash
npm install
npm run dev
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

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — Lint code
- `npm run format` — Format code
- `npm run typecheck` — Type check
- `npm run test` — Run tests
