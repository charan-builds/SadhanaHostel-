# Product UX Audit

Date: 2026-06-07

Project: Sadhana Hostel Management SaaS

Mode: audit artifact only. No source code, UI, layout, provider, styling, image, translation, migration, package, or test files were modified.

## Evidence Basis

- Branch inspected: `backend-feature-migration`
- Baseline UI truth: `origin/main`
- Forbidden UI diff scan against `origin/main`: PASS, no public/resident/admin UI, provider, layout, translation, image, artifact, Lighthouse, or browser-profile diffs found.
- Review method: static route/component/service/docs inspection. Authenticated browser walkthrough was not executed because no current staging/local credentials were available in this shell.
- Primary UI evidence:
  - Admin routes under `src/app/(admin)/admin/**`
  - Resident routes under `src/app/(resident)/resident/**`
  - Auth routes under `src/app/(auth)/**`
  - Shared UI primitives under `src/components/ui`, `src/components/shared`, and `src/components/system`
  - Product design docs: `docs/13-ui-design-system.md`, `docs/frontend/12-responsive-strategy.md`

## Severity Model

- P0: Blocks core launch usability or can cause serious operational mistakes.
- P1: High-friction workflow that should be fixed before broad rollout.
- P2: Polish or growth improvement that can follow after launch.

## Executive Summary

The product has a credible operational foundation: dashboards, resident lifecycle, payments, leaves, notices, reports, support recovery, analytics, and shared loading/error/empty primitives all exist. The biggest UX risk is not visual quality; it is workflow clarity under real hostel operations.

P0 findings: none from static review.

Highest-priority P1 themes:

- Attendance/gate-pass is not a first-class product flow.
- Complaints are implemented as support/recovery, but not yet a full maintenance lifecycle.
- Admin data-heavy pages rely on dense tables and modal workflows that need mobile/tablet alternatives.
- Owner dashboard needs clearer "what changed, what to do now" decisions.
- Reports are export-only and do not yet answer common owner questions in-app.

## Findings

### P1: Attendance And Gate-Pass Flow Is Missing

- Area: Attendance flows
- Evidence: No dedicated attendance route or component was found; leave flows exist, but attendance/gate-pass is only referenced in docs and competitive context.
- User impact: Owners and wardens cannot verify presence, late return, night attendance, or gate movement inside the system.
- Recommended fix: Add a v1 attendance/gate-pass module with resident status, manual mark, bulk mark, late return, export, and parent/guardian notification hooks.
- Expected business impact: Moves the product from payment/records SaaS to daily hostel operations SaaS; improves owner confidence and safety positioning.

### P1: Complaints Are Too Generic For Maintenance Operations

- Area: Complaints/support
- Evidence: Resident support categories include maintenance, safety, lost/found, room, account, payment, and onboarding; there is no dedicated assignment/SLA/technician workflow in inspected UI.
- User impact: Residents can submit issues, but admins may not get operational queues by owner, assignee, due date, photo proof, SLA, or closure feedback.
- Recommended fix: Convert support requests into a complaint/maintenance board with status lanes, assignee, priority, SLA timer, photo attachment, resolution notes, and resident feedback.
- Expected business impact: Reduces WhatsApp dependence and creates proof that issues are handled professionally.

### P1: Admin Dashboard Has Metrics, But Weak Decision Hierarchy

- Area: Owner/admin dashboard
- Evidence: Admin dashboard shows registered residents, active residents, monthly revenue, pending dues, operational alerts, and quick links.
- User impact: Owners can scan numbers, but still must decide manually where to act first.
- Recommended fix: Add a top "Today needs attention" queue ranked by money risk, onboarding blockers, pending payments, unresolved complaints, and expiring leave.
- Expected business impact: Higher daily usage and faster conversion from dashboard view to action.

### P1: Resident Payment Flow Is Powerful But Long

- Area: Resident payments
- Evidence: Payment page handles due amount, advance, partial payment, generated reference, UPI link/QR, proof upload, support link, validation, and history.
- User impact: Strong functionality, but first-time residents may not understand the sequence: amount -> UPI app -> screenshot -> submit -> pending verification.
- Recommended fix: Add a compact stepper: "1 Pay by UPI, 2 Upload screenshot, 3 Wait for verification"; keep due card sticky/top on mobile.
- Expected business impact: Fewer payment support requests and fewer incomplete submissions.

### P1: Notice Authoring Exposes Unsupported Audience Choices

- Area: Notice flows
- Evidence: Admin notice form lists `all`, `hostel`, `room`, `residents`, and `roles`; backend targeting currently supports all/hostel/residents safely, while room/role audience support has been documented as a fail-closed gap.
- User impact: Admins may choose room/role audiences that do not behave as expected.
- Recommended fix: Disable room/role options until supported, or add inline "coming soon" labels and route them away from publishable production notices.
- Expected business impact: Prevents communication mistakes and support escalations.

