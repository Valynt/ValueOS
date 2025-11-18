# ValueCanvas Deployment Architecture

## Overview

This document describes the complete deployment architecture for ValueCanvas, including microservices, infrastructure, monitoring, and disaster recovery.

**Version**: 1.0.0  
**Last Updated**: November 18, 2025  
**Status**: Production-Ready

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer (HTTPS)                    │
│                    (AWS ALB / CloudFlare)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼────┐                    ┌────▼────┐
    │ Frontend│                    │   API   │
    │  (CDN)  │                    │ Gateway │
    └─────────┘                    └────┬────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
              ┌─────▼─────┐      ┌─────▼─────┐      ┌─────▼─────┐
              │    LLM    │      │  Agent    │      │  Workflow │
              │   Proxy   │      │Orchestrator│      │ Executor  │
              └───────────┘      └─────┬─────┘      └───────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         │                             │                             │
    ┌────▼────┐  ┌────▼────┐  ┌───────▼────┐  ┌────▼────┐  ┌───────▼────┐
    │Opportun-│  │ Target  │  │Realization │  │Expansion│  │ Integrity  │
    │ity Agent│  │  Agent  │  │   Agent    │  │  Agent  │  │   Agent    │
    └────┬────┘  └────┬────┘  └─────┬──────┘  └────┬────┘  └─────┬──────┘
         │            │              │              │              │
         └────────────┴──────────────┴──────────────┴──────────────┘
                                     │
                              ┌──────▼──────┐
                              │   Supabase  │
                              │  (Postgres) │
                              │   + Redis   │
                              └─────────────┘
```

---

## Components

### 1. Frontend Layer

**Technology**: React + Vite  
**Deployment**: CDN (CloudFlare, AWS CloudFront)  
**Scaling**: Global edge distribution

**Features**:
- Static asset hosting
- Edge caching
- HTTPS/TLS 1.3
- DDoS protection
- Geographic distribution

### 2. API Gateway

**Technology**: Node.js / Express  
**Deployment**: Kubernetes / ECS  
**Scaling**: Horizontal (2-10 pods)

**Responsibilities**:
- Request routing
- Authentication/Authorization
- Rate limiting
- Request validation
- Response caching
- Metrics collection

### 3. LLM Proxy

**Technology**: Supabase Edge Function / Deno  
**Deployment**: Serverless  
**Scaling**: Auto-scaling

**Features**:
- Together.ai primary provider
- OpenAI fallback
- API key management
- Request/response logging
- Cost tracking
- Rate limiting per user/org

### 4. Agent Orchestrator

**Technology**: Node.js / TypeScript  
**Deployment**: Kubernetes / ECS  
**Scaling**: Horizontal (2-5 pods)

**Responsibilities**:
- Agent lifecycle management
- Workflow execution
- Circuit breaker management
- Event streaming
- State management

### 5. Agent Microservices

**Services**:
1. Opportunity Agent (Port 8080)
2. Target Agent (Port 8081)
3. Realization Agent (Port 8082)
4. Expansion Agent (Port 8083)
5. Integrity Agent (Port 8084)

**Technology**: Python / FastAPI  
**Deployment**: Kubernetes / ECS  
**Scaling**: Horizontal (1-3 pods each)

**Features**:
- Independent scaling
- Health checks
- Graceful shutdown
- Circuit breaker integration
- Metrics export

### 6. Database Layer

**Primary**: Supabase (Postgres 14+)  
**Cache**: Redis  
**Graph**: Neo4j (optional)

**Features**:
- Row Level Security (RLS)
- Connection pooling
- Read replicas
- Automated backups
- Point-in-time recovery

---

## Infrastructure Specifications

### Compute Resources

#### Production Environment

| Service | CPU | Memory | Replicas | Auto-scale |
|---------|-----|--------|----------|------------|
| API Gateway | 1 vCPU | 2 GB | 2-10 | Yes |
| Orchestrator | 2 vCPU | 4 GB | 2-5 | Yes |
| Opportunity Agent | 1 vCPU | 2 GB | 1-3 | Yes |
| Target Agent | 1 vCPU | 2 GB | 1-3 | Yes |
| Realization Agent | 1 vCPU | 2 GB | 1-3 | Yes |
| Expansion Agent | 1 vCPU | 2 GB | 1-3 | Yes |
| Integrity Agent | 1 vCPU | 2 GB | 1-3 | Yes |

#### Staging Environment

| Service | CPU | Memory | Replicas |
|---------|-----|--------|----------|
| All Services | 0.5 vCPU | 1 GB | 1 |

### Database Resources

#### Production

- **Instance**: db.t3.medium (2 vCPU, 4 GB RAM)
- **Storage**: 100 GB SSD (auto-scaling to 500 GB)
- **Backups**: Daily, 30-day retention
- **Read Replicas**: 1 (same region)

#### Staging

- **Instance**: db.t3.micro (1 vCPU, 1 GB RAM)
- **Storage**: 20 GB SSD
- **Backups**: Daily, 7-day retention

### Redis Cache

- **Instance**: cache.t3.micro (0.5 GB)
- **Replication**: Enabled
- **Persistence**: AOF + RDB

---

## Deployment Environments

### 1. Development

**Purpose**: Local development  
**Infrastructure**: Docker Compose  
**Database**: Local Postgres  
**LLM**: Mock responses

### 2. Staging

**Purpose**: Pre-production testing  
**Infrastructure**: Kubernetes (1 node)  
**Database**: Supabase (staging project)  
**LLM**: Together.ai (rate-limited)

### 3. Production

**Purpose**: Live system  
**Infrastructure**: Kubernetes (3+ nodes)  
**Database**: Supabase (production project)  
**LLM**: Together.ai (full quota)

---

## Network Architecture

### VPC Configuration

```
VPC: 10.0.0.0/16

