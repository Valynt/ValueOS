# Lifeguard Issue Fixes

**Date:** December 5, 2025  
**Issues Found:** 6  
**Status:** ✅ All Fixed

---

## Issues and Resolutions

### 1. Unsupported 'extends' Directive (3 instances)

**Files Affected:**
- `infrastructure/docker-compose.mtls.yml` lines 84-86 (app-mtls)
- `infrastructure/docker-compose.mtls.yml` lines 130-132 (postgres-mtls)
- `infrastructure/docker-compose.mtls.yml` lines 159-161 (redis-mtls)

**Issue:**
The `extends` directive was deprecated in Docker Compose v3 and is not supported in v3.8.

**Root Cause:**
Attempted to extend services from `docker-compose.dev.yml` using the deprecated `extends` syntax:
```yaml
app-mtls:
  extends:
    file: docker-compose.dev.yml
    service: app
```

**Resolution:**
Docker Compose v3+ supports **automatic service merging** when using multiple `-f` files. Changed from `extends` to service overrides:

```yaml
# Before (WRONG)
app-mtls:
  extends:
    file: docker-compose.dev.yml
    service: app
  volumes:
    - ./certs:/app/certs

# After (CORRECT)
app:
  volumes:
    # Appends to base volumes from docker-compose.dev.yml
    - ./infrastructure/tls/certs/app-cert.pem:/app/certs/cert.pem:ro
```

**How It Works:**
When you run:
```bash
docker-compose -f docker-compose.dev.yml -f infrastructure/docker-compose.mtls.yml up
```

Docker Compose automatically:
1. Loads `app` service definition from `docker-compose.dev.yml`
2. Merges the `app` overrides from `docker-compose.mtls.yml`
3. Volumes, environment variables, and labels are **appended** (not replaced)

---

### 2. Incorrect Certificate Mount Paths (3 instances)

**Files Affected:**
- `infrastructure/docker-compose.mtls.yml` lines 94-96 (app volumes)
- `infrastructure/docker-compose.mtls.yml` lines 138-140 (postgres volumes)
- `infrastructure/docker-compose.mtls.yml` lines 167-169 (redis volumes - not flagged but fixed preemptively)

**Issue:**
Certificate paths were relative to the wrong directory.

**Root Cause:**
Used `./tls/certs/` as the certificate path, incorrectly assuming Docker Compose resolves paths relative to the compose file location. However, Docker Compose resolves paths relative to the current working directory (project root), so the correct path is `./infrastructure/tls/certs/`.

**Resolution:**
```yaml
# Before (WRONG - incorrect path relative to project root)
volumes:
  - ./tls/certs/app-cert.pem:/app/certs/cert.pem:ro

# After (CORRECT - path is relative to project root where docker-compose is invoked)
volumes:
  - ./infrastructure/tls/certs/app-cert.pem:/app/certs/cert.pem:ro
```

**Path Resolution:**
When running from project root:
```bash
docker-compose -f docker-compose.dev.yml -f infrastructure/docker-compose.mtls.yml up
```

Paths are resolved from the **current working directory** (project root), not the compose file location. Since the TLS directory is at `./infrastructure/tls/`, the correct path is `./infrastructure/tls/certs/`.

---

## Additional Improvements

### Removed Redundant Definitions

**Before:**
```yaml
networks:
  valuecanvas-network:
    external: true

volumes:
  postgres-data:
    external: true
  redis-data:
    external: true

secrets:
  db_password:
    file: ./secrets/dev_db_password.txt
  redis_password:
    file: ./secrets/dev_redis_password.txt
```

**After:**
```yaml
# Networks, volumes, and secrets are inherited from docker-compose.dev.yml
# No need to redefine when using multiple compose files
```

**Reason:**
- Networks, volumes, and secrets are automatically inherited when using multiple compose files
- Redefining them as `external: true` would cause errors if they don't exist
- Cleaner, DRY approach

---

## Testing & Verification

### 1. Validate Compose File Syntax
```bash
docker-compose -f docker-compose.dev.yml \
               -f infrastructure/docker-compose.mtls.yml config
```

### 2. Check Service Overrides
```bash
docker-compose -f docker-compose.dev.yml \
               -f infrastructure/docker-compose.mtls.yml config --services
```

Should show:
- `traefik` (new service)
- `app` (merged from both files)
- `postgres` (merged from both files)
- `redis` (merged from both files)

### 3. Verify Volume Mounts
```bash
docker-compose -f docker-compose.dev.yml \
               -f infrastructure/docker-compose.mtls.yml config | grep -A5 "volumes:"
```

Should show both base volumes AND certificate mounts.

---

## Docker Compose File Merging Behavior

When using multiple compose files with `-f`, Docker Compose merges them with these rules:

| Element | Merge Behavior |
|---------|----------------|
| **volumes** | Appended (both base and override volumes exist) |
| **environment** | Merged (override values take precedence) |
| **labels** | Merged (override values take precedence) |
| **command** | Replaced (override completely replaces base) |
| **ports** | Appended |
| **networks** | Appended |

**Example:**
```yaml
# docker-compose.dev.yml
app:
  volumes:
    - ./src:/app/src
  environment:
    NODE_ENV: development

# docker-compose.mtls.yml
app:
  volumes:
    - ./certs:/app/certs
  environment:
    TLS_ENABLED: "true"

# Result (merged)
app:
  volumes:
    - ./src:/app/src          # From base
    - ./certs:/app/certs      # From override
  environment:
    NODE_ENV: development     # From base
    TLS_ENABLED: "true"       # From override
```

---

## Best Practices for Multi-File Compose

1. **Base file** (`docker-compose.dev.yml`): Common configuration
2. **Override files** (`docker-compose.mtls.yml`): Environment-specific additions
3. **Never use `extends`** in Docker Compose v3+
4. **Use service names** that match the base file to trigger merging
5. **Use absolute or project-root-relative paths** for volume mounts
6. **Test with `docker-compose config`** before deploying

---

## Related Documentation

- [Docker Compose File Merging](https://docs.docker.com/compose/multiple-compose-files/)
- [Docker Compose v3 Specification](https://docs.docker.com/compose/compose-file/compose-file-v3/)
- Sprint 5-6 Summary: `SPRINT_5-6_SUMMARY.md`
- mTLS Setup Guide: `infrastructure/tls/certs/README.md`

---

## Summary

✅ **All 6 Lifeguard issues resolved**
- Removed deprecated `extends` directives
- Fixed certificate mount paths
- Cleaned up redundant definitions
- Verified with `docker-compose config`

The mTLS configuration now properly leverages Docker Compose v3.8's native multi-file merging capabilities.
