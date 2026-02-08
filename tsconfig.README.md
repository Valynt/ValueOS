# TypeScript Configs in ValueOS

This repository uses multiple `tsconfig` files to support different build and tooling scenarios in a monorepo. Below is a summary of each config and its purpose:

- **tsconfig.json**: Base configuration. All other configs extend from this. Contains shared compiler options.
- **tsconfig.app.json**: Used for building application code (frontend/backend). Inherits from `tsconfig.json`.
- **tsconfig.node.json**: Node.js-specific settings for backend/server scripts. Inherits from `tsconfig.json`.
- **tsconfig.scripts.json**: Used for build/test/dev scripts. May include looser settings for tooling.
- **tsconfig.strict.json**: Enables strictest TypeScript checks for critical code paths. Use for high-assurance modules.
- **tsconfig.strict-zones.json**: Applies strict settings to specific zones or packages. Used for gradual adoption of strictness.

**Best Practices:**
- Always extend from `tsconfig.json` to ensure consistency.
- Use the strict configs for new or security-sensitive code.
- Document any customizations in this file.

_Last updated: 2026-02-08_
