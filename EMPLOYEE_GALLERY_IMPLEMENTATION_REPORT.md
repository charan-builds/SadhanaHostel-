# Employee Accommodation Gallery Implementation Report

Date: 2026-06-08

## Summary

Employee Accommodation Rooms are now managed from the Admin Gallery area and rendered on the public employee accommodation website page from CMS data. Room images are not hardcoded; they reuse the existing gallery upload/document infrastructure with room-specific gallery categories.

Final status: GO

## Implemented Scope

- Added employee accommodation room metadata storage with tenant scope, display order, visibility, status, capacity, amenities, audit fields, soft delete fields, and RLS.
- Added Admin Gallery management for employee accommodation rooms.
- Added API, SDK, hooks, validation schemas, repository methods, and service mapping for employee accommodation rooms.
- Added public Employee Accommodation Rooms section on the employee accommodation page.
- Preserved the existing public hostel gallery and existing gallery category behavior.
- Added focused static/security coverage for admin controls, public rendering, gallery category handling, and migration security.

## Admin Panel

Admins can now manage Employee Accommodation Gallery content from `Admin > Gallery`:

- Add a room.
- Add the current room placeholders: Employee Room 1, Employee Room 2, Employee Room 3.
- Upload room images through the existing website gallery upload flow.
- Change room title.
- Change description.
- Change capacity.
- Change amenities.
- Change display order.
- Enable or disable room visibility.

Room images are stored as existing `gallery` entries using room-specific categories such as `employee-room:<room_id>`. The employee room metadata table stores the room details only.

## Public Website

The public employee accommodation page now renders an Employee Accommodation Rooms section when published visible rooms exist.

Displayed per room:

- Room images.
- Room name.
- Description.
- Capacity.
- Amenities.

Images are lazy-loaded for normal room cards. The first image can be prioritized for better above-the-fold rendering, while secondary images use lazy loading.

## Data Model

Migration added:

- `supabase/migrations/20260608042000_employee_accommodation_gallery.sql`

New table:

- `public.employee_accommodation_rooms`

Security:

- RLS enabled and forced.
- Public can read only published, visible, active, non-deleted rooms.
- Authenticated admin users can manage rows through `public.can_manage_organization(...)`.
- Room records remain scoped by `organization_id` and optional `hostel_id`.

Operational note:

- Apply the migration before managing employee room content in production.
- Public rendering safely falls back to an empty section if the migration has not yet reached Supabase schema cache during build/static generation.

## Key Files

- `src/components/admin/gallery/employee-accommodation-gallery-manager.tsx`
- `src/components/admin/gallery/admin-gallery-client.tsx`
- `src/components/public/employee-accommodation-rooms-section.tsx`
- `src/components/public/audience-hostel-page-content.tsx`
- `src/app/(public)/employee-hostel-pulivendula/page.tsx`
- `src/app/api/website/employee-rooms/route.ts`
- `src/services/website.service.ts`
- `src/repositories/website.repository.ts`
- `src/sdk/website.sdk.ts`
- `src/hooks/use-website.ts`
- `src/lib/cms/public-cms.ts`
- `src/lib/public-gallery.ts`
- `src/validations/website.validation.ts`
- `src/types/database.ts`
- `src/types/frontend.ts`

## Validation

Focused validation:

- `npx vitest run src/tests/unit/components/employee-accommodation-gallery-static.test.ts src/tests/unit/lib/public-gallery.test.ts src/tests/security/migration-security-static.test.ts` - passed, 46 tests.

Full validation:

- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npm run test` - passed, 143 files passed, 3 skipped; 599 tests passed, 5 skipped.
- `npm run build` - passed.

## Launch Verdict

GO, pending production migration application.

No employee room images are hardcoded. Admins can create rooms and upload images through the existing gallery infrastructure, and the public employee accommodation page renders only the rooms that are published and visible.
