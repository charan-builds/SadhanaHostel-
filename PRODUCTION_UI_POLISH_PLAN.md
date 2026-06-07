# Production UI Polish Plan

Date: 2026-06-07

Mode: UI polish planning artifact only. No source files were modified.

## Evidence Basis

- Static review of shared `LoadingState`, `EmptyState`, `ErrorState`, `APIErrorState`, `Toaster`, forms, and high-use feature screens.
- Authenticated browser pass not executed due missing credentials in this shell.

## Executive Summary

The product does not feel unfinished because primitives are missing; it feels unfinished in places where workflow states are not persistent or specific enough. Money, resident lifecycle, support, and notices need stronger "what just happened / what next" states.

## Exact Screens And Fixes

### P1: Resident Payments

- Issue: Complex payment process relies on validation messages and toasts.
- Fix: Add stepper, sticky payable card, persistent submitted state, pending verification explanation, and "contact support" fallback.
- State coverage:
  - Loading: skeleton for due/payment settings.
  - Empty: no dues with next due date.
  - Error: payment settings unavailable.
  - Success: proof submitted and verification pending.
  - Validation: screenshot, amount, partial/advance, UPI reference.

### P1: Admin Payments

- Issue: Payment verify/reject actions are modal/toast-driven and table-heavy.
- Fix: Add payment review drawer with proof preview, resident summary, amount, linked fee record, and persistent verification outcome.
- State coverage:
  - Loading: table skeleton.
  - Empty: no pending payments with link to payment settings.
  - Error: retry and diagnostics.
  - Success: verified payment summary with invoice/receipt note.

### P1: Admin Residents

- Issue: Many resident lifecycle actions exist, but action consequences are hard to compare.
- Fix: Add resident action drawer with lifecycle status, pending docs, room status, invite state, and suggested next action.
- State coverage:
  - Empty: no residents -> Add Resident.
  - Error: retry.
  - Success: invite sent, repair complete, checkout complete with next action.

### P1: Owner Dashboard

- Issue: Metrics exist but lack "good/bad/needs action" interpretation.
- Fix: Add KPI definitions, thresholds, deltas, and a ranked action queue.
- State coverage:
  - Empty: no data -> add residents/payments.
  - Warning: pending dues or incomplete onboarding.
  - Success: all clear operational state.

### P1: Notices

- Issue: Audience choices and acknowledgement state need clearer feedback.
- Fix: Add audience preview, read/ack stats, unsupported audience guard, and after-publish summary.
- State coverage:
  - Draft saved.
  - Published to audience count.
  - Acknowledgement required.
  - Notice expired/archived.

### P1: Support/Complaints

- Issue: Resident can submit support, but tracking is basic.
- Fix: Add timeline, status explanations, expected response window, and resolution feedback.
- State coverage:
  - Submitted.
  - Staff reviewing.
  - Needs resident info.
  - Resolved.
  - Reopened.

### P1: Leaves

- Issue: Admin leave table uses resident ID and compact rows; resident context is thin.
- Fix: Show resident name/admission/phone, leave duration, overlap warning, approve/reject consequences, and timeline.
- State coverage:
  - Pending.
  - Approved.
  - Rejected with reason.
  - Departed/returned if enabled.

### P2: Reports

- Issue: Reports are download cards only.
- Fix: Add report preview, row count, generated timestamp, date range, and empty report explanation.

### P2: Auth

- Issue: Recovery flows can be stressful.
- Fix: Add support fallback, expected link expiry, password requirements, and "already activated?" path.

### P2: Settings/Operations

- Issue: Operational tools can be high-risk.
- Fix: Add stronger dry-run summaries, destructive confirmation copy, and result reports.

## Global Polish Rules

- Loading: use skeletons for first load, spinners only inside buttons.
- Empty: include one action whenever recoverable.
- Error: include retry plus support/diagnostic route for account-linking problems.
- Success: persistent inline summary for money/lifecycle changes.
- Validation: field-level first, form-level only for cross-field rules.
- Skeletons: match final layout dimensions.
- Toasts: use for quick confirmation only; do not rely on toast for irreversible/money actions.

## Acceptance Criteria

- Every P1 screen has loading, empty, error, success, and validation states.
- Every money/lifecycle action has a persistent outcome state.
- Every recoverable empty state has one action.
- Every destructive action names the consequence.
- Mobile views do not hide submit/status feedback behind bottom navigation.

## Final Recommendation

Prioritize resident payment polish, admin payment review, resident lifecycle action drawer, support timeline, and owner action queue.
