# Environment Files for ValueOS

This directory contains canonical environment variable templates for local development and CI.

- `.env.local.example`: Safe, non-secret defaults for developer-local overrides. Copy to project root as `.env.local`.
- `.env.ports.example`: All port mappings for local stack. Copy to project root as `.env.ports`.

## Usage

On a new machine or fresh clone, run:

    ./scripts/dx/bootstrap-env.sh

This will create `.env.local` and `.env.ports` in the project root if missing, using these templates.

**Never commit `.env.local` or `.env.ports`!**

See the main README for more details.