Subnets:
├── Public Subnet 1:  10.0.1.0/24 (us-east-1a)
├── Public Subnet 2:  10.0.2.0/24 (us-east-1b)
├── Private Subnet 1: 10.0.10.0/24 (us-east-1a)
├── Private Subnet 2: 10.0.11.0/24 (us-east-1b)
└── Database Subnet:  10.0.20.0/24 (us-east-1a)
```

### Security Groups

**Load Balancer**:
- Inbound: 443 (HTTPS) from 0.0.0.0/0
- Outbound: All to VPC

**Application**:
- Inbound: 8080-8085 from Load Balancer
- Outbound: All to VPC

**Database**:
- Inbound: 5432 from Application SG
- Outbound: None

---

## Scaling Strategy

### Horizontal Pod Autoscaler (HPA)

```yaml
# API Gateway
minReplicas: 2
maxReplicas: 10
targetCPUUtilizationPercentage: 70
targetMemoryUtilizationPercentage: 80

# Orchestrator
minReplicas: 2
maxReplicas: 5
targetCPUUtilizationPercentage: 70

# Agent Services
minReplicas: 1
maxReplicas: 3
targetCPUUtilizationPercentage: 75
```

### Vertical Scaling

**Triggers**:
- Consistent high CPU (>80% for 10 minutes)
- Memory pressure (>85% for 5 minutes)
- Database connection pool exhaustion

**Process**:
1. Alert operations team
2. Analyze metrics
3. Schedule maintenance window
4. Update resource limits
5. Rolling restart

---

## Monitoring & Observability

### Metrics Collection

**Infrastructure Metrics**:
- CPU utilization
- Memory usage
- Network I/O
- Disk I/O
- Pod count

**Application Metrics**:
- Request rate
- Response time (p50, p95, p99)
- Error rate
- Active connections
- Queue depth

**Business Metrics**:
- LLM tokens consumed
- LLM cost per request
- Agent invocations
- Workflow completions
- User sessions

### Logging

**Levels**:
- ERROR: Application errors
- WARN: Degraded performance
- INFO: Normal operations
- DEBUG: Detailed diagnostics

**Aggregation**: CloudWatch / DataDog / ELK Stack

**Retention**:
- ERROR: 90 days
- WARN: 30 days
- INFO: 7 days
- DEBUG: 1 day

### Alerting

**Critical Alerts** (PagerDuty):
- Service down
- Database unavailable
- Error rate >5%
- Response time >5s

**Warning Alerts** (Slack):
- High CPU (>80%)
- High memory (>85%)
- Error rate >1%
- Response time >2s

---

## Disaster Recovery

### Backup Strategy

**Database**:
- Automated daily backups
- 30-day retention
- Point-in-time recovery (PITR)
- Cross-region replication

**Configuration**:
- Git repository (version controlled)
- Secrets in AWS Secrets Manager
- Infrastructure as Code (Terraform)

### Recovery Procedures

**RTO (Recovery Time Objective)**: 1 hour  
**RPO (Recovery Point Objective)**: 5 minutes

**Scenarios**:

1. **Database Failure**:
   - Automatic failover to read replica
   - Promote replica to primary
   - Update DNS/connection strings
   - Time: 5-10 minutes

2. **Region Failure**:
   - Failover to secondary region
   - Restore from backup
   - Update DNS
   - Time: 30-60 minutes

3. **Data Corruption**:
   - Identify corruption point
   - Restore from PITR
   - Replay transactions
   - Time: 15-30 minutes

---

## Security

### Network Security

- All traffic over HTTPS/TLS 1.3
- VPC with private subnets
- Security groups (least privilege)
- Network ACLs
- DDoS protection (CloudFlare)

### Application Security

- JWT authentication
- Row Level Security (RLS)
- Input validation
- Output encoding
- Rate limiting
- CORS configuration

### Secrets Management

- AWS Secrets Manager
- Environment variables (never in code)
- Automatic rotation (90 days)
- Audit logging

### IAM Roles

**Principle**: Least privilege

- **ECS Task Role**: Database access only
- **Lambda Role**: LLM API access only
- **CI/CD Role**: Deploy permissions only

---

## Cost Optimization

### Estimated Monthly Costs

**Production** (assuming 1000 active users):

| Service | Cost |
|---------|------|
| Compute (ECS/EKS) | $300 |
| Database (Supabase) | $200 |
| Redis Cache | $50 |
| Load Balancer | $30 |
| CloudFront CDN | $50 |
| LLM API (Together.ai) | $500 |
| Monitoring | $100 |
| **Total** | **$1,230/month** |

### Cost Optimization Strategies

1. **Reserved Instances**: 30% savings on compute
2. **Spot Instances**: 70% savings for non-critical workloads
3. **Auto-scaling**: Scale down during off-hours
4. **Cache Optimization**: Reduce database queries
5. **LLM Caching**: Cache common responses

---

## Deployment Checklist

### Pre-Deployment

- [ ] Code review completed
- [ ] Tests passing (unit, integration, e2e)
- [ ] Security scan completed
- [ ] Performance testing completed
- [ ] Documentation updated
- [ ] Rollback plan prepared

### Deployment

- [ ] Create deployment branch
- [ ] Run database migrations
- [ ] Deploy to staging
- [ ] Smoke tests on staging
- [ ] Deploy to production (blue-green)
- [ ] Health checks passing
- [ ] Monitor for 30 minutes

### Post-Deployment

- [ ] Verify metrics
- [ ] Check error rates
- [ ] Review logs
- [ ] Update status page
- [ ] Notify stakeholders
- [ ] Document any issues

---

## Maintenance Windows

**Scheduled Maintenance**: Sunday 2-4 AM UTC  
**Emergency Maintenance**: As needed with 1-hour notice

**During Maintenance**:
- Status page updated
- Email notifications sent
- Read-only mode enabled (if possible)
- Rollback ready

---

## Support & Escalation

### On-Call Rotation

- **Primary**: DevOps Engineer
- **Secondary**: Backend Lead
- **Escalation**: CTO

### Response Times

- **Critical**: 15 minutes
- **High**: 1 hour
- **Medium**: 4 hours
- **Low**: Next business day

---

## References

- [Terraform Configuration](./infrastructure/terraform/)
- [Kubernetes Manifests](./infrastructure/k8s/)
- [CI/CD Pipeline](./.github/workflows/)
- [Monitoring Dashboard](https://monitoring.valuecanvas.com)
- [Status Page](https://status.valuecanvas.com)

---

**Document Owner**: DevOps Team  
**Review Cycle**: Quarterly  
**Next Review**: February 18, 2026
