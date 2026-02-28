# Notifications Phase 0 Acceptance Criteria

## Purpose
This document defines objective pass/fail acceptance criteria for each Notifications Phase 0 story. A story is **accepted** only when every criterion in its section passes in production-like test conditions.

## Scope: Phase 0 Stories
1. **Story P0-1: In-app notification delivery and visibility**
2. **Story P0-2: Mark-read consistency across surfaces**
3. **Story P0-3: Asynchronous email processing and retries**
4. **Story P0-4: Notification preference toggles (default, precedence, propagation)**

---

## Story P0-1 — In-app delivery latency

### Acceptance criteria (pass/fail)
- **Latency target (primary SLO):**
  - **PASS** if `p95 <= 5s` from `event.created_at` to notification visible in UI for the target user.
  - **FAIL** if `p95 > 5s`.
- **Outlier guardrail:**
  - **PASS** if `p99 <= 10s` for the same measurement window.
  - **FAIL** if `p99 > 10s`.
- **Coverage requirement:**
  - **PASS** if at least `1000` synthetic or real qualifying events are measured during the validation run.
  - **FAIL** if sample size is below threshold.

### Measurement definition
- **Start:** durable event persisted and timestamped (`event.created_at`).
- **End:** notification card/item becomes visible in the recipient UI state (web client notification list API response or rendered list after refresh/poll/push).
- **Window:** rolling 24h or controlled load-test window with representative concurrency.

---

## Story P0-2 — Mark-read consistency

### Acceptance criteria (pass/fail)
- **Consistency target:**
  - **PASS** if mark-read state converges across API read model, DB projection, and UI within `<= 3s` (eventual consistency max delay).
  - **FAIL** if any observed convergence delay exceeds `3s`.
- **Durability target:**
  - **PASS** if no acknowledged mark-read mutation is lost after service restart/redeploy in test.
  - **FAIL** if any acknowledged mutation is missing.
- **Conflict behavior:**
  - **PASS** if repeated mark-read operations are idempotent (no duplicate side effects/audit noise beyond one terminal state change).
  - **FAIL** if duplicates create divergent state.

### Measurement definition
- **Start:** successful mark-read API acknowledgment (`2xx`) with mutation ID.
- **End:** all observability planes report `read=true` for same notification and user.

---

## Story P0-3 — Email async processing

### Acceptance criteria (pass/fail)
- **Queue-to-send latency target:**
  - **PASS** if `p95 <= 60s` from enqueue timestamp to provider handoff (`sent` or provider accepted state).
  - **FAIL** if `p95 > 60s`.
- **Retry behavior target:**
  - **PASS** if transient failures trigger exponential backoff retries at approximately `+1m`, `+5m`, and `+15m`, with max `3` retries before dead-lettering/escalation.
  - **FAIL** if retries are missing, non-ordered, or exceed configured max without terminal state.
- **Terminal outcome integrity:**
  - **PASS** if each message reaches exactly one terminal state (`sent`, `failed`, or `dead-lettered`) with auditable reason code.
  - **FAIL** if message has no terminal state or multiple conflicting terminal states.

### Measurement definition
- **Start:** message write to outbound queue with correlation/idempotency key.
- **End:** provider acceptance timestamp (or terminal failure/dead-letter timestamp for failed flows).

---

## Story P0-4 — Preference toggle behavior

### Acceptance criteria (pass/fail)
- **Default state:**
  - **PASS** if newly created users/tenants receive default notification preferences as defined by configuration baseline (documented defaults loaded and queryable).
  - **FAIL** if defaults are missing or differ from baseline.
- **Precedence resolution:**
  - **PASS** if effective preference follows deterministic order:
    1. **User explicit override**
    2. **Tenant policy override**
    3. **System default**
  - **FAIL** if any evaluation violates this order.
- **Propagation delay target:**
  - **PASS** if preference changes are reflected in downstream delivery decisions within `<= 10s` p95.
  - **FAIL** if `p95 > 10s`.
- **No-leak guardrail:**
  - **PASS** if events generated after an opt-out effective timestamp do not send disallowed channel notifications.
  - **FAIL** if any blocked channel notification is emitted post opt-out.

### Measurement definition
- **Start:** preference update API `2xx` with new version/etag.
- **End:** next eligible event is evaluated using updated effective preference and reflected in channel dispatch decisions.

---

## Cross-story checklist: criterion -> observable signal

Use this checklist during QA, staging verification, or production readiness review.

| Criterion | Observable signal type | What to verify | Pass condition |
|---|---|---|---|
| In-app latency p95 <= 5s | API response + UI state | Compare `event.created_at` and first appearance in notifications API/UI | p95 <= 5s, p99 <= 10s |
| In-app coverage >= 1000 events | Audit event / analytics counter | Count qualifying measured events in run window | Count >= 1000 |
| Mark-read convergence <= 3s | API response + DB state + UI state | Track ack timestamp vs read=true across projection + UI | Max delay <= 3s |
| Mark-read durability | DB state + audit event | Restart services, validate previously acked mutations persist | 0 lost mutations |
| Mark-read idempotency | API response + audit event | Repeat same mutation key/request | No divergent state or duplicate terminal effects |
| Email queue-to-send p95 <= 60s | Queue state + provider/audit event | Enqueue timestamp vs provider-accepted timestamp | p95 <= 60s |
| Email retry schedule | Queue state + audit event | Inspect retry attempts and delay sequence for transient failures | ~1m, ~5m, ~15m; max 3 retries |
| Email terminal integrity | Queue state + DB/audit state | Ensure one terminal state per message with reason code | Exactly one terminal state |
| Preference default correctness | API response + DB state | Create new user/tenant and read effective prefs | Matches baseline defaults |
| Preference precedence correctness | API response + audit event | Evaluate combinations of user/tenant/default settings | User > Tenant > System |
| Preference propagation p95 <= 10s | API response + queue/dispatch state | Update toggle, then emit event and inspect channel decision timing | p95 <= 10s |
| Opt-out no-leak guardrail | Queue state + audit event + UI/API state | After opt-out, emit events and verify blocked channel not dispatched | 0 disallowed sends |

## Sign-off template

- [ ] P0-1 In-app latency criteria passed
- [ ] P0-2 Mark-read consistency criteria passed
- [ ] P0-3 Email async criteria passed
- [ ] P0-4 Preference toggle criteria passed
- [ ] All checklist evidence attached (queries, dashboard snapshots, logs, or test output)
