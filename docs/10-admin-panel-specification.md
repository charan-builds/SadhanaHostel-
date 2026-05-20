# Admin Panel Specification

## Purpose

Define the admin ERP dashboard modules, pages, workflows, data responsibilities, UI expectations, and operational controls.

## Overview

The admin panel is the operational center of the hostel platform. It should let admins manage residents, rooms, payments, leaves, public website content, notifications, and settings through permission-aware workflows.

## Admin Routes

| Route | Module | Primary Functions |
| --- | --- | --- |
| `/admin/dashboard` | Dashboard | KPIs, queues, recent activity |
| `/admin/residents` | Residents | Add, edit, search, documents, status |
| `/admin/payments` | Payments | Dues, collections, invoices, receipts |
| `/admin/rooms` | Rooms | Room inventory, beds, occupancy |
| `/admin/leaves` | Leaves | Review, approve, reject, return tracking |
| `/admin/website` | Website CMS | Pages, gallery, settings |
| `/admin/notifications` | Notifications | Notices, reminders, campaigns |
| `/admin/settings` | Settings | Hostel profile, roles, integrations |

## Dashboard Requirements

KPI cards:

- Active residents.
- Occupancy percentage.
- Pending dues.
- Monthly collections.
- Pending leave requests.
- Unread system alerts.

Queues:

- Pending leaves.
- Overdue payments.
- Recent admissions.
- Failed payments.
- Draft website changes.

## Resident Management

Features:

- Create resident.
- Edit resident profile.
- Assign room/bed.
- Upload documents.
- Activate portal account.
- Mark checkout.
- View payment and leave history.

Data placeholders:

```txt
residents
room_allocations
documents
monthly_fee_records
leave_requests
```

## Payment Management

Features:

- Generate monthly fees.
- View dues.
- Record offline payment.
- View online payment status.
- Generate invoice.
- Download receipt.
- Reconcile payment.

Controls:

- Finance permission required.
- Audit log required.
- Manual correction requires reason.

## Room Management

Features:

- Create room.
- Set capacity and rent.
- Add beds.
- Mark maintenance.
- View occupancy.
- Transfer resident.

## Leave Management

Features:

- View leave requests.
- Approve or reject.
- Record departure.
- Mark return.
- Notify resident.
- View leave history.

## Website CMS Management

Features:

- Edit public page sections.
- Manage gallery.
- Update contact settings.
- Publish terms.
- Revalidate public cache after publish.

## Notifications Management

Features:

- Create notice.
- Select audience.
- Publish notice.
- View delivery status.
- Retry failed delivery.

## Settings

Settings areas:

- Hostel profile.
- Organization settings.
- Payment settings.
- Notification providers.
- Roles and permissions.
- Invoice numbering.
- Backup and export options.

## Admin UI Requirements

- Dense but readable data tables.
- Filters, sorting, and pagination.
- Clear empty states.
- Confirmation dialogs for destructive actions.
- Form validation with Zod.
- Toast feedback for actions.
- Permission-aware navigation.

## Performance Notes

- Dashboard KPIs should use optimized aggregate queries.
- Resident and payment lists must paginate.
- Search should use indexed fields.
- Avoid loading documents or invoice PDFs in list views.

## TODO Placeholders

- TODO: Define exact table columns for each admin list.
- TODO: Define filters for residents, payments, rooms, leaves.
- TODO: Define bulk actions.
- TODO: Define export formats.
- TODO: Define admin dashboard KPI queries.
- TODO: Define staff role UI restrictions.

## Future Expansion Notes

- Add owner-level multi-hostel dashboard.
- Add report builder.
- Add bulk import of residents.
- Add scheduled reports.
- Add staff task management.
- Add support ticketing for residents.

