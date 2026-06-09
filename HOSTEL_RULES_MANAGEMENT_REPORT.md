# Hostel Rules Management Report

## Problem

Hostel rules were not a first-class SaaS feature. Owners had to rely on printed pamphlets and manual communication, which meant rules could not be tenant-specific, searchable, versioned, accepted during onboarding, or reused across the public website and resident portal.

## Solution

Implemented a tenant-scoped Hostel Rules Management System with database-backed rules, admin management, public website rendering, resident portal review, onboarding acceptance, and version-based update detection.

Rules are no longer hardcoded as the primary source. Active rules are loaded from `hostel_rules`, grouped by category, ordered by `display_order`, and versioned from the active rule set. Legacy public terms remain only as a fallback when no rule records exist.

## Files Changed

Primary schema and types:

- `supabase/migrations/20260608070000_hostel_rules_management.sql`
- `src/types/database.ts`
- `src/types/hostel-rules.ts`
- `src/types/frontend.ts`

Rules domain layer:

- `src/repositories/hostel-rules.repository.ts`
- `src/services/hostel-rules.service.ts`
- `src/validations/hostel-rule.validation.ts`
- `src/validations/index.ts`
- `src/sdk/hostel-rules.sdk.ts`
- `src/sdk/index.ts`
- `src/hooks/use-hostel-rules.ts`
- `src/hooks/index.ts`
- `src/lib/react-query/query-keys.ts`

API routes:

- `src/app/api/hostel-rules/route.ts`
- `src/app/api/hostel-rules/[id]/route.ts`
- `src/app/api/hostel-rules/reorder/route.ts`
- `src/app/api/hostel-rules/acceptance/route.ts`

Admin UX:

- `src/app/(admin)/admin/settings/rules/page.tsx`
- `src/components/admin/settings/admin-hostel-rules-client.tsx`
- `src/components/admin/settings/admin-settings-client.tsx`
- `src/components/admin/layout/admin-sidebar.tsx`
- `src/components/admin/layout/admin-mobile-sidebar.tsx`

Public website and resident UX:

- `src/lib/cms/public-cms.ts`
- `src/components/public/terms-page-content.tsx`
- `src/constants/public-content.ts`
- `src/app/(resident)/resident/rules/page.tsx`
- `src/components/resident/resident-rules-client.tsx`
- `src/components/resident/resident-dashboard-client.tsx`
- `src/constants/navigation.ts`

Onboarding:

- `src/components/resident/onboarding/resident-onboarding-client.tsx`
- `src/services/onboarding/resident-onboarding.service.ts`
- `src/services/onboarding/resident-onboarding.policy.ts`

Tests:

- `src/tests/unit/services/hostel-rules.service.test.ts`
- `src/tests/unit/components/hostel-rules-management-static.test.ts`
- `src/tests/unit/validations/hostel-rule.validation.test.ts`
- `src/tests/security/migration-security-static.test.ts`
- `src/tests/unit/services/resident-onboarding.service.test.ts`
- `src/tests/unit/components/leave-workflow-simplification-static.test.ts`

## Schema Changes

Added `public.hostel_rules`:

- `id`
- `organization_id`
- `hostel_id`
- `category`
- `title`
- `description`
- `display_order`
- `is_active`
- `created_at`
- `updated_at`
- `created_by`
- `updated_by`
- `deleted_at`
- `deleted_by`

Supported categories:

- General
- Payments
- Discipline
- Visitors
- Leave Policy
- Safety
- Employee Accommodation
- Custom

Added `public.hostel_rule_acceptances`:

- `id`
- `organization_id`
- `hostel_id`
- `resident_id`
- `rules_version`
- `accepted_at`
- `created_at`
- `updated_at`
- `created_by`
- `updated_by`

Indexes were added for organization, hostel/category/order, active ordering, updated-at lookups, resident acceptance lookups, and version lookups.

RLS was enabled and forced on both tables. Public users can read active rules only. Authenticated residents can read active rules and manage their own acceptance records. Admin/owner mutation access is guarded by `settings.manage` in the tenant scope.

The migration also seeds default rules per active hostel, including Employee Accommodation rules.

## Admin UX

Added Settings -> Rules & Policies.

Admins can:

- Add rules.
- Edit category, title, description, display order, and visibility.
- Delete rules through soft delete.
- Enable or disable rules.
- Reorder rules with up/down controls.
- Search rules.
- Filter by category.

The UI is responsive and available from both desktop and mobile admin navigation. Drag-and-drop was not added because no existing drag-and-drop infrastructure was present; order controls reuse existing button and card patterns.

## Public Website UX

Added a database-backed Rules & Policies experience to the existing public terms page without disturbing the homepage layout.

Public visitors can:

- View active rules by category.
- Search rules.
- Filter by category.
- Expand and collapse rule details.

The public CMS loader uses the new rules table when available and falls back to legacy CMS/static terms only when there are no active rule records. Public static generation also tolerates the migration not being applied yet, avoiding noisy build-time repository errors during deployment order transitions.

## Resident UX

Added Resident Portal -> Rules & Policies.

Residents can:

- View categorized rules.
- Search and filter rules.
- See the latest rules update timestamp.
- Accept the current rules version.
- See a Rules Updated banner when their latest accepted version is stale.

The resident dashboard now surfaces a Rules Updated callout when review is needed.

## Onboarding

Resident onboarding now loads current hostel rules from the tenant rule set. New residents must confirm they have read and agreed to the current hostel rules before submitting onboarding for verification.

Acceptance is stored in `hostel_rule_acceptances` with:

- `resident_id`
- `accepted_at`
- `rules_version`

The onboarding service decorates resident metadata from the persisted acceptance record so existing policy checks continue to work while the source of truth moves into the new acceptance table.

## Rule Versioning

The current rules version is computed from active rule identity, category, title, description, display order, visibility, and `updated_at`.

When active rules change, the computed version changes. Residents with an older acceptance see the Rules Updated state and can review and accept the latest version.

## Employee Accommodation Rules

Employee Accommodation is a first-class rule category. Default seed examples include no alcohol, no smoking, cleanliness, and hostel timing expectations for employee accommodation. Admins can manage these separately from general resident rules.

## Tests Added

Added coverage for:

- Rules version stability and content-change detection.
- Rule validation schema and supported categories.
- Admin management wiring for CRUD, filters, search, and ordering.
- Public, resident, dashboard, onboarding, SDK, hook, service, repository, and API wiring.
- Migration security checks for RLS, tenant fields, acceptance storage, and Employee Accommodation category.
- Onboarding acceptance persistence against the dynamic rules version.

## Validation Results

Passed:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
  - 150 test files passed, 3 skipped.
  - 625 tests passed, 5 skipped.
- `npm run test:security`
  - 8 security test files passed, 2 skipped.
  - 74 security tests passed, 3 skipped.
- `npm run build`
  - Next.js production build completed successfully.
  - `/admin/settings/rules`, `/api/hostel-rules`, `/resident/rules`, and `/terms` are included in the route output.

## Risk Assessment

Risk is moderate because this introduces new tenant-scoped data, public rendering, resident acceptance state, and onboarding behavior.

Mitigations:

- RLS and permission checks restrict tenant data and admin mutation access.
- Public reads expose only active, undeleted rules.
- Existing homepage layout is untouched.
- Legacy public terms fallback remains available.
- Rule acceptance is stored separately from resident metadata but onboarding metadata is decorated for compatibility.
- Full lint, typecheck, unit, security, and production build gates passed.

Deployment note: apply `20260608070000_hostel_rules_management.sql` before relying on admin rule management in an environment.
