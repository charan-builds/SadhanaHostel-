# Sadhana Hostel V2 Master Plan

Date: 2026-06-07

Mode: master product roadmap artifact only. No source files were modified.

## Summary

This master plan combines:

- `PRODUCT_UX_AUDIT.md`
- `MOBILE_UX_IMPROVEMENT_PLAN.md`
- `RESIDENT_EXPERIENCE_ROADMAP.md`
- `OWNER_DASHBOARD_V2.md`
- `DESIGN_SYSTEM_AUDIT.md`
- `PERFORMANCE_OPTIMIZATION_PLAN.md`
- `PRODUCTION_UI_POLISH_PLAN.md`
- `COMPETITIVE_FEATURE_GAP_ANALYSIS.md`
- `GROWTH_ROADMAP.md`

Goal: make Sadhana Hostel the best practical hostel/PG management SaaS for India by improving UX, mobile operations, owner insight, automation, competitive feature coverage, and scale readiness.

## Phase 1 - Critical UX Fixes

| Item | Effort | Impact | Priority | Dependencies |
|---|---:|---:|---:|---|
| Resident payment stepper and sticky payable card | M | High | P1 | Existing resident payments |
| Owner/Admin "Today needs attention" queue | M | High | P1 | Dashboard analytics, operational alerts |
| Notice audience guardrails | S | High | P1 | Existing notice backend |
| Persistent success states for money/lifecycle actions | M | High | P1 | Shared state components |
| Mobile admin record cards for Payments, Residents, Leaves | M | High | P1 | Shared mobile card pattern |
| Actionable empty states across high-use pages | S | Medium | P1 | Shared EmptyState |

## Phase 2 - Mobile Improvements

| Item | Effort | Impact | Priority | Dependencies |
|---|---:|---:|---:|---|
| Mobile admin grouped navigation | M | High | P1 | Existing admin navigation |
| Shared filter drawer and active chips | M | Medium | P1 | Search/filter patterns |
| Mobile form sticky submit and progress sections | M | Medium | P1 | Form components |
| Resident dashboard next-best-action card | S | High | P1 | Resident dashboard data |
| Mobile viewport QA checklist in release process | S | Medium | P1 | Playwright/manual QA |

## Phase 3 - Dashboard Improvements

| Item | Effort | Impact | Priority | Dependencies |
|---|---:|---:|---:|---|
| Money Control Center | M | High | P1 | Finance dashboard, payment repository |
| Resident lifecycle funnel | M | High | P1 | Resident lifecycle data |
| Communication health widget | M | Medium | P1 | Notice read/ack, notifications |
| Owner daily digest | M | High | P1 | Notification templates, scheduler |
| Report previews and saved presets | M | Medium | P2 | Report builder service |

## Phase 4 - Automation Features

| Item | Effort | Impact | Priority | Dependencies |
|---|---:|---:|---:|---|
| Complaint/maintenance lifecycle | L | High | P1 | Support request model |
| Payment reminder monitoring and owner actions | M | High | P1 | Payment reminder job |
| Document/KYC checklist and admin queue | M | High | P1 | Upload/document metadata |
| Attendance/gate-pass v1 | L | High | P1 | New attendance/gate-pass schema |
| Notice follow-up automation | M | Medium | P2 | Notice engagement metrics |

## Phase 5 - Competitive Features

| Item | Effort | Impact | Priority | Dependencies |
|---|---:|---:|---:|---|
| Multi-property owner portfolio | L | High | P1 | Multi-hostel UX, owner analytics |
| Mess/menu and food feedback | L | Medium | P2 | New mess/menu model |
| Visitor management | L | Medium | P2 | New visitor workflow |
| Expense/P&L ledger | M | Medium | P2 | Finance module |
| WhatsApp-first owner actions | L | High | P2 | Notification/provider setup |
| Parent/guardian notifications | L | Medium | P2 | Guardian contact model |

## Phase 6 - Scale Readiness

| Item | Effort | Impact | Priority | Dependencies |
|---|---:|---:|---:|---|
| Analytics query optimization | M/L | High | P1 | SQL/RPC summaries |
| Split large client components | M | Medium | P1 | Route/component refactor |
| Bundle budget and route performance tracking | S | Medium | P1 | Build/report tooling |
| DR live drill and evidence cadence | M | High | P1 | DR tooling/credentials |
| External monitoring and alerting | M | High | P1 | Log ingestion |
| Self-serve onboarding and CSV import | M | High | P2 | Setup wizard/import validation |

## Recommended Execution Order

1. Resident payment stepper, notice guardrails, owner action queue.
2. Mobile admin cards and navigation grouping.
3. Complaint/maintenance lifecycle and document checklist.
4. Money control center, lifecycle funnel, communication health.
5. Attendance/gate-pass v1.
6. Performance and analytics query optimization.
7. Multi-property portfolio and growth features.

## Product Principles

- Preserve production UI branding.
- Keep admin surfaces dense, calm, and task-first.
- Keep resident surfaces mobile-first and action-first.
- Prefer action queues over decorative dashboards.
- Every metric must answer "so what?"
- Every empty/error/success state must tell users what to do next.
- Do not add AI before core workflows are stable and trusted.

## Success Metrics

| Area | Metric |
|---|---|
| Resident payments | Submission completion rate, support requests per payment |
| Owner dashboard | Daily active owner usage, action queue completion |
| Admin operations | Payment verification time, resident onboarding time |
| Complaints | Time to first response, time to resolution, satisfaction |
| Notices | Read rate, acknowledgement rate |
| Mobile | Mobile task completion, horizontal scroll defects |
| Growth | Demo-to-paid conversion, activation time, churn |
| Scale | Route load time, query latency, error rate |

## Final Roadmap Verdict

The best path is not a visual rewrite. It is a workflow upgrade:

1. Make every daily action obvious.
2. Make resident mobile tasks simple.
3. Make owner money and risk visible.
4. Add attendance, complaint lifecycle, and daily digest.
5. Optimize for scale after workflows are trusted.

This sequence turns Sadhana Hostel from a working system into a polished, scalable hostel management SaaS for India.
