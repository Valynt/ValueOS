---
description: Start the development environment for GUI access and login
---

# Start GUI Development Environment

// turbo-all

1. Start Supabase local services for authentication:

```bash
npx supabase start
```

2. Start the frontend dev server:

```bash
npm run dev
```

3. The application should be available at http://localhost:5173

You can now log in to view the GUI.

## Alternative: Full Docker Setup

```bash
docker-compose up -d
```

## Troubleshooting

- If Supabase fails, try `npx supabase stop` then `npx supabase start`
- Ensure Docker is running for Supabase services
- Check `.env` has correct configuration
