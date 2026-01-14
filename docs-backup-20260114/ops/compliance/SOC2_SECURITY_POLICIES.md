# SOC 2 Type II Policy Documentation

**Version**: 1.0  
**Effective Date**: January 1, 2026  
**Last Review**: December 29, 2025  
**Next Review**: March 29, 2026  
**Owner**: Security Team  
**Approver**: Chief Security Officer

---

## Table of Contents

1. [Data Classification and Handling Policy](#1-data-classification-and-handling-policy)
2. [Incident Response Policy](#2-incident-response-policy)
3. [Access Control Policy](#3-access-control-policy)
4. [Change Management Policy](#4-change-management-policy)
5. [Business Continuity and Disaster Recovery](#5-business-continuity-and-disaster-recovery)
6. [Vendor Management Policy](#6-vendor-management-policy)
7. [Encryption and Key Management](#7-encryption-and-key-management)
8. [Monitoring and Logging Policy](#8-monitoring-and-logging-policy)

---

## 1. Data Classification and Handling Policy

### Purpose

Establish a framework for classifying and protecting data based on sensitivity and regulatory requirements.

### Scope

All data processed, stored, or transmitted by ValueOS systems.

### Data Classification Levels

#### Level 1: Public

- **Definition**: Information intended for public disclosure
- **Examples**: Marketing materials, public documentation
- **Protection**: Standard access controls
- **Retention**: No specific requirements

#### Level 2: Internal

- **Definition**: Information for internal use only
- **Examples**: Internal documentation, process guidelines
- **Protection**: Authentication required, internal network only
- **Retention**: 3 years minimum

#### Level 3: Confidential

- **Definition**: Sensitive business information
- **Examples**: Financial projections, business strategies, customer data
- **Protection**: Encryption at rest and in transit, role-based access
- **Retention**: 7 years (regulatory compliance)
- **Handling**:
  - Access logged and audited
  - MFA required for access
  - No external sharing without approval

#### Level 4: Restricted (PII/PHI)

- **Definition**: Regulated personally identifiable information
- **Examples**: SSN, credit cards, health records, EU citizens' data (GDPR)
- **Protection**: AES-256 encryption, database-level encryption, tokenization
- **Retention**: Minimal necessary, right to deletion honored
- **Handling**:
  - Strict need-to-know access
  - All access logged with justification
  - Data minimization enforced
  - Breach notification within 72 hours

### Data Lifecycle Management

```
Collection → Processing → Storage → Access → Disposal
     ↓            ↓           ↓         ↓         ↓
  Minimal    Purpose      Encrypted  Audited  Secure
  Required   Limitation   At Rest    Access   Deletion
```

### Data Handling Requirements

| Classification | Encryption         | Access Control   | Audit Logging | Retention  |
| -------------- | ------------------ | ---------------- | ------------- | ---------- |
| Public         | Optional           | None             | No            | Indefinite |
| Internal       | TLS in transit     | Authentication   | Optional      | 3 years    |
| Confidential   | TLS + AES-256      | RBAC + MFA       | Yes           | 7 years    |
| Restricted     | E2E + Tokenization | Zero Trust + MFA | All access    | Minimal    |

### Compliance Mappings

- **SOC 2 CC6.1**: Logical and physical access controls
- **GDPR Article 32**: Security of processing
- **HIPAA §164.312**: Technical safeguards

---

## 2. Incident Response Policy

### Purpose

Define procedures for detecting, responding to, and recovering from security incidents.

### Incident Severity Levels

#### P0 - Critical

- **Definition**: Active data breach, system-wide outage, ransomware
- **Response Time**: Immediate (< 15 minutes)
- **Escalation**: CEO, CSO, Legal immediately
- **Communication**: Customer notification within 4 hours

#### P1 - High

- **Definition**: Unauthorized access attempt, service degradation
- **Response Time**: < 1 hour
- **Escalation**: Security team, Engineering lead
- **Communication**: Internal stakeholders within 2 hours

#### P2 - Medium

- **Definition**: Policy violations, suspicious activity
- **Response Time**: < 4 hours
- **Escalation**: Security team
- **Communication**: Weekly security report

#### P3 - Low

- **Definition**: Minor vulnerabilities, informational
- **Response Time**: < 24 hours
- **Escalation**: Security analyst
- **Communication**: Monthly roundup

### Incident Response Process

```
1. DETECTION
   ↓
2. TRIAGE (Severity assessment)
   ↓
3. CONTAINMENT (Isolate affected systems)
   ↓
4. ERADICATION (Remove threat)
   ↓
5. RECOVERY (Restore normal operations)
   ↓
6. POST-MORTEM (Document lessons learned)
```

### Incident Response Team (IRT)

| Role                | Responsibility            | Contact                 |
| ------------------- | ------------------------- | ----------------------- |
| Incident Commander  | Overall coordination      | oncall@valueos.com      |
| Security Lead       | Technical investigation   | security@valueos.com    |
| Communications Lead | Stakeholder notifications | comms@valueos.com       |
| Legal Counsel       | Regulatory compliance     | legal@valueos.com       |
| Engineering Lead    | System remediation        | engineering@valueos.com |

### Breach Notification Requirements

**GDPR (EU customers)**:

- Notification to supervisory authority within 72 hours
- Customer notification without undue delay if high risk

**CCPA (California customers)**:

- Notification to California AG and affected individuals without unreasonable delay

**SOC 2**:

- Notification to affected customers and auditors
- Incident documented in audit report

### Post-Incident Review

Within 5 business days of incident resolution:

- Root cause analysis document
- Timeline of events
- Remediation actions taken
- Preventive measures implemented
- Process improvements identified

### Compliance Mappings

- **SOC 2 CC7.3**: Incident response procedures
- **GDPR Article 33**: Breach notification
- **NIST CSF PR.IP-9**: Response and recovery plans

---

## 3. Access Control Policy

### Purpose

Ensure that access to systems and data is granted based on the principle of least privilege.

### Access Principles

1. **Zero Trust**: Verify explicitly, assume breach, least privilege
2. **Need-to-Know**: Access only to required resources
3. **Time-Bound**: Regular review and revocation
4. **Auditable**: All access logged and monitored

### Role-Based Access Control (RBAC)

Implemented via `/src/types/security.ts`:

| Role      | Permissions                          | Use Case              |
| --------- | ------------------------------------ | --------------------- |
| ADMIN     | All permissions                      | System administrators |
| CFO       | VIEW_FINANCIALS, APPROVE_RISK        | Financial executives  |
| DEVELOPER | VIEW_TECHNICAL_DEBT, EXECUTE_AGENT   | Engineering team      |
| ANALYST   | VIEW_FINANCIALS, VIEW_TECHNICAL_DEBT | Business analysts     |
| AGENT     | EXECUTE_AGENT                        | AI autonomous agents  |

### Authentication Requirements

**Human Users**:

- Minimum 16-character password OR passkey
- MFA required for production access
- Session timeout: 8 hours (4 hours for admin)
- Failed login lockout: 5 attempts = 15-minute lockout

**Service Accounts (AI Agents)**:

- API key + JWT token
- Short-lived tokens (1 hour max)
- Scoped permissions
- Credential rotation every 90 days

### Access Request Process

```
1. Request submitted via ServiceNow (or approved ticketing system)
   ↓
2. Manager approval required
   ↓
3. Security review (for elevated access)
   ↓
4. Provisioning (automated via IaC)
   ↓
5. Access granted + notification
   ↓
6. Quarterly access review
```

### Access Revocation

**Immediate revocation upon**:

- Termination
- Role change
- Security incident
- Policy violation

**Automated checks**:

- Inactive accounts disabled after 90 days
- Stale permissions removed after 180 days
- Admin access reviewed quarterly

### Production Access Controls

- All production access via bastion host
- Session recording enabled
- Just-in-time (JIT) access for emergency changes
- Break-glass procedures documented

### Compliance Mappings

- **SOC 2 CC6.1, CC6.2**: Logical access controls
- **GDPR Article 32(1)(b)**: Ongoing confidentiality
- **ISO 27001 A.9**: Access control

---

## 4. Change Management Policy

### Purpose

Ensure all changes to production systems are reviewed, tested, and documented.

### Change Classifications

#### Standard Change

- **Definition**: Pre-approved, low-risk changes
- **Examples**: Scaling instances, routine patches
- **Approval**: Automated via CI/CD
- **Testing**: Unit + integration tests

#### Normal Change

- **Definition**: Planned, documented changes
- **Examples**: Feature deployments, configuration updates
- **Approval**: Tech lead + peer review
- **Testing**: Full test suite + staging deployment

#### Emergency Change

- **Definition**: Urgent fixes for critical issues
- **Examples**: Security patches, P0 incident remediation
- **Approval**: On-call engineer + post-hoc review
- **Testing**: Smoke tests minimum

### Change Request Process

```
1. RFC Created (Jira/Linear/GitHub)
   ↓
2. Impact Analysis (blast radius, rollback plan)
   ↓
3. Peer Review (2+ approvers for production)
   ↓
4. Testing (staging environment)
   ↓
5. CAB Approval (for high-risk changes)
   ↓
6. Deployment (blue-green or canary)
   ↓
7. Verification (smoke tests, monitoring)
   ↓
8. Documentation (changelog, runbook update)
```

### Change Advisory Board (CAB)

**Members**: CTO, Security Lead, SRE Lead, Product Manager

**Meeting Frequency**: Weekly (or ad-hoc for emergency changes)

**Scope**: Reviews high-risk changes (> 10% of user base)

### Deployment

Windows

- **Production**: Tuesday/Thursday 10 AM - 2 PM PST
- **Staging**: Anytime
- **Hotfixes**: Anytime with CAB approval

**Blackout Periods**:

- Major holidays
- End of fiscal quarter (last 3 days)
- During active incidents

### Rollback Procedures

- All deployments must have rollback plan
- Automated rollback triggers:
  - Error rate > 5%
  - Latency > 2x baseline
  - Critical alert fired

### Compliance Mappings

- **SOC 2 CC8.1**: Change management procedures
- **ISO 27001 A.12.1.2**: Change management
- **ITIL Change Management**: Industry best practice

---

## 5. Business Continuity and Disaster Recovery

### Purpose

Ensure ValueOS can continue operations during and after a disaster.

### Recovery Objectives

| System         | RTO        | RPO        | Criticality |
| -------------- | ---------- | ---------- | ----------- |
| Production API | 1 hour     | 15 minutes | Critical    |
| Database       | 1 hour     | 5 minutes  | Critical    |
| Auth System    | 30 minutes | 1 minute   | Critical    |
| Analytics      | 4 hours    | 1 hour     | High        |
| Reporting      | 24 hours   | 4 hours    | Medium      |

**RTO** = Recovery Time Objective (max downtime)  
**RPO** = Recovery Point Objective (max data loss)

### Backup Strategy

**Database Backups**:

- Continuous: Point-in-time recovery (Supabase)
- Snapshots: Every 6 hours
- Retention: 30 days hot, 1 year cold storage
- Encryption: AES-256 at rest

**Application Backups**:

- Infrastructure as Code (Terraform state)
- Configuration stored in Git
- Secrets in Supabase Vault (encrypted)

**Testing**:

- Backup restoration test: Monthly
- Full DR drill: Quarterly
- Documented in runbook

### Disaster Scenarios

#### Scenario 1: Database Failure

1. Automatic failover to replica (Supabase HA)
2. Verify data consistency
3. Monitor replication lag
4. Investigate root cause

#### Scenario 2: Region Outage

1. Failover to secondary region (if multi-region)
2. Update DNS to new region
3. Verify application health
4. Monitor cost impact

#### Scenario 3: Ransomware Attack

1. Isolate affected systems
2. Restore from clean backup
3. Rotate all credentials
4. Forensic analysis
5. Law enforcement notification

### Communication Plan

**Internal**:

- Status page: status.valueos.com
- Slack #incidents channel
- Email to all-hands@valueos.com

**External**:

- Customer status page
- Email to affected customers
- Social media updates (if widespread)

###Compliance Mappings

- **SOC 2 CC9.1**: Business continuity
- **ISO 27001 A.17**: Information security aspects of BCM
- **GDPR Article 32(1)(c)**: Ability to restore availability

---

## 6. Vendor Management Policy

### Purpose

Ensure third-party vendors meet ValueOS security and compliance standards.

### Vendor Risk Assessment

All vendors handling Confidential or Restricted data must:

- Complete security questionnaire
- Provide SOC 2 Type II report (or equivalent)
- Sign Data Processing Agreement (DPA)
- Undergo annual security review

### Vendor Classification

| Tier      | Risk Level | Examples                        | Review Period |
| --------- | ---------- | ------------------------------- | ------------- |
| Critical  | High       | Cloud providers (AWS, Supabase) | Quarterly     |
| Important | Medium     | LLM APIs (OpenAI, Anthropic)    | Semi-annual   |
| Standard  | Low        | Analytics tools                 | Annual        |

### Required Vendor Documentation

- SOC 2 Type II report (preferred) or ISO 27001 certification
- Privacy policy and DPA (for data processors)
- SLA with uptime commitments
- Incident notification procedures
- Data residency confirmation

### Vendor Onboarding Checklist

- [ ] Security questionnaire completed
- [ ] Compliance certificates reviewed
- [ ] DPA signed
- [ ] Access controls configured (least privilege)
- [ ] Monitoring alerts set up
- [ ] Offboarding process documented

### Vendor Monitoring

- Monthly review of security incidents
- Quarterly SLA compliance check
- Annual contract renewal with security review

### Compliance Mappings

- **SOC 2 CC9.2**: Vendor management
- **GDPR Article 28**: Processor obligations
- **ISO 27001 A.15**: Supplier relationships

---

## 7. Encryption and Key Management

### Purpose

Protect data confidentiality through encryption and secure key management.

### Encryption Standards

**Data at Rest**:

- Algorithm: AES-256-GCM
- Key Management: Supabase Vault + AWS KMS
- Coverage: All databases, file storage, backups

**Data in Transit**:

- TLS 1.3 minimum (TLS 1.2 deprecated)
- Perfect Forward Secrecy (PFS) required
- Certificate pinning for mobile apps

**End-to-End Encryption** (for PII/PHI):

- Client-side encryption before transmission
- Tokenization for credit cards
- Zero-knowledge architecture where feasible

### Key Management Hierarchy

```
Master Key (AWS KMS)
    ↓
Data Encryption Keys (DEK)
    ↓
Field-Level Encryption Keys
```

### Key Rotation Policy

| Key Type              | Rotation Frequency | Auto-Rotation         | Priority     |
| --------------------- | ------------------ | --------------------- | ------------ |
| **Together.ai API**   | **90 days**        | **Yes (VOS-SEC-005)** | **CRITICAL** |
| OpenAI API            | 90 days            | Yes (VOS-SEC-005)     | High         |
| Anthropic API         | 90 days            | Yes (VOS-SEC-005)     | High         |
| AWS IAM Keys          | 90 days            | Yes (VOS-SEC-005)     | High         |
| Master Keys           | Annual             | Yes (AWS KMS)         | Critical     |
| Database Keys         | Annual             | Yes (Supabase)        | Critical     |
| JWT Signing Keys      | 180 days           | Yes                   | Medium       |
| Supabase Service Role | 180 days           | Manual notification   | Critical     |
| User Passwords        | On compromise      | N/A                   | N/A          |

**Note**: Together.ai is the primary LLM provider for ValueOS, handling 100% of AI inference traffic. Its API key rotation is prioritized as CRITICAL and automated via VOS-SEC-005.

**Rotation Implementation**: All API key rotations include:

- 2-hour grace period (zero-downtime rotation)
- Pre-activation validation testing
- Automatic audit logging
- Admin notifications (for manual steps)

### Secure Key Storage

- **Never in code**: No hardcoded secrets
- **Supabase Vault**: For application secrets
- **AWS Secrets Manager**: For infrastructure secrets
- **Environment variables**: Encrypted at rest

### Key Lifecycle

```
1. GENERATION (HSM or KMS)
   ↓
2. DISTRIBUTION (Secure channel)
   ↓
3. USAGE (Access logged)
   ↓
4. ROTATION (Automated schedule)
   ↓
5. DESTRUCTION (Cryptographic erasure)
```

### Compliance Mappings

- **SOC 2 CC6.1, CC6.7**: Encryption
- **GDPR Article 32**: Encryption as security measure
- **PCI DSS 3.4**: Key management

---

## 8. Monitoring and Logging Policy

### Purpose

Detect security incidents and maintain audit trail for compliance.

### Log Collection

**What We Log**:

- Authentication events (login, logout, failed attempts)
- Authorization decisions (access granted/denied)
- Administrative actions
- System errors and exceptions
- API requests (method, endpoint, user, timestamp)
- Database queries (for sensitive tables)
- Infrastructure changes

**What We Don't Log**:

- Passwords or secrets
- Full credit card numbers
- Unencrypted PII
- Health information (HIPAA)

### Log Retention

| Log Type         | Retention | Storage                        | Compliance Requirement |
| ---------------- | --------- | ------------------------------ | ---------------------- |
| Security Events  | 7 years   | Hot: 90 days, Archive: 7 years | SOC 2                  |
| Access Logs      | 1 year    | Hot: 30 days, Archive: 1 year  | GDPR                   |
| Application Logs | 90 days   | Hot only                       | Operational            |
| Audit Logs       | 7 years   | Immutable storage              | SOC 2                  |

### Log Protection

- **Integrity**: Hash-based verification (Merkle trees)
- **Encryption**: AES-256 at rest
- **Access Control**: Admin-only via ProtectedComponent
- **Immutability**: Write-once storage (WORM)

### Monitoring & Alerting

**Security Alerts** (PagerDuty):

- Failed login spike (> 10/minute)
- Unauthorized access attempt
- Privilege escalation
- Anomalous data access pattern

**Operational Alerts** (Sentry/DataDog):

- Error rate > 1%
- Latency > 500ms (p95)
- Infrastructure resource exhaustion

### Security Information and Event Management (SIEM)

**Tool**: Supabase + Custom Dashboard (or Splunk/ELK in future)

**Use Cases**:

- Real-time threat detection
- Compliance reporting
- Forensic investigation
- User behavior analytics

### Compliance Mappings

- **SOC 2 CC7.2**: Monitoring for security events
- **GDPR Article 30**: Records of processing activities
- **ISO 27001 A.12.4**: Logging and monitoring

---

## Policy Review and Updates

### Review Schedule

- **Quarterly**: Security team reviews all policies
- **Annual**: Full audit and update cycle
- **Ad-hoc**: After major incidents or regulatory changes

### Approval Process

- Draft reviewed by Security Team
- Legal review for compliance
- CSO approval
- Board approval for major changes

### Version Control

All policies stored in Git with:

- Version history
- Change log
- Approval signatures (digital)

---

## Enforcement

Violations of these policies may result in:

- Warning (first offense, minor)
- Access suspension (repeat or moderate)
- Termination (severe or repeated)
- Legal action (criminal or regulatory violations)

---

## Contact Information

**Policy Owner**: security@valueos.com  
**Security Team**: security@valueos.com  
**Legal Team**: legal@valueos.com  
**Report Incident**: incidents@valueos.com  
**Compliance Questions**: compliance@valueos.com

---

**Document Control**:

- **ID**: SEC-POL-001
- **Version**: 1.0
- **Status**: Active
- **Classification**: Internal
- **Next Review**: 2026-03-29
