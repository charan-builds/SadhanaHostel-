# Performance Optimization Plan

Date: 2026-06-07

Mode: performance planning artifact only. No source files were modified.

## Evidence Basis

- Static route/component/dependency inspection.
- Release context reports record `npm run build` passing.
- Fresh build/bundle profiling was not rerun during this report generation.

## Executive Summary

The application is operationally broad and depends on client-heavy dashboards, React Query, Supabase, Framer Motion, QR generation, PDF generation, and many authenticated API routes. The biggest likely performance wins are route-level code splitting, query payload discipline, mobile table rendering, analytics query bounding, and reducing unnecessary client-side work on pages where the user only needs a summary.

## Findings

### P1: Large Client Components Should Be Split By Workflow

- Areas: Resident payments, admin residents, admin payments, owner dashboard, finance pages.
- Evidence: Resident payments combines ledger, QR generation, UPI app links, proof upload, invoice downloads, support links, and history in one client component.
- Expected impact: Faster route hydration and lower mobile memory.
- Difficulty: Medium.
- Recommended implementation: Split large pages into summary, form, history, and modal subcomponents; lazy-load rarely used sections like history/export/proof preview.

### P1: Resident Payment QR Generation Runs Client-Side

- Area: Resident payments.
- Evidence: `qrcode` dependency and QR generation in resident payment component.
- Expected impact: Medium on low-end mobile devices.
- Difficulty: Medium.
- Recommended implementation: Lazy-load QR generation only after amount/reference is valid, or serve generated QR from backend/payment settings where possible.

### P1: Framer Motion Is Widely Used In Authenticated Workspaces

- Areas: Admin dashboard, residents, payments, profile, public previews.
- Expected impact: Medium, especially on low-end mobile.
- Difficulty: Low to Medium.
- Recommended implementation: Use shared reduced-motion-aware wrapper, remove blur filters from dense admin list entries, and avoid staggering long lists.

### P1: Analytics Repository Reads Large Ranges

- Area: analytics backend.
- Evidence: static search found `.range(0, 50_000)` in analytics repository paths.
- Expected impact: High as tenant data grows.
- Difficulty: Medium to High.
- Recommended implementation: Push aggregations into SQL/RPC views, bounded date windows, materialized summary tables, or indexed aggregate queries.

### P1: Admin Pages Pull Multiple Queries On Initial Dashboard Load

- Area: Admin dashboard.
- Evidence: Dashboard loads analytics, residents, payments, and leaves concurrently.
- Expected impact: Medium.
- Difficulty: Medium.
- Recommended implementation: Make analytics service return the dashboard summary and top rows needed for first paint; lazy-load secondary timeline/table details.

### P1: Tables Load More Rows Than Mobile Needs

- Areas: payments, resident payments, leaves.
- Evidence: several client calls use page sizes around 50 for list/history pages.
- Expected impact: Medium.
- Difficulty: Low.
- Recommended implementation: Use 10-20 rows on mobile, 25-50 on desktop, and server-driven pagination for history sections.

### P2: Export Generation Is Synchronous From User Perspective

- Areas: reports, owner export, payments export.
- Expected impact: Medium for large tenants.
- Difficulty: Medium.
- Recommended implementation: For large exports, move to async job with notification/download link; keep small CSV direct.

### P2: Public Image/Animation Surfaces Need Ongoing Budget

- Areas: public gallery, hero/previews, social/icon images.
- Expected impact: Medium for public SEO and conversion.
- Difficulty: Medium.
- Recommended implementation: Define image size budgets, prefetch priority rules, and reduce client motion on public pages where static content can render server-side.

### P2: Bundle Budget Is Not Documented

- Area: release process.
- Expected impact: Medium.
- Difficulty: Low.
- Recommended implementation: Add a bundle budget report to release checklist and track top route chunks.

## Priority Matrix

| Item | Impact | Difficulty | Priority |
|---|---:|---:|---:|
| Split resident payment component | High | Medium | P1 |
| Bound analytics heavy queries | High | Medium/High | P1 |
| Lazy-load QR generation | Medium | Medium | P1 |
| Simplify admin dashboard initial payload | Medium | Medium | P1 |
| Mobile page-size reduction | Medium | Low | P1 |
| Reduce motion in dense lists | Medium | Low | P1 |
| Async export jobs | Medium | Medium | P2 |
| Bundle budget tracking | Medium | Low | P2 |

## Test Plan

- Run `npm run build` before and after changes.
- Capture route chunk sizes for admin dashboard, resident payments, owner dashboard, public home.
- Use Playwright/mobile trace for `390x844` resident payment and admin payments.
- Measure:
  - first contentful render for authenticated shells
  - time to interactive
  - API request count per route
  - largest query payloads
  - mobile long-task count

## Final Recommendation

Start with resident payments, analytics query bounding, and admin dashboard initial payload. These are the most likely to affect real users as data grows.
