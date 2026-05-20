# Routing Structure

## Purpose

Document the Next.js App Router structure for public pages, admin ERP routes, resident portal routes, and future API route handlers.

## Overview

The platform uses route groups to keep public, admin, and resident areas separated without adding group names to URLs. Each area can have its own layout, navigation, loading UI, error boundaries, and authorization guards.

## Current Route Groups

```txt
src/app
├── (public)
├── (admin)
└── (resident)
```

## Public Routes

| Route | Purpose | Data Source | Future CMS Controlled |
| --- | --- | --- | --- |
| `/` | Home page | Static initially | Yes |
| `/about` | Hostel overview | CMS page content | Yes |
| `/rooms` | Room types and pricing | CMS and room data | Yes |
| `/facilities` | Facility list | CMS content | Yes |
| `/gallery` | Images and albums | Supabase Storage and gallery tables | Yes |
| `/contact` | Contact details and inquiry form | Website settings and inquiries | Yes |
| `/terms` | Policies and terms | CMS document | Yes |

## Admin Routes

| Route | Purpose | Auth Required | Permission Area |
| --- | --- | --- | --- |
| `/admin` | Redirect to dashboard | Yes | Admin access |
| `/admin/dashboard` | Operational overview | Yes | Dashboard read |
| `/admin/residents` | Resident management | Yes | Residents |
| `/admin/payments` | Fees, dues, invoices, receipts | Yes | Payments |
| `/admin/rooms` | Room and bed management | Yes | Rooms |
| `/admin/leaves` | Leave approval and tracking | Yes | Leaves |
| `/admin/website` | Public website CMS | Yes | CMS |
| `/admin/notifications` | Notices and notification campaigns | Yes | Notifications |
| `/admin/settings` | Hostel and integration settings | Yes | Settings |

## Resident Routes

| Route | Purpose | Auth Required | Data Scope |
| --- | --- | --- | --- |
| `/resident` | Redirect to resident dashboard | Yes | Own resident profile |
| `/resident/dashboard` | Resident summary | Yes | Own records |
| `/resident/profile` | Profile and documents | Yes | Own records |
| `/resident/payments` | Dues, invoices, receipts | Yes | Own payments |
| `/resident/leave` | Leave request and history | Yes | Own leave requests |
| `/resident/notices` | Notices and announcements | Yes | Targeted notices |

## Future API Route Placeholders

```txt
src/app/api
├── auth
│   └── callback
├── residents
├── rooms
├── payments
│   ├── cashfree
│   │   ├── create-order
│   │   └── webhook
│   └── receipts
├── leaves
├── notices
├── notifications
└── website
    ├── pages
    ├── gallery
    └── settings
```

## Layout Strategy

| Layout | Location | Responsibility |
| --- | --- | --- |
| Root layout | `src/app/layout.tsx` | Fonts, global CSS, app providers |
| Public layout | `src/app/(public)/layout.tsx` | Public navigation and footer |
| Admin layout | `src/app/(admin)/layout.tsx` | Admin sidebar and workspace shell |
| Resident layout | `src/app/(resident)/layout.tsx` | Resident sidebar and workspace shell |

## Loading and Error Boundaries

Recommended future files:

```txt
src/app/(admin)/admin/loading.tsx
src/app/(admin)/admin/error.tsx
src/app/(resident)/resident/loading.tsx
src/app/(resident)/resident/error.tsx
src/app/(public)/loading.tsx
src/app/(public)/not-found.tsx
```

## Route Protection Strategy

Protected layouts should perform server-side checks:

```txt
Admin layout
  -> get authenticated user
  -> load membership
  -> verify admin/staff/owner role
  -> render children or redirect
```

Resident routes should only load data for the authenticated resident profile.

## Performance and Caching Notes

- Public pages can use static rendering and route revalidation.
- Admin and resident pages should be dynamic once connected to auth.
- Large lists must use pagination, filters, and server-side search.
- Avoid client-only dashboards for sensitive data.

## TODO Placeholders

- TODO: Add route-level auth guards after Supabase Auth integration.
- TODO: Add loading and error components for each route group.
- TODO: Define route metadata for SEO on public pages.
- TODO: Define sitemap and robots strategy.
- TODO: Define API route handler locations for webhooks.
- TODO: Add typed navigation tests or lint checks if needed.

## Future Expansion Notes

- Add `/owner` route group if owner workflows diverge from admin.
- Add `/staff` route group only if staff UI becomes meaningfully different.
- Add `/super-admin` route group for SaaS operations.
- Add locale-aware route groups if multilingual website support is required.

