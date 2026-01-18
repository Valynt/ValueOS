# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability, please report it responsibly:

- **Email:** security@valueos.example
- **What to include:** impact, affected components, reproduction steps, and any proof-of-concept.
- **Response time:** We aim to acknowledge reports within 3 business days.

Do **not** open public GitHub issues for security vulnerabilities.

## Dependency policy

- Dependencies are updated via Dependabot and/or Renovate.
- Lockfile integrity is enforced via CI (`pnpm run lint:lockfile`).
- High severity vulnerabilities must be addressed before release.

## Supported versions

We currently support the latest `main` branch and the most recent tagged release.
