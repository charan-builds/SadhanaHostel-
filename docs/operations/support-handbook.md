# Soft-Launch Support Handbook

This handbook is for hostel staff supporting the first real users.

## Support Channels

- Resident self-service: `/resident/support`
- Public support: `/support`
- Admin queue: `/admin/alerts`
- Operational diagnostics: `/admin/launch-readiness`
- WhatsApp support: configured with `LAUNCH_SUPPORT_WHATSAPP`
- Owner escalation: configured with `LAUNCH_OWNER_EMAIL`

## Triage Severity

| Severity | Examples | Response |
| --- | --- | --- |
| Critical | Tenant leak, payment corruption, auth bypass, data loss | Pause launch, enable maintenance mode, escalate immediately |
| High | Resident cannot activate, payment verification blocked, room allocation conflict | Resolve same day before expanding cohort |
| Medium | Upload retry issue, confusing validation, CMS display problem | Fix or document workaround during pilot |
| Low | Copy, layout, minor polish | Track post-launch |

## Common Recovery Flows

| Problem | Operator Action |
| --- | --- |
| Expired invite | Open resident record, revoke stale invite, send a new invite |
| Rejected onboarding | Add rejection notes, ask resident to re-upload documents |
| Payment rejected | Ask resident to submit correct UTR and screenshot |
| Upload failed | Ask resident to retry on stable network; confirm file type and size |
| Stale session | Ask user to log out and log in again |
| Room conflict | Check vacancy and allocation history before reassigning |

## Daily Pilot Routine

1. Review `/admin/launch-readiness`.
2. Clear Critical and High support tickets in `/admin/alerts`.
3. Review pending onboarding verification.
4. Review pending payments and duplicate UTR warnings.
5. Review automation job status.
6. Record metrics in the launch tracker.

## Communication Rules

- Never ask residents to share full Aadhaar numbers in chat.
- Never share service-role keys, Supabase links, or internal logs with residents.
- Confirm payments against bank/UPI records before approval.
- Use operational notes in admin UI so future staff can see the recovery trail.
