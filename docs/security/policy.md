# Security Policy and Controls

## Overview

ValueOS implements comprehensive security controls aligned with SOC 2 Type 1 requirements. This document outlines our access controls, audit trails, and compliance measures designed to ensure data security, availability, and integrity.

## 1. Access Controls

### 1.1 Authentication and Authorization

**Authentication Methods:**
- Supabase Auth for user authentication
- JWT-based session management
- Multi-factor authentication support for admin users

**Authorization Framework:**
- Role-based access control (RBAC) with predefined roles:
  - `viewer`: Read-only access to assigned resources
  - `user`: Standard access with create/edit permissions
  - `manager`: Team management capabilities
  - `admin`: Full tenant administration access

### 1.2 Data Isolation (Row Level Security)

**Tenant Isolation:**
- All tables implement Row Level Security (RLS) policies
- Users can only access data within their tenant context
- Tenant context established via `tenant_id` in JWT claims

**RLS Policies by Table:**

| Table | RLS Policy | Description |
|-------|------------|-------------|
| `tenants` | No RLS | Public reference data |
| `users` | `tenant_id = current_tenant_id` | Users can only see users in their tenant |
| `value_cases` | `tenant_id = current_tenant_id` | Cases isolated by tenant |
| `opportunities` | Inherited from value_cases | Automatic isolation |
| `value_drivers` | Inherited from value_cases | Automatic isolation |
| `financial_models` | Inherited from value_cases | Automatic isolation |
| `realization_metrics` | Inherited from value_cases | Automatic isolation |
| `agent_executions` | `tenant_id = current_tenant_id` | Executions isolated by tenant |
| `agent_memory` | `tenant_id = current_tenant_id` | Memory isolated by tenant |
| `benchmarks` | No RLS | Public industry data |

**Policy Implementation:**
```sql
CREATE POLICY tenant_isolation ON value_cases
FOR ALL USING (tenant_id = current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id');
```

### 1.3 Network Security

**API Gateway Controls:**
- Caddy reverse proxy with rate limiting
- Request size limits (1MB max header)
- Timeout configurations (30s read, 15s header)
- Health check endpoints for monitoring

**Environment Segmentation:**
- Development, staging, and production environments
- Network isolation between environments
- Secure communication channels

## 2. Audit Trails

### 2.1 System Activity Logging

**Agent Execution Audit:**
- All agent invocations logged in `agent_executions` table
- Captures: agent_name, input, output, confidence scores, execution time
- Performance metrics and cost tracking
- Status tracking (success/error/timeout)

**User Action Logging:**
- Authentication events via Supabase Auth
- Session management and access patterns
- API request logging with structured JSON format

**Database Audit:**
- Supabase provides automatic audit logging
- Schema changes tracked via migrations
- Query performance monitoring

### 2.2 Monitoring and Alerting

**Observability Stack:**
- Prometheus for metrics collection
- Grafana for visualization and alerting
- Custom metrics exporters for application-specific KPIs

**Key Metrics Monitored:**
- HTTP request rates (4xx/5xx errors)
- Response latency percentiles
- Active user sessions
- Agent performance metrics
- Database connection health

**Alerting Rules:**
- 5xx error rate > 5% triggers rollback
- High latency thresholds
- Security event detection

## 3. Data Protection

### 3.1 Encryption

**At Rest:**
- Database encryption via Supabase
- File storage encryption
- Secure key management

**In Transit:**
- TLS 1.3 for all external communications
- Internal service communication encryption
- Certificate management via ACME

### 3.2 Data Retention

**Audit Data:**
- Agent executions: Retained for 2 years
- User activity logs: Retained for 3 years
- System metrics: Retained for 1 year

**Business Data:**
- Tenant data retained per contract terms
- Automated backup cycles (daily)
- Point-in-time recovery capabilities

## 4. Incident Response

### 4.1 Security Incident Process

1. **Detection:** Automated monitoring alerts
2. **Assessment:** Security team evaluation
3. **Containment:** Immediate isolation measures
4. **Recovery:** System restoration and validation
5. **Lessons Learned:** Post-mortem analysis

### 4.2 Business Continuity

**Blue-Green Deployments:**
- Zero-downtime deployment capability
- Automatic rollback on failure detection
- Traffic switching via Caddy dynamic config

**Disaster Recovery:**
- Multi-region database replication
- Automated backup restoration
- Recovery time objectives (RTO: 4 hours, RTO: 1 hour)

## 5. Compliance Evidence

### 5.1 SOC 2 Type 1 Checklist

- [x] **CC1.1** - COSO Internal Control Framework mapping
- [x] **CC2.1** - Communication and information
- [x] **CC3.1** - Commitment to competence
- [x] **CC4.1** - Governing body and management oversight
- [x] **CC5.1** - Risk assessment process
- [x] **CC6.1** - Control activities (access controls, RLS)
- [x] **CC7.1** - Monitoring activities (audit trails, metrics)
- [x] **CC8.1** - Information and communication
- [x] **CC9.1** - Internal control deficiencies

### 5.2 Evidence Documentation

**Access Control Evidence:**
- RLS policy definitions in database migrations
- Role definitions and permissions matrix
- Authentication logs and session management

**Audit Trail Evidence:**
- Database schema for audit tables
- Monitoring dashboard configurations
- Alert rule definitions and response procedures

**Testing Evidence:**
- Automated RLS leak testing (100% table coverage)
- Penetration testing reports
- Security control validation procedures

## 6. Continuous Improvement

### 6.1 Security Assessments

**Quarterly Reviews:**
- Access control effectiveness
- Audit trail completeness
- Incident response capabilities

**Annual Assessments:**
- SOC 2 Type 2 readiness
- Third-party security audits
- Compliance gap analysis

### 6.2 Training and Awareness

**Security Training:**
- Annual security awareness training for all employees
- Role-specific security training
- Incident response drills

**Documentation Updates:**
- Regular policy review and updates
- Change management for security controls
- Version control for all security documentation

---

**Last Updated:** January 2026
**Next Review:** April 2026
**Document Owner:** Principal Engineer / Legal
**Approved By:** Security Committee
