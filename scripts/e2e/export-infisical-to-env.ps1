#!/usr/bin/env pwsh
# Export Infisical secrets to .env.local for Playwright tests
# Usage: .\scripts\e2e\export-infisical-to-env.ps1

$ErrorActionPreference = "Stop"
$PROJECT_ROOT = Resolve-Path "$PSScriptRoot\..\.."
$ENVIRONMENT = $env:INFISICAL_ENVIRONMENT ?? "dev"
$ENV_FILE = "$PROJECT_ROOT\apps\ValyntApp\.env.local"

# Determine how to run infisical
$CLI_CMD = @()
$infisicalPath = (Get-Command infisical -ErrorAction SilentlyContinue)?.Source

if ($infisicalPath) {
    $CLI_CMD = @("infisical")
} elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-Host "Using 'pnpm dlx @infisical/cli'" -ForegroundColor Yellow
    $CLI_CMD = @("pnpm", "dlx", "@infisical/cli")
} else {
    Write-Error "Neither 'infisical' nor 'pnpm' found"
    exit 1
}

# Check for .infisical.json
if (-not (Test-Path "$PROJECT_ROOT\.infisical.json")) {
    Write-Error "Missing .infisical.json. Run 'infisical init' from repo root first."
    exit 1
}

Write-Host "Exporting Infisical secrets to apps/ValyntApp/.env.local..." -ForegroundColor Green

# Export secrets
& $CLI_CMD[0] export --env=$ENVIRONMENT --format=dotenv > $ENV_FILE

Write-Host "Secrets exported to $ENV_FILE" -ForegroundColor Green
Write-Host "You can now run tests with: npx playwright test tests/e2e/high-value-user-experience.spec.ts" -ForegroundColor Cyan
