# Security Operations Guide

## Overview

This guide provides comprehensive procedures for operating and maintaining the ValueOS security infrastructure. It covers monitoring, incident response, and security best practices for the Secure Agent Context Management system.

## Table of Contents

1. [Security Architecture Overview](#security-architecture-overview)
2. [Monitoring and Alerting](#monitoring-and-alerting)
3. [Incident Response Procedures](#incident-response-procedures)
4. [Security Maintenance](#security-maintenance)
5. [Compliance and Auditing](#compliance-and-auditing)
6. [Troubleshooting](#troubleshooting)
7. [Emergency Procedures](#emergency-procedures)

## Security Architecture Overview

### Core Components

#### 1. SecureSharedContext Service
- **Purpose**: Manages secure context sharing between agents
- **Security Features**:
  - Tenant isolation
  - Permission-based access control
  - Data sensitivity classification
  - TTL-based cleanup
  - Comprehensive audit logging

#### 2. AgentAuditLogger Service
- **Purpose**: Centralized logging for all agent interactions
- **Security Features**:
  - Batch processing for performance
  - Database persistence
  - Retention management
  - Query capabilities for compliance

#### 3. SecureMessageBus
- **Purpose**: Secure inter-agent communication
- **Security Features**:
  - Message signing (HMAC-SHA256)
  - AES-256-GCM encryption
  - Replay protection
  - Circuit breaker for compromised agents

#### 4. SecurityMonitor
- **Purpose**: Real-time threat detection and alerting
- **Security Features**:
  - Pattern analysis
  - Automated alerting
  - Escalation procedures
  - Metrics collection

### Security Controls

| Control Type | Implementation | Purpose |
|--------------|----------------|---------|
| **Authentication** | AgentIdentity with cryptographic keys | Verify agent identity |
| **Authorization** | Permission matrix per agent type | Control agent capabilities |
| **Encryption** | AES-256-GCM for sensitive data | Protect data in transit |
| **Integrity** | HMAC-SHA256 message signing | Verify message authenticity |
| **Audit** | Comprehensive logging system | Maintain compliance records |
| **Monitoring** | Real-time threat detection | Identify security incidents |

## Monitoring and Alerting

### Security Dashboard

Access the security dashboard at `/admin/security` to view:
- Active security events
- Alert status and escalation
- Agent security status
- Communication patterns
- Audit log statistics

### Key Metrics to Monitor

#### Daily Metrics
- Total security events
- Events by severity level
- Active alerts count
- Mean time to resolution
- Compromised agents count

#### Real-time Alerts
- Denied context shares (>5/minute)
- Invalid message signatures (>3/minute)
- Replay attack attempts (any)
- High sensitivity data access
- Agent compromise events

### Alert Types and Escalation

| Alert Type | Trigger | Escalation Path |
|------------|---------|-----------------|
| **Immediate Notification** | Any security event | Security team channel |
| **Email Alert** | Medium severity events | Security team email |
| **Slack Notification** | High sensitivity access | #security-alerts |
| **PagerDuty** | Agent compromise | On-call engineer |
| **Security Team Escalation** | Circuit breaker opened | Security lead |
| **Management Escalation** | Critical incidents | CTO/CSO |

### Monitoring Configuration

```typescript
// Example monitoring configuration
const monitoringConfig = {
  alertThresholds: {
    deniedContextShares: 5,      // per minute
    invalidSignatures: 3,         // per minute
    replayAttacks: 1,            // per minute
    compromisedAgents: 1,         // total
  },
  escalationRules: {
    highSensitivityAccess: ['immediate_notification', 'email_alert'],
    agentCompromised: ['immediate_notification', 'slack_notification', 'pager_duty'],
    circuitBreakerOpened: ['immediate_notification', 'security_team_escalation'],
  },
  retentionPeriod: 30,           // days
};
```

## Incident Response Procedures

### Incident Classification

#### Severity Levels
- **Critical**: Active attack, system compromise, data breach
- **High**: Repeated failed attempts, suspicious patterns
- **Medium**: Policy violations, unusual activity
- **Low**: Configuration issues, minor anomalies

### Response Timeline

| Phase | Timeframe | Actions |
|-------|-----------|---------|
| **Detection** | Immediate | Automated monitoring alerts |
| **Assessment** | 15 minutes | Triage, classify severity |
| **Containment** | 30 minutes | Isolate affected systems |
| **Eradication** | 1 hour | Remove threat, patch vulnerabilities |
| **Recovery** | 2 hours | Restore services, verify security |
| **Post-mortem** | 24 hours | Document lessons learned |

### Incident Response Checklist

#### Phase 1: Detection and Assessment
- [ ] Verify alert authenticity
- [ ] Determine affected systems
- [ ] Assess potential impact
- [ ] Classify incident severity
- [ ] Notify appropriate teams

#### Phase 2: Containment
- [ ] Isolate compromised agents
- [ ] Block suspicious communications
- [ ] Enable additional logging
- [ ] Preserve evidence
- [ ] Document containment actions

#### Phase 3: Investigation
- [ ] Analyze audit logs
- [ ] Review communication patterns
- [ ] Identify root cause
- [ ] Assess data exposure
- [ ] Document findings

#### Phase 4: Resolution
- [ ] Patch vulnerabilities
- [ ] Reset compromised credentials
- [ ] Restore services
- [ ] Verify security controls
- [ ] Update monitoring rules

### Specific Incident Types

#### Agent Compromise
1. **Immediate Actions**:
   - Mark agent as compromised via `SecurityMonitor.markCompromised()`
   - Circuit breaker will automatically isolate agent
   - Alert security team immediately

2. **Investigation Steps**:
   - Review agent's recent communications
   - Check for data exfiltration
   - Analyze authentication logs
   - Determine compromise vector

3. **Recovery**:
   - Generate new cryptographic keys
   - Re-register agent with new identity
   - Monitor for suspicious activity
   - Update security policies if needed

#### Replay Attack Detection
1. **Immediate Actions**:
   - Message bus automatically blocks replay attempts
   - Alert is generated for security team
   - Investigate source of replayed messages

2. **Investigation**:
   - Check nonce generation security
   - Verify timestamp validation
   - Analyze message patterns
   - Identify attacker capabilities

#### Data Sensitivity Violations
1. **Immediate Actions**:
   - Block the context sharing attempt
   - Log the violation details
   - Alert data protection officer

2. **Follow-up**:
   - Review data classification rules
   - Update sensitivity patterns
   - Provide additional agent training
   - Consider policy adjustments

## Security Maintenance

### Daily Tasks

#### Morning Checklist
- [ ] Review overnight security events
- [ ] Check active alerts status
- [ ] Verify monitoring system health
- [ ] Review agent security status
- [ ] Check for failed authentications

#### Evening Checklist
- [ ] Review daily security metrics
- [ ] Update incident documentation
- [ ] Backup security configurations
- [ ] Schedule maintenance tasks
- [ ] Prepare daily security report

### Weekly Tasks

- [ ] Review and update security policies
- [ ] Analyze security trends and patterns
- [ ] Perform security system health checks
- [ ] Update cryptographic key rotation schedule
- [ ] Conduct security team training

### Monthly Tasks

- [ ] Comprehensive security audit
- [ ] Update threat intelligence feeds
- [ ] Review and update alert thresholds
- [ ] Perform penetration testing
- [ ] Update security documentation

### Cryptographic Key Management

#### Key Rotation Schedule
- **Agent Keys**: Every 90 days
- **Encryption Keys**: Every 180 days
- **Signing Keys**: Every 365 days
- **Session Keys**: Every 24 hours

#### Key Rotation Procedure
1. Generate new key pairs
2. Update agent identities
3. Re-register with message bus
4. Update shared contexts
5. Retire old keys securely
6. Verify system functionality

### System Updates

#### Security Patch Management
1. **Assessment**: Evaluate security patches
2. **Testing**: Apply to staging environment
3. **Scheduling**: Plan maintenance window
4. **Deployment**: Apply patches to production
5. **Verification**: Test system functionality
6. **Monitoring**: Watch for issues

#### Configuration Updates
- Review security configurations monthly
- Test changes in staging first
- Document all configuration changes
- Maintain configuration backups
- Use version control for all configs

## Compliance and Auditing

### Regulatory Requirements

#### SOX Compliance
- Financial data access logging
- Separation of duties enforcement
- Change management documentation
- Quarterly compliance reviews

#### GDPR Compliance
- Data minimization principles
- Right to be forgotten implementation
- Data breach notification procedures
- Privacy impact assessments

#### HIPAA Compliance
- Protected health information safeguards
- Audit trail requirements
- Business associate agreements
- Risk assessment procedures

### Audit Procedures

#### Internal Audits
- **Frequency**: Quarterly
- **Scope**: All security controls
- **Documentation**: Comprehensive audit reports
- **Follow-up**: Track remediation progress

#### External Audits
- **Frequency**: Annually
- **Preparation**: Gather evidence and documentation
- **Support**: Provide auditor access to systems
- **Remediation**: Address findings promptly

### Audit Trail Requirements

#### Required Information
- User/agent identity
- Timestamp of action
- Action performed
- Resources accessed
- Success/failure status
- Source IP address
- Request context

#### Retention Requirements
- **Security Events**: 1 year
- **Audit Logs**: 7 years
- **Incident Reports**: 5 years
- **Configuration Changes**: 3 years

### Reporting

#### Daily Security Report
```typescript
interface DailySecurityReport {
  date: string;
  totalEvents: number;
  eventsBySeverity: Record<SecuritySeverity, number>;
  activeAlerts: number;
  resolvedIncidents: number;
  compromisedAgents: number;
  blockedCommunications: number;
  topEventTypes: Array<{ type: string; count: number }>;
}
```

#### Weekly Security Summary
- Trend analysis
- Threat landscape updates
- System health metrics
- Compliance status
- Recommendations

#### Monthly Security Dashboard
- Comprehensive metrics
- Incident trends
- Risk assessment
- Control effectiveness
- Strategic recommendations

## Troubleshooting

### Common Issues

#### Agent Registration Failures
**Symptoms**: Agent cannot register with message bus
**Causes**: Invalid keys, permission issues, network problems
**Solutions**:
1. Verify cryptographic key format
2. Check agent permissions
3. Validate network connectivity
4. Review agent identity configuration

#### Context Sharing Denials
**Symptoms**: Legitimate context sharing blocked
**Causes**: Outdated permission matrix, incorrect security levels
**Solutions**:
1. Review agent communication permissions
2. Update security level mappings
3. Verify trust level requirements
4. Check data sensitivity classification

#### Alert Fatigue
**Symptoms**: Too many false positive alerts
**Causes**: Overly sensitive thresholds, inadequate tuning
**Solutions**:
1. Adjust alert thresholds
2. Update pattern recognition rules
3. Implement alert correlation
4. Review monitoring configuration

### Diagnostic Commands

#### System Health Check
```bash
# Check security monitor status
curl -X GET /api/security/health

# Review active alerts
curl -X GET /api/security/alerts

# Check agent status
curl -X GET /api/security/agents

# View recent events
curl -X GET /api/security/events?limit=100
```

#### Log Analysis
```bash
# Search for security events
grep "security" /var/log/valueos/app.log | tail -50

# Check audit logs
grep "audit" /var/log/valueos/audit.log | tail -50

# Monitor message bus activity
grep "message.bus" /var/log/valueos/app.log | tail -50
```

### Performance Issues

#### High Memory Usage
**Symptoms**: Security monitor consuming excessive memory
**Causes**: Large event history, memory leaks
**Solutions**:
1. Reduce retention period
2. Implement event cleanup
3. Monitor memory usage patterns
4. Restart security monitor if needed

#### Slow Query Performance
**Symptoms**: Audit log queries taking too long
**Causes**: Large dataset, missing indexes
**Solutions**:
1. Add database indexes
2. Implement query optimization
3. Use pagination for large result sets
4. Consider data archiving

## Emergency Procedures

### Security Incident Response

#### Immediate Response (First 15 Minutes)
1. **Activate Incident Response Team**
   - Notify security lead
   - Alert on-call engineer
   - Inform management

2. **Initial Assessment**
   - Verify incident scope
   - Classify severity level
   - Document initial findings

3. **Containment Actions**
   - Isolate affected systems
   - Block suspicious traffic
   - Enable enhanced logging

#### Critical Incident Procedures

#### System Compromise
1. **Immediate Isolation**
   ```bash
   # Mark compromised agents
   curl -X POST /api/security/agents/{agentId}/compromise \
     -H "Content-Type: application/json" \
     -d '{"reason": "security_incident"}'

   # Enable emergency mode
   curl -X POST /api/security/emergency-mode \
     -H "Content-Type: application/json" \
     -d '{"enabled": true}'
   ```

2. **Evidence Preservation**
   - Create system snapshots
   - Export audit logs
   - Document system state
   - Preserve memory dumps

3. **Communication Protocol**
   - Internal notification within 30 minutes
   - Customer notification within 2 hours (if required)
   - Regulatory notification within 72 hours (if required)

### Business Continuity

#### Disaster Recovery
1. **Activation Criteria**
   - System-wide compromise
   - Data center failure
   - Extended service outage

2. **Recovery Procedures**
   - Activate backup systems
   - Restore from clean backups
   - Rebuild security infrastructure
   - Verify system integrity

3. **Testing and Validation**
   - Security control verification
   - Penetration testing
   - Performance validation
   - User acceptance testing

### Contact Information

#### Security Team
- **Security Lead**: security-lead@valueos.com
- **On-call Engineer**: +1-555-SECURITY
- **Incident Response**: incident@valueos.com

#### External Contacts
- **Legal Counsel**: legal@valueos.com
- **PR Team**: pr@valueos.com
- **Regulatory Affairs**: compliance@valueos.com

#### Emergency Contacts
- **Data Breach Hotline**: +1-555-BREACH
- **Law Enforcement**: Local authorities
- **Cybersecurity Agency**: National CSIRT

## Appendix

### Security Configuration Reference

#### Agent Permission Matrix
```typescript
const AGENT_PERMISSION_MATRIX = {
  coordinator: ['workflow.execute', 'agents.coordinate', 'context.read'],
  opportunity: ['data.read', 'opportunity.execute', 'context.write'],
  target: ['data.read', 'target.execute', 'context.write'],
  integrity: ['data.read', 'integrity.execute', 'audit.read', 'context.read'],
  // ... other agents
};
```

#### Data Sensitivity Patterns
```typescript
const HIGH_SENSITIVITY_PATTERNS = [
  /\b(social security|ssn|tax id)\b/,
  /\b(credit card|card number|cvv)\b/,
  /\b(password|secret|token|key)\b/,
  /\b(medical|health|diagnosis)\b/,
  // ... other patterns
];
```

#### Alert Thresholds
```typescript
const ALERT_THRESHOLDS = {
  deniedContextShares: 5,      // per minute
  invalidSignatures: 3,         // per minute
  replayAttacks: 1,            // per minute
  compromisedAgents: 1,         // total
};
```

### Security Best Practices

#### Development
- Follow secure coding guidelines
- Implement principle of least privilege
- Use dependency scanning
- Conduct security code reviews

#### Operations
- Regular security training
- Incident response drills
- Security awareness programs
- Threat intelligence sharing

#### Architecture
- Defense in depth approach
- Zero trust architecture
- Secure by design principles
- Continuous monitoring

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-14
**Next Review**: 2026-04-14
**Approved By**: Security Team Lead

For questions or updates to this guide, contact the security team at security@valueos.com.
