# App Surface Area (Go-Live Snapshot)

| App | Base URL | Public routes | Protected routes count | Admin routes | Backend required | Mock/dev-only behavior present |
| --- | --- | --- | ---: | --- | --- | --- |
| mcp-dashboard | TBD | `/login` | 6 | `/admin` | Yes | Yes (sample dashboard data) |
| VOSAcademy | TBD | `/`, `/404` | 11 | None | Yes | No (tRPC-backed) |
| ValyntApp | TBD | `/login`, `/signup`, `/reset-password`, `/auth/callback`, `/`→`/login` | 0 | None | Yes (auth) | No |
