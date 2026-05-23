# First 30 Days Operations Guide

This guide keeps the controlled launch disciplined after the first residents are invited.

## Daily Checks

- `/admin/launch-readiness`: failed checks, warnings, feature flags, launch metrics.
- `/admin/alerts`: support requests, onboarding blockers, payment issues, capacity risks.
- `/admin/operations/automation`: failed or skipped jobs.
- `/admin/owner-dashboard`: occupancy, revenue, dues aging, payment conversion, onboarding completion.
- Sentry: unhandled errors, API failures, upload failures, cron failures.

## Weekly Checks

- Export payments, residents, occupancy, and leaves reports.
- Review support issue categories and repeated resident friction.
- Verify storage bucket growth and orphan upload cleanup.
- Verify backup/restore drill evidence remains current.
- Review feature flags before expanding the cohort.

## Metrics Targets

| Metric | Target |
| --- | --- |
| Activation rate | 80%+ for invited residents |
| Onboarding completion | 80%+ before expanding beyond pilot |
| Payment verification success | 90%+ after manual review |
| Critical support tickets | 0 unresolved |
| Readiness checks | 0 failed |
| Cron failures | 0 in previous 24 hours |

## Cohort Expansion

| Phase | Users | Entry Criteria | Exit Criteria |
| --- | --- | --- | --- |
| Pilot | 10-20 residents | Staging validation complete | No Critical/High blocker for 48 hours |
| Expanded | 20-50 residents | Support process stable | Payment/onboarding metrics at target |
| Full hostel | All active residents | Owner sign-off | First billing cycle completed safely |

## Operator Ownership

- Owner: launch go/no-go decisions.
- Admin: residents, rooms, onboarding, CMS.
- Finance: UPI verification, invoices, dues.
- Warden/reception: leaves, resident support, occupancy observations.
- Engineer: deployment, monitoring, incident response.
