# Real UAT Execution

## Purpose

Run real workflow validation on staging across desktop, tablet, mobile, and slow-network conditions.

## Execution Order

1. Confirm staging health:

```bash
DEPLOYMENT_URL=https://staging.sadhanaboyshostel.example npm run ci:deployment-health
PLAYWRIGHT_BASE_URL=https://staging.sadhanaboyshostel.example PLAYWRIGHT_SKIP_WEB_SERVER=true npm run test:smoke
```

2. Confirm synthetic seed counts.
3. Run resident workflows.
4. Run admin workflows.
5. Repeat critical mobile workflows on phone viewport.
6. Repeat upload/payment workflows on slow network.
7. Log issues in `docs/launch/known-issues.md`.

## Device Matrix

| Device Class | Browser | Required Workflows |
| --- | --- | --- |
| Desktop 1440px | Chrome | Admin dashboard, residents, payments, exports, CMS |
| Tablet 768px | Chrome/Safari | Admin tables, resident portal |
| Mobile 390px | Chrome/Safari | Resident payment, proof upload, leave, invoice |
| Slow network | Browser devtools throttling | Login, upload, payment status, leave |

## Resident Workflow Pass/Fail

| Flow | Pass Criteria | Result |
| --- | --- | --- |
| Login | Resident lands on `/resident/dashboard` | TODO |
| Onboarding | Required profile/document fields validated | TODO |
| Aadhaar upload | Private document stored, no public URL exposed | TODO |
| Payment proof upload | Proof required and upload succeeds | TODO |
| Payment status | Pending -> verified updates after admin action | TODO |
| Invoice download | Signed URL works and expires | TODO |
| Leave apply | Leave appears in history with pending status | TODO |
| Realtime updates | Payment/leave status refresh without full reload | TODO |

## Admin Workflow Pass/Fail

| Flow | Pass Criteria | Result |
| --- | --- | --- |
| Login | Admin lands on `/admin/dashboard` | TODO |
| Create resident | New resident appears in paginated list | TODO |
| Allocate room | Occupancy updates and over-allocation blocks | TODO |
| Verify payment | Proof preview visible, verification creates audit trail | TODO |
| Notices | Published notice appears to resident | TODO |
| Exports | CSV/XLS downloads within performance budget | TODO |
| Analytics | Metrics match seed validation counts | TODO |
| CMS updates | Public site reflects staged CMS content | TODO |

## Issue Severity Definitions

| Severity | Definition | Launch Impact |
| --- | --- | --- |
| Critical | Tenant leak, auth bypass, financial corruption, data loss | Blocks launch |
| High | Core workflow broken without workaround | Blocks launch unless release owner accepts |
| Medium | Workflow friction with workaround | Launch with mitigation |
| Low | Cosmetic or non-critical copy/layout issue | Does not block |

## UAT Report

| Field | Value |
| --- | --- |
| Staging URL | TODO |
| Release SHA | TODO |
| Test window | TODO |
| QA owner | TODO |
| Admin tester | TODO |
| Resident tester | TODO |
| Critical issues | TODO |
| High issues | TODO |
| Launch recommendation | Go / No-Go |
