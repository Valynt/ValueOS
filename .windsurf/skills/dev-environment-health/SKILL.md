# Development Environment Health

## Purpose

Ensure the local development environment is fully functional before work begins.

## Required Services

- Database (Supabase / Postgres)
- Cache (Redis, if applicable)
- Backend API
- Frontend dev server

## Health Checks

- All services respond to health endpoints
- Required ports are open and conflict-free
- Migrations are applied

## Rules

- Do not proceed with feature work if environment is unhealthy
- Fix environment issues before making code changes
