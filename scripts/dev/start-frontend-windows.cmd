@echo off
REM Windows-compatible frontend startup script for ValueOS
echo [frontend] Starting ValyntApp frontend...

cd /d "%~dp0\..\apps\ValyntApp"

REM Check if Vite is available
where vite >nul 2>nul
if errorlevel 1 (
  echo [frontend] Vite not found in PATH, using pnpm...
  call pnpm exec vite --port 5173 --host
) else (
  vite --port 5173 --host
)
