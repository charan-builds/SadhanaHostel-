# Responsive Strategy

## Purpose

Define responsive behavior for public pages, admin ERP, and resident portal across desktop, tablet, and mobile.

## Scope

Applies to:

- Navigation.
- Dashboards.
- Tables.
- Forms.
- Public CMS sections.
- Resident self-service workflows.

## Responsibilities

Frontend owns:

- Responsive layouts and QA.
- Mobile navigation.
- Table overflow behavior.
- Touch-friendly controls.

Backend owns:

- Efficient paginated data so mobile screens do not load large payloads.

## Architecture Overview

```txt
Mobile-first components
  -> tablet grid adjustments
  -> desktop dense admin layouts
  -> responsive data display
```

## Breakpoint Strategy

| Viewport | Strategy |
| --- | --- |
| Mobile | Single column, large tap targets, simplified tables |
| Tablet | Two-column cards where useful |
| Desktop | Sidebar layouts, dense tables, multi-column dashboards |

## Admin Table Strategy

- Desktop: full table.
- Tablet: reduced columns.
- Mobile: card list or horizontal scroll depending workflow.
- Always keep primary action accessible.

## Resident Mobile Strategy

- Payment due card at top.
- Leave request form easy to complete.
- Notices readable without table UI.
- Receipt downloads accessible.

## TODO Placeholders

- TODO: Define mobile admin navigation.
- TODO: Define table-to-card breakpoint.
- TODO: Add responsive QA checklist.
- TODO: Define dashboard card layout per breakpoint.

## Future Scalability Notes

- Add PWA bottom navigation.
- Add device-specific analytics for UX improvements.
- Add mobile app later only after web workflows prove stable.

