# Quick Deployment Reference

**One-page reference for common deployment tasks**

---

## 🚀 Quick Commands

### Pre-Deployment
```bash
# Run all pre-deployment checks
npm run deploy:pre-check

# Backup database
npm run db:backup staging
```

### Deploy to Staging
```bash
# Start staging environment
npm run staging:start

# Validate deployment
npm run deploy:validate staging

# Monitor
npm run monitor:golden-path
```

### Deploy to Production
```bash
# Backup first
npm run db:backup prod

# Deploy
bash scripts/deploy.sh prod

# Validate
npm run deploy:validate prod
```

### Rollback
```bash
# Kubernetes
kubectl rollout undo deployment/valuecanvas-app -n production

# Docker Compose
docker-compose -f infrastructure/docker/compose.prod.yml down
docker-compose -f infrastructure/docker/compose.prod.yml up -d
```

---

## 📋 Pre-Deployment Checklist

Run: `npm run deploy:pre-check`

Must pass:
- ✅ All tests passing
- ✅ No security vulnerabilities
- ✅ RLS policies enabled
- ✅ Production build successful
- ✅ Environment variables set
- ✅ Database validated

---

## 🔍 Health Checks

### Local
```bash
curl http://localhost:3000/health
```

### Staging
```bash
curl http://localhost:8001/healthz
```

### Production
```bash
curl https://yourdomain.com/healthz
```

---

## 💾 Backup & Restore

### Backup
```bash
npm run db:backup [local|staging|prod]
```

### Restore
```bash
npm run db:restore backups/staging_20231206_120000.sql
```

### List Backups
```bash
npm run db:backup:list
```

---

## 📊 Monitoring

### Dashboards
- **Grafana:** http://localhost:3001
- **Prometheus:** http://localhost:9090
- **Jaeger:** http://localhost:16686

### Key Metrics
- Error rate < 1%
- Response time < 200ms (p95)
- CPU usage < 80%
- Memory usage < 80%

---

## 🆘 Emergency Contacts

- **On-Call:** [Phone]
- **DevOps:** [Slack]
- **Security:** [Email]

---

## 📚 Full Documentation

- [Go-Live Workflow](GO_LIVE_WORKFLOW.md)
- [Deployment Summary](DEPLOYMENT_SUMMARY.md)
- [Automation Complete](DEPLOYMENT_AUTOMATION_COMPLETE.md)
