# Soft Launch Strategy

## Purpose

Roll out Sadhana Boys Hostel Platform to real users gradually, with measurable go/no-go gates and clear rollback triggers.

## Launch Principles

- Start with a small real cohort.
- Keep operational staff close to the workflow.
- Monitor errors, payments, uploads, and support friction continuously.
- Roll back before data quality or financial safety is compromised.

## Rollout Phases

| Phase | Audience | Duration | Entry Criteria | Exit Criteria |
|---|---:|---:|---|---|
| Phase 0 Internal | 2-3 admins/staff | 1 day | Staging UAT passed | Admin flows completed without blocker |
| Phase 1 Pilot | 10 residents | 2-3 days | Security signoff complete | Payment, leave, notices, profile flows stable |
| Phase 2 Expanded Pilot | 20-30 residents | 3-5 days | Phase 1 issues resolved | Error rate and support load acceptable |
| Phase 3 Hostel Rollout | All active residents | 1 week | Go/no-go approved | No launch blockers |

## Cohort Selection

Start with residents who represent common usage:

- Different room types.
- Residents with pending dues.
- Residents likely to apply for leave.
- Mobile-first users.
- At least one low-connectivity user.

Avoid the first cohort containing unusual edge cases only.

## Go/No-Go Decision Matrix

| Area | Go | No-Go |
|---|---|---|
| Auth | Login/logout/session stable | Redirect loop, session loss, unauthorized render |
| Payments | Proof upload and verification stable | Duplicate verification, missing proof, invoice mismatch |
| Leaves | Apply/approve/reject stable | Lost requests or wrong status |
| Uploads | Aadhaar/payment proof/profile uploads stable | Cross-user file access or frequent upload failures |
| Realtime | Updates arrive or degrade gracefully | Missed critical payment/leave status without refresh path |
| Monitoring | Alerts route correctly | Critical failures are silent |
| Support | Staff can resolve pilot issues | Unclear ownership or unresolved user blockers |

## Launch-Day Checklist

- [ ] Freeze non-critical code changes.
- [ ] Confirm staging and production environment variables.
- [ ] Confirm Supabase backup status.
- [ ] Confirm monitoring alert routes.
- [ ] Confirm Resend sender configuration.
- [ ] Confirm Vercel deployment health.
- [ ] Confirm cron routes require production cron secret.
- [ ] Confirm support contact path for residents.
- [ ] Confirm rollback owner is available.
- [ ] Record launch commit SHA.

## Operational Monitoring Window

During each rollout phase, monitor:

- API error rate.
- Payment creation and verification failures.
- Upload failures.
- Sentry frontend crashes.
- Realtime disconnect rates.
- Health check failures.
- Support tickets.
- Admin manual corrections.

Suggested cadence:

- First 2 hours: every 15 minutes.
- Same day: every 1 hour.
- First 3 days: morning and evening review.

## Rollback Triggers

Immediate rollback or pause if:

- Unauthorized users can view admin/resident data.
- Cross-tenant data exposure is observed.
- Verified payments duplicate or mutate incorrectly.
- Invoice generation creates duplicates.
- Upload ownership fails.
- Admin cannot verify payments.
- More than 10% of pilot users cannot log in.
- Monitoring is silent during a known failure.

## Rollback Options

| Option | Use When | Action |
|---|---|---|
| Pause onboarding | New users are affected, existing data safe | Stop inviting residents/admins |
| Disable risky workflow | One module is affected | Hide/disable payment upload, exports, or CMS mutation temporarily |
| Revert Vercel deployment | Frontend/API regression | Roll back to previous healthy deployment |
| Database migration rollback | Migration regression | Use documented rollback plan and restore validation |
| Full incident response | Data/security/financial issue | Freeze launch and follow escalation |

## Incident Escalation Flow

| Severity | Example | Response |
|---|---|---|
| Critical | Tenant leakage, payment corruption | Stop rollout, notify owner, preserve logs, rollback |
| High | Payment verification broken | Pause affected workflow, hotfix, retest |
| Medium | Upload failure spike | Triage, communicate workaround |
| Low | Copy/layout issue | Track for post-launch polish |

## Resident Support Plan

- Provide one clear contact channel.
- Use short issue categories: login, profile, payment, invoice, leave, notice.
- Capture resident name, phone, issue time, screenshot, and request ID when visible.
- Never ask residents to send Aadhaar or payment proof through informal channels unless explicitly approved operationally.

## Admin Support Plan

- Assign one launch coordinator.
- Assign one technical owner.
- Assign one payment verification owner.
- Review unresolved support tickets daily during pilot.

