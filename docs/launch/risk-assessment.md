# Launch Risk Assessment

## Purpose

Document operational, security, financial, and scalability risks before production launch.

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Supabase outage affects login/data access | Low | High | Monitor Supabase status, readiness alerts, rollback comms | DevOps | TODO |
| Payment verification race condition | Low | Critical | Atomic RPC + proof enforcement + tests | Backend | Mitigated |
| Duplicate invoice generation | Low | Critical | Unique monthly fee invoice index + atomic creation | Backend | Mitigated |
| Tenant data leakage | Low | Critical | RLS, server guards, security tests | Security | TODO |
| Large export timeouts | Medium | Medium | Streaming exports, performance budgets, load tests | Backend | TODO |
| Upload abuse/storage growth | Medium | Medium | Size/type checks, private buckets, future scanning | Backend | TODO |
| Realtime disconnects | Medium | Low | Query invalidation fallback/manual refresh | Frontend | TODO |
| Root-owned local port conflict | Low | Low | Dev script uses port `3002` | DevOps | Mitigated |

## Launch Window Risks

- First real resident payment proof uploads may reveal mobile network edge cases.
- First admin payment verification batch should be supervised.
- First invoice generation batch should be sampled manually.
- Cron jobs should remain limited until staging cron has passed.

## Risk Acceptance

| Risk | Approver | Expiration | Notes |
| --- | --- | --- | --- |
| TODO | TODO | TODO | TODO |
