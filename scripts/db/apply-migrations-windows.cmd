@echo off
REM Windows-compatible database migration script for ValueOS
setlocal enabledelayedexpansion

echo [migrations] Starting database migrations...

REM Get the script directory
set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%..\.."
cd /d "%REPO_ROOT%"

REM Default database connection
if not defined DATABASE_URL (
  set PGHOST=localhost
  set PGPORT=5432
  set PGDATABASE=valueos
  set PGUSER=valueos_dev
  set PGPASSWORD=localdev123
) else (
  for /f "tokens=2,3,4,5 delims=/:@" %%a in ("%DATABASE_URL%") do (
    set PGUSER=%%a
    set PGPASSWORD=%%b
    set PGHOST=%%c
    set PGPORT=%%d
    set PGDATABASE=%%e
  )
)

echo [migrations] Connecting to %PGHOST%:%PGPORT%/%PGDATABASE%

REM Check Docker
docker ps >nul 2>nul
if errorlevel 1 (
  echo [migrations] ERROR: Docker is not running
  exit /b 1
)

REM Create tracking table
docker exec compose-postgres-1 psql -U %PGUSER% -d %PGDATABASE% -c "CREATE TABLE IF NOT EXISTS app_schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());" >nul 2>&1

REM Create roles
echo [migrations] Ensuring required database roles exist...
docker exec compose-postgres-1 psql -U %PGUSER% -d %PGDATABASE% -c "DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END; $$; DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END; $$; DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END; $$; DO $$ BEGIN CREATE ROLE supabase_admin; EXCEPTION WHEN duplicate_object THEN NULL; END; $$;" >nul 2>&1

REM Create Supabase-compatible auth schema
echo [migrations] Creating Supabase-compatible auth schema...
docker exec compose-postgres-1 psql -U %PGUSER% -d %PGDATABASE% -c "CREATE SCHEMA IF NOT EXISTS auth;" >nul 2>&1
docker exec compose-postgres-1 psql -U %PGUSER% -d %PGDATABASE% -c "CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS 'SELECT NULL::UUID';" >nul 2>&1

REM Create auth.users with full schema
docker exec compose-postgres-1 psql -U %PGUSER% -d %PGDATABASE% -c "DROP TABLE IF EXISTS auth.identities; DROP TABLE IF EXISTS auth.users; CREATE TABLE auth.users (instance_id UUID, id UUID PRIMARY KEY DEFAULT gen_random_uuid(), aud TEXT, role TEXT, email TEXT, encrypted_password TEXT, email_confirmed_at TIMESTAMPTZ, raw_app_meta_data JSONB, raw_user_meta_data JSONB, is_super_admin BOOLEAN, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), is_sso_user BOOLEAN DEFAULT FALSE);" >nul 2>&1

REM Create auth.identities
docker exec compose-postgres-1 psql -U %PGUSER% -d %PGDATABASE% -c "CREATE TABLE auth.identities (provider_id TEXT, user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, identity_data JSONB, provider TEXT, last_sign_in_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (provider_id, provider));" >nul 2>&1

REM Create security schema
docker exec compose-postgres-1 psql -U %PGUSER% -d %PGDATABASE% -c "CREATE SCHEMA IF NOT EXISTS security; CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT true; $$; CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT true; $$;" >nul 2>&1

echo [migrations] Applying migration files...

REM Set migrations directory
set "MIGRATIONS_DIR=%REPO_ROOT%\infra\supabase\supabase\migrations"
set MIGRATION_COUNT=0
set APPLIED_COUNT=0
set SKIPPED_COUNT=0
set FAILED_COUNT=0

REM Process each SQL file
for %%f in ("%MIGRATIONS_DIR%\*.sql") do (
  set /a MIGRATION_COUNT+=1
  set "FILENAME=%%~nxf"
  
  REM Check if already applied
  docker exec compose-postgres-1 psql -U %PGUSER% -d %PGDATABASE% -t -c "SELECT 1 FROM app_schema_migrations WHERE filename = '!FILENAME!';" 2>nul | findstr "1" >nul
  if errorlevel 1 (
    echo [migrations] Applying %%~nxf...
    
    docker cp "%%f" compose-postgres-1:/tmp/migration.sql >nul 2>&1
    docker exec compose-postgres-1 psql -U %PGUSER% -d %PGDATABASE% -v ON_ERROR_STOP=0 -f /tmp/migration.sql >"%TEMP%\migration_!MIGRATION_COUNT!.log" 2>&1
    
    findstr /i "ERROR:" "%TEMP%\migration_!MIGRATION_COUNT!.log" >nul
    if !ERRORLEVEL! EQU 0 (
      findstr /i "policy.*already exists\|relation.*already exists\|constraint.*already exists" "%TEMP%\migration_!MIGRATION_COUNT!.log" >nul
      if !ERRORLEVEL! EQU 0 (
        echo [migrations] Applied %%~nxf ^(with warnings^)
        set /a APPLIED_COUNT+=1
      ) else (
        echo [migrations] WARNING: %%~nxf had errors
        set /a FAILED_COUNT+=1
      )
    ) else (
      echo [migrations] Applied %%~nxf
      set /a APPLIED_COUNT+=1
    )
    
    docker exec compose-postgres-1 psql -U %PGUSER% -d %PGDATABASE% -c "INSERT INTO app_schema_migrations (filename) VALUES ('!FILENAME!') ON CONFLICT DO NOTHING;" >nul 2>&1
    del "%TEMP%\migration_!MIGRATION_COUNT!.log" >nul 2>&1
  ) else (
    set /a SKIPPED_COUNT+=1
  )
)

echo.
echo [migrations] ==========================================
echo [migrations] Migration Summary:
echo [migrations]   Total files: %MIGRATION_COUNT%
echo [migrations]   Applied: %APPLIED_COUNT%
echo [migrations]   Skipped: %SKIPPED_COUNT%
echo [migrations]   Failed: %FAILED_COUNT%
echo [migrations] ==========================================

if %FAILED_COUNT% GTR 0 (
  echo [migrations] WARNING: Some migrations had errors.
  exit /b 0
) else (
  echo [migrations] All migrations processed successfully.
  exit /b 0
)
