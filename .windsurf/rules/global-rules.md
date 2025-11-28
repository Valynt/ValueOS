# Global Rules - Platform Constitution

These are immutable safety and compliance rules applied to ALL agents across the platform.
They cannot be overridden by local rules.

---

## Systemic Safety

### GR-001: Block Dangerous Commands
- **Block**: DROP TABLE, TRUNCATE, DELETE without WHERE
- **Block**: rm -rf, sudo, eval()
- **Block**: Credential exposure patterns (password=, api_key=)
- **Severity**: Critical
- **Cannot be overridden**

### GR-002: Network Allowlist
- **Allow**: localhost, 127.0.0.1, *.supabase.co
- **Allow**: api.together.ai, api.openai.com, api.anthropic.com
- **Block**: All non-allowlisted outbound traffic
- **Severity**: Critical

### GR-003: Recursion Limit
- **Development**: Max 10 depth
- **Staging**: Max 7 depth
- **Production**: Max 5 depth
- Prevents infinite loops and stack overflow

---

## Data Sovereignty

### GR-010: Tenant Isolation
- ALL database operations MUST include tenant_id filter
- Cross-tenant data access is BLOCKED
- **Severity**: Critical
- **Cannot be overridden**

### GR-011: Cross-Tenant Transfer Block
- Block any operation that transfers data between tenants
- Blocked operations: copy, move, transfer, migrate, export
- **Severity**: Critical

---

## PII Protection

### GR-020: PII Detection and Redaction
Detect and block these patterns:
- **SSN**: `\d{3}-\d{2}-\d{4}`
- **Credit Cards**: Visa, MasterCard, Amex patterns
- **Phone Numbers**: US format
- **Bulk Email Lists**: Array patterns with emails
- **Severity**: Critical

### GR-021: Logging PII Prevention
- Never log PII to console, files, or monitoring services
- Auto-sanitize all log output

---

## Cost Control

### GR-030: Loop Step Limit
| Environment | Max Steps | Max LLM Calls |
|-------------|-----------|---------------|
| Development | 20 | 50 |
| Staging | 15 | 30 |
| Production | 10 | 20 |

### GR-031: Session Cost Limit
| Environment | Max Cost |
|-------------|----------|
| Development | $5.00 |
| Staging | $10.00 |
| Production | $25.00 |

### GR-032: Execution Time Limit
| Environment | Max Time |
|-------------|----------|
| Development | 60 seconds |
| Staging | 45 seconds |
| Production | 30 seconds |

---

## Audit Compliance

### GR-040: Audit Trail Requirement
All significant actions must be logged:
- create, update, delete
- export, approve, reject
- submit, publish

