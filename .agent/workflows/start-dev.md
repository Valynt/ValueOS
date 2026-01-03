---
description: Start the development environment for ValueOS
---

# Start Development Environment

// turbo-all

1. Start Supabase local services:

```bash
npx supabase start
```

2. Start the frontend dev server:

```bash
npm run dev
```

3. The application should be available at http://localhost:5173

## Alternative: Full Docker Setup

```bash
docker-compose up -d
```

## Troubleshooting

- If Supabase fails, try `npx supabase stop` then `npx supabase start`
- Ensure Docker is running for Supabase services
- Check `.env` has correct configuration
