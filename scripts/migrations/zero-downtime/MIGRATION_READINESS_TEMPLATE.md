# Migration Readiness Template

## Migration Name

- [ ] Migration ID:
- [ ] Author:
- [ ] Date:
- [ ] Target Environment(s):

## Dual-Write Compatibility Phase
- [ ] Are all schema changes backward compatible? (Y/N)
- [ ] Dual-write triggers or sync logic implemented? (Y/N)
- [ ] Legacy columns/indexes preserved? (Y/N)
- [ ] Rollback plan documented? (Y/N)

## Health Verification
- [ ] verify-deployment.ts script updated for this migration? (Y/N)
- [ ] Health check endpoints validated? (Y/N)
- [ ] Manual verification steps (if any):

## Post-Migration Cleanup
- [ ] final-cleanup.sh updated to remove legacy columns/indexes? (Y/N)
- [ ] Cleanup is gated on successful health check? (Y/N)

## Migration Locking
- [ ] Redis lock script path:
- [ ] Lock TTL (seconds):
- [ ] Lock tested in multi-pod scenario? (Y/N)

## Rollback & Recovery
- [ ] Rollback steps:
- [ ] Data recovery plan:

## Approvals
- [ ] DBRE:
- [ ] SRE:
- [ ] Product Owner:

---
Attach this template to every migration PR.
