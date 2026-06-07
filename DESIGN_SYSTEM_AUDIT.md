# Design System Audit

Date: 2026-06-07

Mode: design-system audit artifact only. No source files were modified.

## Evidence Basis

- Design doc: `docs/13-ui-design-system.md`
- Responsive doc: `docs/frontend/12-responsive-strategy.md`
- UI primitives: `src/components/ui/**`
- Shared components: `src/components/shared/**`, `src/components/system/**`
- Feature components: admin, resident, auth, public component folders.

## Executive Summary

The app has a real design system foundation: tokens, shadcn/Radix-compatible primitives, shared page headers, metric cards, data table shells, loading/error/empty states, status badges, and responsive containers. The main consistency gap is adoption. Some feature pages still build local patterns instead of leaning on shared wrappers, especially for filters, tables, form actions, and mobile states.

Preserve existing branding: calm premium SaaS, blue/teal trust palette, light default theme, dense admin surfaces, mobile-clear resident surfaces.

## Inconsistencies

### P1: Table/List Patterns Differ By Feature

- Evidence: Residents use `DataTableShell`; leaves use a local table wrapper; notices use card list; reports use card exports; payments use custom table and filters.
- Impact: Users relearn filtering, pagination, and actions on every page.
- Standardization rule: Every admin list uses one of two approved patterns: `DataTableShell` desktop table or mobile record cards.

### P1: Filter Controls Lack A Single Pattern

- Evidence: Notices use status select; payments use status and search; owner dashboard uses date/hostel card; residents use search/status/type.
- Impact: Filtered-empty states are harder to understand.
- Standardization rule: Search stays visible; secondary filters move into a shared filter bar/drawer with active chips and reset.

### P1: Mobile Admin Pattern Is Underdefined

- Evidence: Responsive strategy doc still lists TODOs for mobile admin navigation, table-to-card breakpoint, responsive QA checklist, dashboard card layout.
- Impact: New screens may regress into desktop-first layouts.
- Standardization rule: For admin pages, define mobile card alternative by default when a table has more than four columns.

### P1: Action Hierarchy Is Inconsistent

- Evidence: Some pages use page-header primary buttons, some card-header buttons, some row buttons, some dropdown menus.
- Impact: Users may miss primary actions.
- Standardization rule: One primary page action in `PageHeader`; row actions grouped as primary visible action plus overflow menu.

### P2: Loading States Are Good But Not Uniform

- Evidence: Shared `LoadingState` exists, but some pages use local skeletons or text loading.
- Impact: Perceived quality varies by page.
- Standardization rule: Use `LoadingState` variants for page-level loads; local skeletons only for specialized content like notice cards or QR areas.

### P2: Empty States Are Present But Often Passive

- Evidence: Many empty states say records will appear later.
- Impact: New tenants do not know the next setup action.
- Standardization rule: Empty states must include one action when the user can recover.

### P2: Status Labels Need A Shared Business Dictionary

- Evidence: `StatusBadge` exists; features also render custom labels for pinned notices, priority, and identity modes.
- Impact: Status meaning can drift across modules.
- Standardization rule: All business statuses map through `StatusBadge` or a shared status dictionary.

### P2: Motion Use Needs A Clear Budget

- Evidence: Framer Motion is used across admin/resident/public components; shared `MotionReveal` exists.
- Impact: Too much motion can feel decorative and cost performance.
- Standardization rule: Motion should be limited to page entry, card reveal, and important state transitions; respect reduced-motion.

## Standardization Rules

### Colors

- Use semantic tokens only: primary, success, warning, info, destructive, muted, border.
- Do not introduce feature-local raw color palettes.
- Business statuses must map to semantic tokens.

### Spacing

- Page rhythm: 24-32px gaps.
- Card content: 16px default.
- Dense table rows: keep compact but readable.
- Mobile form sections: 16px internal, 24px between groups.

### Typography

- Page title: shared `PageHeader`.
- Section title: 18-22px.
- Table text: 13-14px.
- Avoid hero-scale text inside admin/resident workspace cards.

### Buttons

- Primary action: `Button` default.
- Secondary action: `outline`.
- Toolbar/nav action: `ghost`.
- Dangerous action: `destructive`.
- Icon-only buttons need accessible labels.

### Inputs

- Labels required.
- Field errors placed immediately below the field.
- Date/amount/UPI/reference fields get helper text where mistakes are common.

### Tables

- Desktop: dense table.
- Mobile: card list unless the table has very few columns.
- Always include loading, empty, error, filters, pagination, and row action rules.

### Cards

- Cards for metrics, repeated items, and framed tools.
- Avoid nesting cards.
- Keep dashboard cards scan-first, not decorative.

### Modals And Sheets

- Use dialogs for short decisions/forms.
- Use sheets for contextual editing and mobile workflows.
- Dialog content must have internal scroll and sticky footer for long forms.

## Reusable Component Strategy

### Add Or Standardize These Shared Patterns

| Pattern | Purpose | Priority |
|---|---|---:|
| `MobileRecordCard` | Mobile alternative for admin tables | P1 |
| `FilterDrawer` / `FilterChips` | Consistent filtering | P1 |
| `ActionQueue` | Owner/admin prioritized work | P1 |
| `Stepper` | Resident payment/onboarding flows | P1 |
| `InlineSuccessState` | Persistent confirmation for money/lifecycle actions | P2 |
| `KpiHelpTooltip` | Metric definitions | P2 |

## Acceptance Criteria

- All new admin list screens use shared table/card/filter patterns.
- All mobile screens pass 390px no-overlap/no-body-scroll check.
- All empty states either explain a true empty state or provide an action.
- All destructive actions use confirmation with clear consequence.
- All key business metrics include definition or tooltip.

## Final Verdict

The design system is strong enough to scale, but needs stricter pattern adoption before large UI expansion.
