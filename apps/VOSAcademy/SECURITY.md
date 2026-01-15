# Security Policy

## Reporting a vulnerability
If you discover a security issue, please email **security@vosacademy.example** with details about the problem and steps to reproduce. We aim to acknowledge new reports within 3 business days.

## Dependency security
- Keep dependencies up to date by running `npm audit` and addressing advisories promptly.
- Use pinned versions from `package-lock.json` when installing to ensure reproducible builds.
- Avoid introducing packages without active maintenance or security support. If a new dependency is required, prefer well-reviewed libraries and document the rationale in the pull request.
