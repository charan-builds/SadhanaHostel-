# Failure Escalation

## Purpose

Give operators a clear response path for launch and post-launch incidents.

## Severity Levels

| Severity | Definition | Response Time | Examples |
| --- | --- | --- | --- |
| Critical | Data leak, auth failure, financial corruption, app unavailable | Immediate | Tenant leakage, duplicate verified payments |
| High | Major workflow degraded, no confirmed data corruption | 30 minutes | Upload failures, cron failures, readiness down |
| Medium | Partial workflow issue with workaround | Same day | Realtime update delays, slow exports |
| Low | Cosmetic or low-impact operational issue | Planned | Minor UI copy, non-critical logs |

## First 15 Minutes

1. Confirm environment and deployment SHA.
2. Capture Sentry issue IDs, route names, request IDs, tenant IDs.
3. Decide: rollback, feature pause, or forward fix.
4. Assign incident owner and communications owner.
5. If finance/auth/security is involved, freeze affected mutation paths.

## Escalation Matrix

| Area | Primary Owner | Backup | Escalate When |
| --- | --- | --- | --- |
| Auth/session | Backend | DevOps | Login or route guard failures |
| Payments/invoices | Backend + Finance | Product | Any financial inconsistency |
| Upload/storage | Backend | DevOps | Aadhaar/payment proof access issue |
| Realtime | Frontend + Backend | DevOps | Missed critical resident/admin events |
| Vercel deployment | DevOps | Backend | Build or rollback failure |
| Supabase DB/RLS | Backend | Security | Tenant or policy violation |

## Communication Template

```text
Status: investigating | mitigating | monitoring | resolved
Severity: critical | high | medium | low
Environment: staging | production
Impact: <affected users/workflows>
Action: <rollback/pause/fix/check>
ETA for next update: <time>
Owner: <person>
```

## Resolution Criteria

- Health endpoints stable.
- Error rate returned to baseline.
- Affected workflow manually verified.
- Financial/audit data reviewed if relevant.
- Incident notes recorded.
- Follow-up issue created for root cause.
