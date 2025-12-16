# Migration Checklist

**Use this checklist for every migration!**  
Print or bookmark this page.

---

## 📋 **Pre-Migration Phase**

### **Planning (30 min - 2 hours)**
- [ ] Migration purpose clearly defined
- [ ] Breaking changes identified
- [ ] Multi-phase plan created (if needed)
- [ ] Rollback strategy documented
- [ ] Performance impact assessed
- [ ] RLS policies planned (if schema changes)
- [ ] Team review completed

### **Development (1-2 hours)**
- [ ] Migration SQL written
- [ ] Rollback SQL written
- [ ] Comments and documentation added
- [ ] Safety checks included
- [ ] Verification queries added
- [ ] Templates followed (see TEMPLATE_migration.sql)

---

## 🧪 **Testing Phase**

### **Local Testing (30 min)**
- [ ] Clean database reset (`supabase db reset`)
- [ ] Migration applied successfully
- [ ] No SQL errors
- [ ] Tables/columns created correctly
- [ ] Indexes created
- [ ] RLS policies work
- [ ] Application code still works
- [ ] Rollback tested successfully
- [ ] Performance acceptable

**Test commands:**
```bash
supabase db reset
supabase db push
npm test
```

### **Staging Testing (1-2 hours)**
- [ ] Staging database backed up
- [ ] Migration applied to staging
- [ ] Automated tests passed
- [ ] Manual smoke testing completed
- [ ] Performance testing done
- [ ] Monitored for 30 minutes
- [ ] Rollback tested on staging
- [ ] Issues documented and fixed

**Staging commands:**
```bash
supabase db dump -f staging-backup.sql --db-url $STAGING_URL
supabase db push --db-url $STAGING_URL
npm test
```

---

## 🚀 **Production Deployment**

### **Pre-Deployment (15-30 min)**
- [ ] All testing completed
- [ ] Backup production database (**CRITICAL**)
- [ ] Backup verified (file size > 0, can restore)
- [ ] Team notified (if high-risk)
- [ ] Monitoring dashboard open
- [ ] Rollback SQL ready
- [ ] Off-hours deployment (if high-risk)
- [ ] On-call engineer available

**Backup commands:**
```bash
supabase db dump -f prod-backup-$(date +%Y%m%d-%H%M%S).sql
ls -lh prod-backup-*.sql  # Verify size
```

### **Deployment (5-30 min)**
- [ ] Final pre-flight check
- [ ] Migration applied
- [ ] No errors in output
- [ ] Immediate verification completed
- [ ] Application health check passed
- [ ] No error spikes in logs

**Deploy commands:**
```bash
supabase db diff  # Final check
supabase db push
```

### **Immediate Verification (15 min)**
- [ ] Tables exist
- [ ] Columns correct
- [ ] Indexes created
- [ ] RLS policies active
- [ ] Data integrity maintained
- [ ] Critical flows working
- [ ] Response times normal

**Verification queries:**
```sql
\d+ table_name
SELECT * FROM pg_policies WHERE tablename = 'table_name';
SELECT COUNT(*) FROM table_name;
```

---

## 📊 **Post-Deployment Monitoring**

### **First Hour**
- [ ] Error rate normal (< 1%)
- [ ] Response times acceptable
- [ ] No RLS violations
- [ ] Database metrics normal
- [ ] Application logs clean
- [ ] User reports checked

### **First 24 Hours**
- [ ] Hourly monitoring
- [ ] Error patterns analyzed
- [ ] Performance trends reviewed
- [ ] Query performance checked
- [ ] Database health verified

### **48 Hours**
- [ ] Final verification
- [ ] Performance comparison (before/after)
- [ ] No degradation detected
- [ ] No user issues reported
- [ ] Migration marked complete

---

## 🚨 **Emergency Procedures**

### **When to Rollback**
- [ ] Error rate > 5%
- [ ] Critical functionality broken
- [ ] Data corruption detected
- [ ] Performance degradation > 50%
- [ ] Security issue introduced

### **Rollback Procedure**
- [ ] Team notified immediately
- [ ] Rollback SQL executed
- [ ] Rollback verified
- [ ] Application restarted (if needed)
- [ ] Health checks passed
- [ ] Monitoring recovery
- [ ] Incident documented

**Rollback commands:**
```bash
psql $DATABASE_URL -f supabase/rollbacks/YYYYMMDD_rollback.sql
```

---

## 📝 **Documentation**

### **During Migration**
- [ ] Start time recorded
- [ ] Issues encountered documented
- [ ] Decisions made documented
- [ ] End time recorded

### **After Migration**
- [ ] Migration status updated
- [ ] Performance metrics recorded
- [ ] Issues/solutions documented
- [ ] Team debriefed (if complex)
- [ ] Knowledge base updated

---

## ✅ **Sign-Off**

**Migration:** [Name]  
**Date:** [YYYY-MM-DD]  
**Applied by:** [Name]  
**Status:** [ ] Success  [ ] Rolled Back  [ ] Partial  

**Issues encountered:**
- None / [List issues]

**Performance impact:**
- None / [Describe impact]

**Follow-up required:**
- None / [List follow-ups]

**Approved by:** [Name] [Date]

---

## 🎯 **Quick Reference**

### **Risk Levels**
- **Low:** Schema additions, new tables, indexes
- **Medium:** Column changes, RLS updates, data backfills
- **High:** Column removals, major schema changes, large data migrations

### **Required Backups**
- **Low risk:** Optional (but recommended)
- **Medium risk:** Required
- **High risk:** Required + test restore

### **Deployment Windows**
- **Low risk:** Anytime
- **Medium risk:** Off-peak hours
- **High risk:** Maintenance window

### **Monitoring Duration**
- **Low risk:** 1 hour
- **Medium risk:** 24 hours
- **High risk:** 48 hours

---

## 📞 **Emergency Contacts**

**On-Call Engineer:** [Name/Phone]  
**Database Admin:** [Name/Phone]  
**Team Lead:** [Name/Phone]  
**Slack Channel:** #incidents

---

**Last Updated:** December 1, 2025  
**Version:** 1.0
