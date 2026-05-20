# Sadhana Boys Hostel Platform - Product Overview

## Purpose

Define the product scope, operating model, target users, and growth direction for the Sadhana Boys Hostel Platform. This document gives product, engineering, design, and operations teams a shared understanding before implementation begins.

## Overview

Sadhana Boys Hostel Platform is a production-grade Hostel Management ERP and Resident Portal. It combines a public hostel website, admin operations dashboard, resident self-service portal, payment workflows, leave management, notifications, invoices, and CMS-driven website content.

The platform starts with one hostel but must be designed for future SaaS-style multi-hostel operations.

## Product Goals

- Run day-to-day hostel operations from one admin ERP dashboard.
- Give residents a clean portal for fees, notices, profile data, and leave requests.
- Keep the public website dynamic through CMS-managed content.
- Integrate online payments through Cashfree when payment data models are finalized.
- Generate invoices and receipts with reliable audit trails.
- Support future multi-hostel, multi-branch, multi-role scalability.

## Product Modules

| Module | Primary Users | Description | Status |
| --- | --- | --- | --- |
| Public website | Visitors, parents, residents | Hostel information, rooms, facilities, gallery, contact, policies | Planned |
| Admin ERP | Owner, admin, staff | Resident, room, fee, leave, CMS, notification management | Planned |
| Resident portal | Residents/students | Profile, payments, invoices, leave requests, notices | Planned |
| Payments | Admin, residents | Dues, monthly fee records, receipts, Cashfree payments | Planned |
| Leave management | Admin, residents | Request, approve, reject, departure, return tracking | Planned |
| Notifications | Admin, residents | Notices, fee reminders, leave updates, system messages | Planned |
| Invoice generation | Admin, residents | PDF invoices, receipt numbers, line items, ledger history | Planned |
| Website CMS | Admin | Manage public website content without deployment | Planned |

## User Segments

| Segment | Needs | Product Response |
| --- | --- | --- |
| Hostel owner | Financial visibility, occupancy, operational control | Admin dashboard, reports, payments, audit logs |
| Hostel admin | Daily management | Resident records, rooms, leaves, notices, invoices |
| Staff | Limited operational workflows | Role-based access to assigned modules |
| Resident | Self-service | Portal for dues, receipts, leave, notices, profile |
| Parent/guardian | Trust and visibility | Public website, contact, future guardian notifications |
| Future SaaS operator | Multi-hostel control | Organizations, tenant isolation, subscriptions, branch management |

## Key Business Workflows

### Resident Admission

1. Admin creates or imports resident profile.
2. Resident is assigned to an organization and hostel.
3. Room or bed is allocated.
4. Fee plan is attached.
5. Documents are uploaded or requested.
6. Resident portal access is enabled.

### Monthly Fee Cycle

1. System generates monthly fee records.
2. Admin reviews dues.
3. Resident pays online or offline.
4. Payment is reconciled.
5. Invoice or receipt is generated.
6. Audit log records the financial event.

### Leave Request

1. Resident submits leave request.
2. Admin reviews request.
3. System sends approval or rejection notification.
4. Resident departure is marked.
5. Resident return is confirmed.
6. Leave history remains queryable.

### Public Website Update

1. Admin edits room, facility, gallery, or contact content.
2. Content is saved as draft or published.
3. Public website fetches published CMS data.
4. Cache is revalidated where required.

## Success Metrics

| Metric | Target |
| --- | --- |
| Payment reconciliation accuracy | 99.9 percent after payment provider integration |
| Admin dashboard load time | Under 2 seconds for common views |
| Public website Lighthouse performance | 90+ target after media optimization |
| Resident portal mobile usability | High priority for all resident workflows |
| Monthly invoice generation | Repeatable and auditable |
| Critical data backup coverage | Daily backups minimum |

## Non-Goals for Initial Phase

- Full accounting ERP replacement.
- Payroll management.
- Biometric attendance integration.
- Mobile native apps.
- Marketplace or hostel listing marketplace.
- Multi-country tax compliance.

These may become future modules after the core ERP stabilizes.

## Production Principles

- Use PostgreSQL as source of truth.
- Enforce access through Supabase Row Level Security.
- Keep payment provider logic isolated from business records.
- Use audit logs for critical financial and resident actions.
- Separate public website, admin ERP, and resident portal concerns.
- Prefer predictable data models over quick ad hoc fields.
- Build tenant isolation before multi-hostel growth makes it expensive.

## TODO Placeholders

- TODO: Finalize exact hostel operating policies.
- TODO: Define required resident admission fields.
- TODO: Define room pricing and fee plan rules.
- TODO: Confirm invoice numbering format.
- TODO: Confirm payment modes supported before Cashfree.
- TODO: Define notification channels for phase one.
- TODO: Confirm legal terms and privacy policy text.

## Future Expansion Notes

- Add multi-organization SaaS subscription plans.
- Add branch-level dashboards for hostel chains.
- Add parent/guardian portal.
- Add analytics and forecasting for occupancy and payments.
- Add mobile app or PWA support after web workflows stabilize.
- Add integrations for WhatsApp, SMS, accounting software, and biometric attendance.