### P1: Reports Are Export-Oriented, Not Decision-Oriented

- Area: Reports flows
- Evidence: Reports page offers CSV downloads for payments, residents, and leaves, with basic summary metrics.
- User impact: Owners must open spreadsheets to answer common questions like "who owes money?", "who joined this month?", "which room is under-filled?", and "which residents need follow-up?"
- Recommended fix: Add in-app report previews, saved report presets, date filters, and one-click "send to owner" export.
- Expected business impact: Makes reporting valuable for non-technical owners and reduces reliance on Excel.

### P1: Resident Dashboard Needs Stronger Next-Best Action

- Area: Resident dashboard
- Evidence: Resident dashboard shows five metrics and five quick actions.
- User impact: Residents can navigate, but the product does not clearly say the single most important thing to do now.
- Recommended fix: Add a priority action card: pay due, complete profile, upload missing document, view urgent notice, or check leave status.
- Expected business impact: Higher resident completion and fewer admin reminders.

### P1: Mobile Admin Navigation Is Serviceable But Crowded

- Area: Admin flows/mobile
- Evidence: Admin navigation includes many modules: dashboard, owner dashboard, leads, residents, finance subpages, payments, leaves, notices, website CMS, gallery, reports, alerts, password resets, launch readiness, automation, staff access, settings.
- User impact: Admin mobile users can open a sheet, but finding the right task during hostel operations may take too long.
- Recommended fix: Add mobile task groups: "Today", "Residents", "Money", "Communication", "Operations", "Settings"; show only top tasks first.
- Expected business impact: Better owner/admin mobile adoption during on-ground operations.

### P1: Owner Dashboard Filters Are Functional But Not Insightful

- Area: Owner flows
- Evidence: Owner dashboard includes hostel/date filters and export actions.
- User impact: Owners get metrics but may not know whether today is good or bad without targets, deltas, or anomalies.
- Recommended fix: Add KPI thresholds, trend labels, target vs actual, and "needs action" explanations.
- Expected business impact: Helps owners trust analytics and act without needing support.

### P2: Authentication Flows Need More Assurance Copy

- Area: Authentication flows
- Evidence: Login, activation, forgot/reset password, unauthorized, and onboarding routes exist.
- User impact: Residents with phone/password or temporary password flows can get stuck if they do not understand why a reset/activation step is required.
- Recommended fix: Add clear "why this is required" text, support link, and expected next step on activation/reset forms.
- Expected business impact: Lower login support load during rollout.

### P2: Tables Need Mobile Card Alternatives On High-Use Admin Pages

- Area: Residents, payments, leaves, reports
- Evidence: Shared tables support horizontal overflow; resident and payment pages are data-heavy.
- User impact: Horizontal scrolling is acceptable for power users but slow for wardens on phones.
- Recommended fix: For mobile, render record cards with primary fields and one visible action; keep table on desktop.
- Expected business impact: Faster mobile operations without losing dense desktop power.

### P2: Empty States Are Present But Not Always Actionable

- Area: Empty states
- Evidence: Shared EmptyState exists and many screens use it, but several messages simply explain that records will appear.
- User impact: New users may not know what to do next.
- Recommended fix: Every empty state should include one primary action or diagnostic link when recoverable.
- Expected business impact: Faster setup and fewer "blank screen" support questions.

### P2: Success Feedback Is Mostly Toast-Based

- Area: Feedback states
- Evidence: Payments, residents, support, exports, and notices use `toast.success`.
- User impact: Transient confirmation can disappear before users understand what changed.
- Recommended fix: For important operations, add persistent inline success summaries with next actions.
- Expected business impact: Better confidence for money and resident lifecycle operations.

### P2: Reports And Analytics Need Plain-Language Definitions

- Area: Owner/admin analytics
- Evidence: Metrics like pending dues, pending verification, revenue, and communication metrics are present.
- User impact: Owners may interpret metrics differently from backend definitions.
- Recommended fix: Add tooltip/help text for each KPI, including calculation basis and update timing.
- Expected business impact: Fewer disputes over finance numbers and higher owner trust.

## Flow Coverage Summary

| Flow | Current UX State | Priority |
|---|---|---:|
| Owner dashboard | Functional, needs decision hierarchy | P1 |
| Admin dashboard | Strong operational base, needs ranked action queue | P1 |
| Resident dashboard | Mobile-friendly base, needs next-best action | P1 |
| Authentication | Broad coverage, needs clearer recovery copy | P2 |
| Notice management | Functional, audience mismatch needs guardrail | P1 |
| Complaints/support | Good start, needs maintenance lifecycle | P1 |
| Payments | Feature-rich, needs stepper and mobile simplification | P1 |
| Attendance | Missing as first-class flow | P1 |
| Reports | Export-only, needs in-app decision views | P1 |

## Final UX Verdict

GO for continued product rollout planning.

Not yet GO for "best-in-class hostel SaaS UX" until P1 workflow gaps are addressed.
