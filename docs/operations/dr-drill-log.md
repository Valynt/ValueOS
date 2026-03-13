# Disaster Recovery Drill Log

Record each DR drill here. Drills should be run at least quarterly.
See [backup-and-recovery.md](backup-and-recovery.md) for the full restore runbook.

---

## Drill template

Copy this block for each drill.

```
## DR Drill — <YYYY-MM-DD>

**Facilitator:** @<github-handle>
**Participants:** @<handle>, @<handle>
**Scenario:** <e.g. "Full Postgres restore from daily backup", "Redis failure", "Backend redeploy">
**Environment:** <staging | production-clone>

### Timeline

| Time (UTC) | Action | Outcome |
|---|---|---|
| HH:MM | Initiated restore | |
| HH:MM | Migrations applied | |
| HH:MM | Backend redeployed | |
| HH:MM | Smoke tests passed | |
| HH:MM | Health check green | |

### RTO achieved: <X min>
### RPO achieved: <X min of data loss, or "none">

### Issues encountered

- <issue and resolution, or "none">

### Follow-up actions

- [ ] <action item> — owner: @<handle>, due: <date>
```

---

<!-- Add completed drill entries below this line, newest first -->
