#!/usr/bin/env bash
set -Eeuo pipefail

# ValueOS Development Environment Bring-Up Script
#
# Purpose: Start everything needed for development
# - Starts Docker services (Postgres, Redis, etc.)
# - Starts/ensures Supabase is running
# - Runs migrations and seeds (optional)
# - Starts the frontend
# - Ends with a URL to open
#
# Usage: ./scripts/dev.sh [--auth-bypass] [--ui-only] [--docker]
#   --auth-bypass: Enable auth bypass for UI development
#   --ui-only: Start only frontend, skip backend/Supabase
#   --docker: Use Docker-based development (no host dependencies)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTH_BYPASS="${VITE_AUTH_BYPASS:-false}"
UI_ONLY="${UI_ONLY:-false}"
USE_DOCKER="${USE_DOCKER:-false}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --auth-bypass)
      AUTH_BYPASS="true"
      shift
      ;;
    --ui-only)
      UI_ONLY="true"
      shift
      ;;
    --docker)
      USE_DOCKER="true"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--auth-bypass] [--ui-only] [--docker]"
      exit 1
      ;;
  esac
done

echo "🚀 Starting ValueOS Development Environment"
echo "==========================================="

# Check Node version if not using Docker
if [[ "$USE_DOCKER" != "true" ]]; then
  echo "📋 Checking Node version..."
  DEFAULT_NODE_VERSION="18.19.0"
  if [[ -f "${SCRIPT_DIR}/.nvmrc" ]]; then
    DEFAULT_NODE_VERSION="$(tr -d '[:space:]' < "${SCRIPT_DIR}/.nvmrc")"
  fi
  NODE_VERSION="${NODE_VERSION:-$DEFAULT_NODE_VERSION}"

  node_version="$(node -v 2>/dev/null || echo "none")"
  if [[ "$node_version" != "v${NODE_VERSION}" ]]; then
    echo "❌ Node ${NODE_VERSION} required, found ${node_version}"
    echo "💡 Use --docker flag to run in Node 18 container"
    echo "💡 Or install correct Node version: nvm install ${NODE_VERSION} && nvm use ${NODE_VERSION}"
    exit 1
  fi
  echo "✅ Node version correct: ${node_version}"
fi

# Docker-based development
if [[ "$USE_DOCKER" == "true" ]]; then
  echo "🐳 Using Docker-based development..."

  # Build Docker image
  echo "📦 Building development image..."
  docker build -f Dockerfile.dev -t valueos-dev:node18 "$SCRIPT_DIR" >/dev/null 2>&1

  # Set auth bypass if requested
  docker_env=""
  if [[ "$AUTH_BYPASS" == "true" ]]; then
    docker_env="-e VITE_AUTH_BYPASS=true"
  fi

  echo "🌐 Starting services..."
  echo ""
  echo "==========================================="
  echo "🎉 Development environment is ready!"
  echo ""
  if [[ "$AUTH_BYPASS" == "true" ]]; then
    echo "🔓 Auth bypass: ENABLED"
  fi
  echo ""
  echo "📱 Frontend: http://localhost:5173"
  echo "🛑 Press Ctrl+C to stop"
  echo ""

  # Run the container
  docker run --rm -it \
    -p 5173:5173 -p 3001:3001 -p 54321:54321 -p 54323:54323 -p 54322:54322 \
    $docker_env \
    valueos-dev:node18

  exit 0
fi

# Local development (host-based)
if [[ "$UI_ONLY" == "true" ]]; then
  echo "🎨 Starting UI-only development (frontend only)..."

  # Set auth bypass if requested
  if [[ "$AUTH_BYPASS" == "true" ]]; then
    export VITE_AUTH_BYPASS=true
    echo "🔓 Auth bypass enabled"
  fi

  echo "🌐 Starting frontend..."
  if [[ "$AUTH_BYPASS" == "true" ]]; then
    VITE_AUTH_BYPASS=true npm run dev &
  else
    npm run dev &
  fi
  FRONTEND_PID=$!

else
  # Full development environment
  echo "📦 Starting Docker services and Supabase..."
  npm run dx

  # Wait for Supabase to be ready
  echo "⏳ Waiting for Supabase..."
  until curl -fsS --connect-timeout 2 "http://localhost:54321/auth/v1/settings" >/dev/null 2>&1; do
    echo "  Waiting for Supabase..."
    sleep 2
  done
  echo "✅ Supabase is ready"

  # Set auth bypass if requested
  if [[ "$AUTH_BYPASS" == "true" ]]; then
    export VITE_AUTH_BYPASS=true
  fi

  # Start the frontend in background
  echo "🌐 Starting frontend..."
  if [[ "$AUTH_BYPASS" == "true" ]]; then
    VITE_AUTH_BYPASS=true npm run dev &
  else
    npm run dev &
  fi
  FRONTEND_PID=$!
fi

# Wait a moment for frontend to start
sleep 3

# Show status and URL
echo ""
echo "==========================================="
echo "🎉 Development environment is ready!"
echo ""
echo "📱 Frontend: http://localhost:5173"
if [[ "$AUTH_BYPASS" == "true" ]]; then
  echo "🔓 Auth bypass: ENABLED"
fi
if [[ "$UI_ONLY" == "true" ]]; then
  echo "🎨 Mode: UI-only (no backend/Supabase)"
fi
echo ""
echo "🛑 To stop: Ctrl+C (or kill $FRONTEND_PID)"
echo "📊 To check status: ./scripts/verify.sh"
echo ""

# Wait for frontend process
wait $FRONTEND_PID
