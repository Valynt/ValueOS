# Docker Infrastructure Production Readiness Refinements

Implement minor fixes and optimizations to address production readiness issues identified in the Docker infrastructure code review.

## Overview

Address 7 key refinement areas across Dockerfiles, scripts, and CI/CD pipeline to improve consistency, security, and reliability without major architectural changes.

## Refinement Areas

### 1. Backend Dockerfile CMD Path Fix

**Issue:** CMD uses `src/backend/server.ts` instead of built `dist/backend/server.js`
**Impact:** Container fails to start in production
**Fix:** Update CMD to reference correct built artifact path

### 2. Frontend Dockerfile Optimization

**Issue:** Redundant security scans and overly broad COPY command
**Impact:** Slower builds and larger attack surface
**Fix:** Remove unused security scan stage and make COPY more specific

### 3. Unified Dockerfile Security Enforcement

**Issue:** Security scan doesn't fail builds, SBOM generation timing issue
**Impact:** Vulnerable images may be deployed
**Fix:** Remove `|| true` to enforce scan failures and fix SBOM generation stage

### 4. Security Gate JSON Syntax Fix

**Issue:** JSON array construction has syntax errors in breach reporting
**Impact:** Invalid JSON reports that may break downstream processing
**Fix:** Correct array building logic in report generation

### 5. Vulnerability Scoring Dependencies

**Issue:** Uses `bc` for floating point math and stores files in /tmp
**Impact:** May fail on systems without bc, temporary files may be lost
**Fix:** Use shell arithmetic where possible and improve file storage

### 6. CI/CD Threshold Consistency

**Issue:** Workflow scans only CRITICAL,HIGH but security gates use different defaults
**Impact:** Inconsistent security policies between build and deployment
**Fix:** Align Trivy severity settings with security gate thresholds

### 7. Build Script Path References

**Issue:** References `frontend.Dockerfile` and `backend.Dockerfile` but files use different names
**Impact:** Build script fails when trying to locate Dockerfiles
**Fix:** Update file references to match actual Dockerfile names

## Implementation Priority

- High: Backend CMD fix, Frontend optimization (critical for functionality)
- Medium: Security enforcement, JSON syntax, dependencies, thresholds, path references

## Testing Approach

- Validate Docker builds work correctly after changes
- Test security scanning still functions
- Verify CI/CD pipeline executes without errors
- Confirm metrics collection continues working
