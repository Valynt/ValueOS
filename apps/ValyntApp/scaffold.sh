#!/usr/bin/env bash
set -e

echo "📁 Creating Vite SaaS directory structure..."

# root-level
mkdir -p public
mkdir -p src

# public
mkdir -p public

# src core
mkdir -p src/styles
mkdir -p src/app/{routes,providers,config,bootstrap}

# pages
mkdir -p src/pages/{marketing,auth,app,errors}

# layouts
mkdir -p src/layouts

# components
mkdir -p src/components/{ui,common,app}

# features (domain modules)
mkdir -p src/features/{auth,billing,workspace}
mkdir -p src/features/auth/{components}
mkdir -p src/features/billing/{components}
mkdir -p src/features/workspace/{components}

# services (cross-cutting)
mkdir -p src/services/{http,analytics,storage}

# lib + hooks + types
mkdir -p src/{lib,hooks,types}

# assets
mkdir -p src/assets/{illustrations}

# tests
mkdir -p src/tests/{factories}

echo "✅ Directory scaffold created successfully."

touch \
  src/main.tsx \
  src/App.tsx \
  src/styles/globals.css \
  src/app/routes/index.tsx \
  src/app/providers/AppProviders.tsx \
  src/services/http/client.ts \
  src/lib/format.ts
