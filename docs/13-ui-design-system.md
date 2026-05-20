# UI Design System

## Purpose

Define the visual and interaction standards for the public website, admin ERP dashboard, and resident portal.

## Overview

The platform uses Tailwind CSS and shadcn/ui as the base component system. The UI should feel trustworthy, operational, fast, and maintainable. Admin workflows should prioritize data density and clarity. Resident workflows should prioritize mobile usability and simplicity. Public pages should communicate trust and hostel quality.

## Design Principles

- Use consistent spacing, typography, and controls.
- Prefer reusable components over one-off UI.
- Keep admin screens efficient and scannable.
- Keep resident screens simple and mobile-friendly.
- Avoid visual noise in data-heavy workflows.
- Use accessible shadcn/ui primitives for forms, dialogs, tables, and menus.

## Component Layers

| Layer | Location | Description |
| --- | --- | --- |
| UI primitives | `src/components/ui` | shadcn/ui generated components |
| Layout components | `src/components/layout` | Public shell, dashboard shell |
| Shared components | `src/components/shared` | Reusable page and workflow components |
| Feature components | Future feature folders | Resident forms, payment tables, leave workflows |

## Typography

| Use | Style Direction |
| --- | --- |
| Page title | Clear, medium-large, restrained |
| Section heading | Compact and scannable |
| Body text | High readability |
| Table text | Dense but legible |
| Metadata | Muted color, smaller size |

## Color and Status System

Status colors should be semantic and consistent:

| Status | UI Treatment |
| --- | --- |
| Success | Green-like token, payment success, approved |
| Warning | Amber-like token, pending, overdue soon |
| Error | Destructive token, failed, rejected |
| Neutral | Muted token, draft, inactive |
| Info | Secondary token, notices, system state |

TODO: Define exact token mapping after brand palette is finalized.

## Admin UI Patterns

Use:

- Tables for residents, payments, leaves, rooms, invoices.
- Filter bars for searchable lists.
- Sheet or dialog for quick edits.
- Detail pages for complex records.
- Badges for status.
- Confirmation dialogs for sensitive actions.
- Toasts for action feedback.

Avoid:

- Overly decorative dashboards.
- Marketing-style hero layouts inside admin.
- Large cards where compact tables are better.
- Client-only data fetching for sensitive data.

## Resident UI Patterns

Use:

- Summary cards.
- Clear payment status.
- Simple forms.
- Step-by-step leave request.
- Mobile-friendly lists.
- Download buttons for receipts.

## Public Website UI Patterns

Use:

- Strong first viewport brand signal.
- Real hostel imagery when available.
- Clear room and facility sections.
- Inquiry CTA.
- SEO-friendly structure.

## Form Standards

- Use React Hook Form and Zod.
- Show field-level validation.
- Use required labels clearly.
- Disable submit during pending state.
- Preserve entered data on validation errors.
- Confirm destructive actions.

## Data Table Standards

Required features for production tables:

- Pagination.
- Search.
- Status filter.
- Date range filter where relevant.
- Sort by created date or business date.
- Empty state.
- Loading state.
- Row-level actions with permissions.

## Accessibility Requirements

- Keyboard navigable dialogs and menus.
- Labels for all inputs.
- Accessible error messages.
- Sufficient contrast.
- Avoid text overlap on mobile.
- Use semantic HTML where practical.

## Performance Notes

- Avoid rendering huge tables client-side.
- Use server-side pagination.
- Lazy-load heavy modals if needed.
- Optimize public images.
- Reuse layout components to reduce UI drift.

## TODO Placeholders

- TODO: Define final brand colors.
- TODO: Define status badge variants.
- TODO: Define table toolbar component.
- TODO: Define empty state component.
- TODO: Define invoice PDF visual template.
- TODO: Define dashboard chart style.
- TODO: Define responsive breakpoints for admin tables.

## Future Expansion Notes

- Add Storybook or component documentation if team grows.
- Add design tokens for multi-brand SaaS tenants.
- Add theme customization per hostel organization.
- Add PWA-specific mobile UI patterns.
- Add advanced analytics charts.

