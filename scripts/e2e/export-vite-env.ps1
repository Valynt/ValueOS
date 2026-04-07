#!/usr/bin/env pwsh
# Export Infisical secrets to .env.local with VITE_ prefix for Playwright tests
# Usage: .\scripts\e2e\export-vite-env.ps1

$ErrorActionPreference = "Stop"
$PROJECT_ROOT = Resolve-Path "$PSScriptRoot\..\.."
$ENVIRONMENT = $env:INFISICAL_ENVIRONMENT ?? "dev"
$ENV_FILE = "$PROJECT_ROOT\apps\ValyntApp\.env.local"

Write-Host "Exporting Infisical secrets to apps/ValyntApp/.env.local with VITE_ prefix..." -ForegroundColor Green

# Get secrets in dotenv format and create VITE_ prefixed versions
$secretsOutput = pnpm dlx @infisical/cli secrets --env=$ENVIRONMENT --output dotenv 2>$null

$envContent = @()
$envContent += "# Auto-generated from Infisical on $(Get-Date)"
$envContent += ""

# Parse and convert secrets
foreach ($line in $secretsOutput -split "`n") {
    if ($line -match '^\s*#') { continue }  # Skip comments
    if ($line -match '^(\w+)=(.*)$') {
        $key = $matches[1]
        $value = $matches[2]

        # Map backend secrets to VITE_ prefixed versions for frontend
        switch ($key) {
            "SUPABASE_URL" {
                $envContent += "VITE_SUPABASE_URL=$value"
            }
            "SUPABASE_ANON_KEY" {
                $envContent += "VITE_SUPABASE_ANON_KEY=$value"
            }
            "SUPABASE_SERVICE_ROLE_KEY" {
                # Service role key should NOT be exposed to browser, skip
            }
            default {
                # Pass through other secrets as-is
                $envContent += "$key=$value"
            }
        }
    }
}

# Also add app-specific VITE_ variables
$envContent += ""
$envContent += "# App Config"
$envContent += "VITE_RELEASE=dev"
$envContent += "VITE_API_BASE_URL=http://localhost:8000"
$envContent += "VITE_ANALYTICS_ENABLED=false"
$envContent += "VITE_ENABLE_CIRCUIT_BREAKER=true"
$envContent += "VITE_ENABLE_INPUT_SANITIZATION=true"
$envContent += "VITE_ENABLE_RATE_LIMITING=true"
$envContent += "VITE_ENABLE_SAFE_JSON_PARSER=true"

# Write to file
$envContent -join "`n" | Out-File -FilePath $ENV_FILE -Encoding utf8

Write-Host "Secrets exported to $ENV_FILE" -ForegroundColor Green
Write-Host "Key mappings:" -ForegroundColor Cyan
Write-Host "  SUPABASE_URL -> VITE_SUPABASE_URL" -ForegroundColor Gray
Write-Host "  SUPABASE_ANON_KEY -> VITE_SUPABASE_ANON_KEY" -ForegroundColor Gray
Write-Host ""
Write-Host "Run tests now with: npx playwright test tests/e2e/high-value-user-experience.spec.ts" -ForegroundColor Yellow
