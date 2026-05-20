# Admin Pages

## Purpose

Define the frontend structure for the admin ERP dashboard and its production-grade UI expectations.

## Scope

Admin routes:

- `/admin/dashboard`
- `/admin/residents`
- `/admin/payments`
- `/admin/rooms`
- `/admin/leaves`
- `/admin/website`
- `/admin/notifications`
- `/admin/settings`

## Responsibilities

Frontend developers own:

- Admin layouts, tables, forms, filters, dialogs, and dashboards.
- Permission-aware UI rendering.
- Loading, empty, and error states.

Backend developers own:

- Data access, mutations, RBAC, RLS, and audit logs.
- Payment webhooks and invoice generation.
- Admin API contracts.

## Architecture Overview

```txt
Admin page
  -> Admin layout guard
  -> Server data loader
  -> Page-level filters
  -> Table/detail UI
  -> Server action mutation
  -> Revalidate current route
```

## Admin Page Matrix

| Page | UI Blocks | Required States |
| --- | --- | --- |
| Dashboard | KPI cards, queues, recent activity | loading, partial data, error |
| Residents | table, filters, create/edit sheet, detail link | empty, loading, validation |
| Payments | dues table, payment dialog, invoice actions | pending webhook, failed payment |
| Rooms | occupancy grid/table, allocation dialog | maintenance, full capacity |
| Leaves | approval queue, history table | pending, approved, rejected |
| Website | CMS editor, gallery manager | draft, published, publish error |
| Notifications | notice composer, delivery table | queued, sent, failed |
| Settings | forms, integrations, roles | unsaved changes, restricted |

## Dashboard UI Planning

Recommended dashboard sections:

```txt
Top KPIs
  - Active residents
  - Occupancy
  - Outstanding dues
  - Monthly collection

Operational queues
  - Pending leaves
  - Overdue payments
  - Recent admissions
  - Failed notifications
```

## Table Requirements

- Server-side pagination.
- Status filters.
- Date range filters.
- Search by indexed fields.
- Row action menu.
- Bulk actions only after backend supports them.
- Export only after audit and permission rules are defined.

## Admin Safety UX

- Confirm destructive or irreversible actions.
- Show audit-impact copy for financial changes.
- Require reason text for payment reversals.
- Disable actions while pending.
- Show server validation errors clearly.

## TODO Placeholders

- TODO: Define each table column.
- TODO: Define reusable admin table shell.
- TODO: Define resident detail page route.
- TODO: Define invoice preview UI.
- TODO: Define role-restricted navigation.

## Future Scalability Notes

- Add owner dashboard for multi-hostel summaries.
- Add saved views and advanced filters.
- Add staff-specific limited dashboard.
- Add reporting pages when data volume grows.

