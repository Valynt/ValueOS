@echo off
REM Windows-compatible backend startup script for ValueOS
REM This script starts the backend without requiring bash/WSL

echo [backend] Starting ValueOS backend...

REM Check for required environment variables
if not defined DATABASE_URL (
  echo [backend] WARNING: DATABASE_URL not set. Using default local development value.
  set DATABASE_URL=postgresql://valueos_dev:localdev123@localhost:5432/valueos
)

if not defined REDIS_URL (
  echo [backend] WARNING: REDIS_URL not set. Using default local development value.
  set REDIS_URL=redis://localhost:6379
)

REM Change to backend directory and build if needed
cd /d "%~dp0\..\packages\backend"

if not exist "dist\server.js" (
  echo [backend] Building backend first...
  call pnpm run build
  if errorlevel 1 (
    echo [backend] ERROR: Build failed
    exit /b 1
  )
)

REM Start the backend server
echo [backend] Starting server on port 3001...
node dist/server.js
