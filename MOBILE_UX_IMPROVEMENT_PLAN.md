# Mobile UX Improvement Plan

Date: 2026-06-07

Mode: mobile UX planning artifact only. No source files were modified.

## Evidence Basis

- Static review of admin, resident, auth, payments, notices, reports, support, and layout components.
- Target viewports for future validation: `390x844`, `768x1024`, `1440x900`.
- Browser walkthrough not executed because authenticated credentials were not available in this shell.
- `docs/frontend/12-responsive-strategy.md` still contains TODOs for mobile admin navigation, table-to-card breakpoints, responsive QA checklist, and dashboard card layout.

## Executive Summary

Resident mobile UX is the stronger side of the product: bottom navigation exists, resident pages use cards, and payments/support flows are mobile-aware. Admin mobile UX is the bigger opportunity. Admin pages are operationally dense and need mobile task grouping, card alternatives to tables, and fewer modal-heavy workflows.

## Highest-Impact Improvements

### P1: Replace High-Use Admin Tables With Mobile Record Cards

- Screens: Residents, Payments, Leaves, Reports, Collections, Followups, Receipts, Reconciliation.
- Problem: Tables use horizontal overflow, which preserves data but slows mobile decisions.
- Implementation steps:
  1. Keep desktop table rendering at `lg` and above.
  2. Add mobile card rows below `lg`.
  3. Each card must show title, status, primary amount/date, secondary context, and one primary action.
  4. Move secondary actions into a `DropdownMenu`.
  5. Keep pagination controls full-width on mobile.
- Expected impact: Faster owner/admin mobile work and fewer accidental row/action taps.
- Difficulty: Medium.

### P1: Create Mobile Admin Task Navigation

- Screens: Admin shell and admin mobile sheet.
- Problem: Mobile sheet lists too many modules at the same hierarchy.
- Implementation steps:
  1. Group navigation into Today, Residents, Money, Communication, Operations, Settings.
  2. Put urgent counts next to group labels.
  3. Surface three quick actions at top: Add resident, Record payment, Publish notice.
  4. Keep full module list behind "All tools".
- Expected impact: Admins can complete daily work from phones without scanning 15+ links.
- Difficulty: Medium.

### P1: Make Resident Payment Flow Step-Based

- Screen: Resident payments.
- Problem: UPI amount, QR, app links, reference, proof upload, partial/advance toggles, and history compete for attention.
- Implementation steps:
  1. Add a three-step mobile header: Pay, Upload proof, Track verification.
  2. Keep payable amount and due date in a top sticky card.
  3. Collapse advanced controls behind "Partial or advance payment".
  4. Show upload progress and pending verification in the same step.
- Expected impact: Fewer support requests and incomplete resident payments.
- Difficulty: Medium.

### P1: Improve Mobile Form Ergonomics

- Screens: Resident profile, resident support, resident leave, resident onboarding, resident payment, admin resident form, notices.
- Problem: Long forms require too much scrolling and do not always show progress.
- Implementation steps:
  1. Break long forms into sections with visible completion states.
  2. Keep submit buttons sticky at bottom for mobile only.
  3. Add field-specific helper text for phone, UPI reference, document upload, and rejection reason.
  4. Auto-focus first invalid field after submit.
- Expected impact: Higher completion and lower validation frustration.
- Difficulty: Medium.

### P1: Standardize Mobile Filter Bars

- Screens: Residents, payments, leaves, notices, owner dashboard, finance pages.
- Problem: Filters vary between inline select, search input, card header, and page-local controls.
- Implementation steps:
  1. Use a shared mobile filter drawer for more than two filters.
  2. Show active filter chips under page header.
  3. Add "Reset filters" when any filter is active.
  4. Keep search visible for list-heavy pages.
- Expected impact: Better scanning and fewer hidden filtered-empty states.
- Difficulty: Low to Medium.

## Screen-Specific Plan

| Area | Current Mobile Risk | Fix | Priority |
|---|---|---|---:|
| Admin dashboard | Many cards and alerts can bury daily action | Add "Today needs attention" at top | P1 |
| Owner dashboard | Date filters and exports consume top space | Compact KPI-first layout, filters in drawer | P1 |
| Residents | Dense table/actions | Mobile resident cards with one visible CTA | P1 |
| Payments | Table plus verification dialogs | Mobile payment review cards | P1 |
| Leaves | Table rows show IDs instead of resident names | Mobile leave cards with dates and action buttons | P1 |
| Notices | Notice cards work, but audience controls need clarity | Disable unsupported audience options | P1 |
| Reports | Export cards are okay but not analytical | Add preview cards before download | P2 |
| Resident dashboard | Good mobile base | Add next-best action card | P1 |
| Resident payments | Long flow | Stepper and sticky payable card | P1 |
| Resident support | Strong base | Add attachment and status timeline later | P2 |
| Auth | Form shell likely OK | Add recovery/support path on every failure | P2 |

## Responsive QA Checklist

- [ ] No horizontal body scroll at `390x844`.
- [ ] Every tap target is at least 44px high or equivalent usable area.
- [ ] Primary action is visible without opening overflow on top workflows.
- [ ] Tables have mobile cards or acceptable horizontal scroll with sticky first column.
- [ ] Forms show field-level errors near fields.
- [ ] Submit actions show pending state and cannot double-submit.
- [ ] Dialogs fit within viewport and scroll internally.
- [ ] Bottom navigation does not cover form submit buttons.
- [ ] Toasts do not hide critical bottom actions.
- [ ] Empty/error/loading states remain useful on mobile.

## Implementation Order

1. Build shared mobile record-card pattern for admin lists.
2. Apply it to Payments, Residents, Leaves.
3. Add mobile admin task navigation groups.
4. Add resident payment stepper and sticky payable card.
5. Standardize filters with mobile drawer/chips.
6. Run viewport QA at `390x844`, `768x1024`, and `1440x900`.

## Final Priority

Start with Admin Payments, Admin Residents, Resident Payments, and Admin mobile navigation. These are the highest-frequency workflows with the strongest business impact.
