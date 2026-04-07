#!/usr/bin/env pwsh
# Run Playwright E2E tests with Infisical secrets
# Usage: .\scripts\e2e\run-tests-with-infisical.ps1

$ErrorActionPreference = "Stop"
$PROJECT_ROOT = Resolve-Path "$PSScriptRoot\..\.."
$ENVIRONMENT = $env:INFISICAL_ENVIRONMENT ?? "dev"

# Determine how to run infisical
$CLI_CMD = @()
$infisicalPath = (Get-Command infisical -ErrorAction SilentlyContinue)?.Source

if ($infisicalPath) {
    $CLI_CMD = @("infisical")
} elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-Host "[run-tests-with-infisical] 'infisical' not found; using 'pnpm dlx @infisical/cli'" -ForegroundColor Yellow
    $CLI_CMD = @("pnpm", "dlx", "@infisical/cli")
} else {
    Write-Error "[run-tests-with-infisical] Neither 'infisical' nor 'pnpm' found. Please install pnpm first."
    exit 1
}

# Check for .infisical.json
if (-not (Test-Path "$PROJECT_ROOT\.infisical.json")) {
    Write-Error "[run-tests-with-infisical] Missing .infisical.json. Run 'infisical init' from the repo root first."
    exit 1
}

# Set environment variables
$env:SECRETS_PROVIDER = "infisical"
$env:APP_ENV = "local"
$env:INFISICAL_ENVIRONMENT = $ENVIRONMENT

Write-Host "[run-tests-with-infisical] Running Playwright tests with Infisical secrets..." -ForegroundColor Green

# Run tests with infisical injecting secrets
& $CLI_CMD[0] run --env=$ENVIRONMENT -- npx playwright test tests/e2e/high-value-user-experience.spec.ts --project=chromium --workers=1
