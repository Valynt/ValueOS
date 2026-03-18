---
name: tenant-isolation-checker
description: Verify tenant isolation in database queries and memory operations. Use to ensure compliance with RLS policies and prevent data leakage between tenants.
license: MIT
compatibility: ValueOS multi-tenant system
metadata:
  author: ValueOS
  version: "1.0"
  generatedBy: "1.2.0"
---

# Tenant Isolation Checker Skill

Verifies tenant isolation in database queries and memory operations to ensure compliance with RLS policies and prevent data leakage between tenants.

## When to Use

- Before committing database query changes
- During code reviews to verify tenant isolation
- After refactoring database operations
- When implementing new multi-tenant features
- During security audits and compliance checks
- Before production deployments

## Input

- **scanPath**: File path or directory to scan (default: current directory)
- **fixMode**: Auto-fix mode (--fix flag)
- **strictMode**: Strict checking mode (--strict flag)
- **outputFormat**: Output format (text, json, csv)

## Output

Comprehensive isolation report including:

- Query analysis results
- Violation details with line numbers
- Risk assessment scores
- Auto-fix suggestions
- Compliance status

## Implementation Steps

1. **Parse and Validate Input**
   - Validate scan path exists
   - Check file permissions
   - Set up output formatting

2. **Scan Database Queries**
   - Find all Supabase query operations
   - Check for organization_id/tenant_id filters
   - Analyze join operations for tenant isolation
   - Verify RLS policy compliance

3. **Analyze Memory Operations**
   - Check MemorySystem queries for tenant metadata
   - Verify vector search tenant filtering
   - Analyze memory storage operations

4. **Check API Endpoints**
   - Verify request tenant context propagation
   - Check service layer tenant isolation
   - Validate response filtering

5. **Generate Compliance Report**
   - Calculate risk scores for violations
   - Provide specific fix recommendations
   - Generate compliance metrics

6. **Auto-fix Mode (if enabled)**
   - Apply safe fixes automatically
   - Create backup files
   - Generate fix summary

## Detection Patterns

### Database Query Violations

```typescript
// ❌ VIOLATION: Missing organization_id filter
await supabase.from("workflows").select("*").eq("status", "active");

// ✅ COMPLIANT: Proper tenant isolation
await supabase
  .from("workflows")
  .select("*")
  .eq("organization_id", orgId)
  .eq("status", "active");
```

### Memory System Violations

```typescript
// ❌ VIOLATION: Missing tenant metadata
await memorySystem.query(embedding, { limit: 10 });

// ✅ COMPLIANT: Proper tenant filtering
await memorySystem.query(embedding, {
  metadata: { tenant_id: orgId },
  limit: 10,
});
```

### API Context Violations

```typescript
// ❌ VIOLATION: Not using request tenant context
const tenantId = getTenantFromSomewhereElse();

// ✅ COMPLIANT: Using request tenant context
const tenantId = req.tenantId;
```

## Example Usage

```bash
# Scan current directory for isolation issues
/tenant-isolation-checker

# Scan specific file with auto-fix
/tenant-isolation-checker --scanPath="packages/backend/src/services/WorkflowService.ts" --fix

# Strict mode scan with JSON output
/tenant-isolation-checker --scanPath="packages/backend/src" --strict --outputFormat=json

# Check before commit (common patterns)
/tenant-isolation-checker --scanPath="." --outputFormat=text | grep "VIOLATION"
```

## Risk Assessment

### High Risk (Score 9-10)

- Missing tenant filters on sensitive data
- Cross-tenant data exposure
- Service_role bypass without justification

### Medium Risk (Score 5-8)

- Inconsistent tenant filtering
- Missing tenant metadata in memory operations
- Potential data leakage in joins

### Low Risk (Score 1-4)

- Configuration data without tenant context
- System-level operations
- Public/anonymous data access

## Auto-fix Capabilities

### Safe Fixes (Applied Automatically)

- Add organization_id filters to queries
- Include tenant metadata in memory operations
- Add tenant context to service calls

### Complex Fixes (Require Review)

- Refactor complex join operations
- Update service interfaces
- Modify API endpoint signatures

## Integration Points

- **CI/CD Pipeline**: Pre-commit hooks and PR checks
- **Code Review**: Automated review comments
- **Security Scanning**: Part of security audit process
- **Compliance Reporting**: Generates compliance metrics

## Error Handling

- Graceful handling of syntax errors
- Clear violation explanations
- Suggested fix implementations
- Backup file creation for auto-fixes

## Best Practices Enforced

- Always filter by organization_id in database queries
- Include tenant metadata in all memory operations
- Use request tenant context in API endpoints
- Validate RLS policies are properly configured
- Ensure service_role usage is justified and audited

## Performance Considerations

- Efficient file parsing and analysis
- Caching of analysis results
- Parallel processing for large codebases
- Incremental scanning for changed files
