# Layout System

## Purpose

Define application layouts, navigation patterns, route shells, and protected area structure.

## Scope

Layouts covered:

- Root layout.
- Public website layout.
- Admin dashboard layout.
- Resident portal layout.
- Future owner/super-admin layouts.

## Responsibilities

Frontend developers own:

- Layout UI.
- Navigation.
- Responsive shell behavior.
- Route group loading/error shells.

Backend developers own:

- Authenticated user and role data.
- Access decisions used by layouts.

## Architecture Overview

```txt
src/app/layout.tsx
  -> providers and globals
  -> (public)/layout.tsx
  -> (admin)/layout.tsx
  -> (resident)/layout.tsx
```

## Layout Responsibilities

| Layout | Responsibilities |
| --- | --- |
| Root | Fonts, global CSS, providers, metadata defaults |
| Public | Header, public nav, footer, CMS-safe frame |
| Admin | Sidebar, top bar, permission-aware nav, workspace width |
| Resident | Portal shell, mobile nav, resident actions |

## Navigation Rules

- Use typed `href` routes.
- Navigation items must be defined in constants.
- Protected navigation must hide inaccessible sections.
- Hidden navigation is not security; backend still enforces access.

## Responsive Shell Strategy

Desktop admin:

- Persistent sidebar.
- Main content with max width.
- Dense controls.

Mobile resident:

- Compact header.
- Bottom nav or sheet nav later.
- Large tap targets.

## TODO Placeholders

- TODO: Add mobile admin navigation sheet.
- TODO: Add route group loading components.
- TODO: Add route group error boundaries.
- TODO: Add permission-aware nav filtering.
- TODO: Add breadcrumb strategy.

## Future Scalability Notes

- Add owner layout for multi-hostel analytics.
- Add super-admin layout for SaaS operations.
- Add tenant switcher when organizations/hostels grow.

