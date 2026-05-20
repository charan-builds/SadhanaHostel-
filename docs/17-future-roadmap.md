# Future Roadmap

## Purpose

Document planned product and technical phases so the team can build the platform incrementally without losing the long-term ERP and SaaS vision.

## Overview

The roadmap should evolve as business priorities become clearer. The initial priority is a stable foundation: database schema, auth, core admin workflows, resident portal, and public CMS. Advanced ERP and SaaS features should build on that foundation.

## Phase 0 - Foundation

Status: In progress.

Scope:

- Next.js project setup.
- Route groups.
- shadcn/ui foundation.
- Supabase preparation.
- Architecture documentation.

Deliverables:

- Public route skeletons.
- Admin route skeletons.
- Resident route skeletons.
- `/docs` blueprint.

## Phase 1 - Database and Auth

Scope:

- PostgreSQL schema.
- Supabase migrations.
- RLS policies.
- Auth flows.
- Role and membership model.
- Generated TypeScript database types.

Deliverables:

- Tenant-aware schema.
- Resident/admin login.
- Protected routes.
- Basic seed data.

## Phase 2 - Core Admin ERP

Scope:

- Residents.
- Rooms and allocations.
- Monthly fee records.
- Leave requests.
- Notices.
- Admin dashboard.

Deliverables:

- Operational admin panel.
- Resident lifecycle management.
- Room occupancy tracking.
- Leave approval workflow.

## Phase 3 - Resident Portal

Scope:

- Resident dashboard.
- Profile.
- Payments view.
- Leave submission.
- Notices.

Deliverables:

- Self-service resident portal.
- Resident-scoped RLS verified.
- Mobile-friendly workflows.

## Phase 4 - Payments and Invoices

Scope:

- Invoice generation.
- Receipt generation.
- Offline payment recording.
- Cashfree integration.
- Webhook handling.
- Payment reconciliation.

Deliverables:

- Payment lifecycle.
- Gateway callback processing.
- Invoice PDF generation.
- Audit logs.

## Phase 5 - Dynamic Website CMS

Scope:

- Public page content editor.
- Gallery management.
- Website settings.
- CMS publishing.
- Cache revalidation.

Deliverables:

- Admin-controlled website content.
- Published public pages.
- Media management.

## Phase 6 - Notifications

Scope:

- In-app notifications.
- Notices.
- Payment reminders.
- Leave updates.
- Email/SMS/WhatsApp provider integration.

Deliverables:

- Notification center.
- Delivery status tracking.
- Retry support.

## Phase 7 - SaaS and Multi-Hostel

Scope:

- Organizations.
- Multiple hostels.
- Owner dashboards.
- Tenant onboarding.
- Subscription billing.
- Feature flags.

Deliverables:

- Multi-hostel operations.
- Tenant isolation.
- SaaS control plane.

## Technical Roadmap

| Area | Planned Improvements |
| --- | --- |
| Testing | Unit, integration, E2E, RLS policy tests |
| Observability | Error tracking, logs, uptime checks |
| Performance | Indexes, caching, optimized queries |
| Security | MFA, audit dashboard, support access controls |
| Background jobs | Fee generation, invoices, notifications |
| Reporting | Owner reports, exports, financial analytics |

## TODO Placeholders

- TODO: Attach target dates to phases.
- TODO: Prioritize MVP scope.
- TODO: Define launch criteria.
- TODO: Define beta user group.
- TODO: Define success metrics per phase.
- TODO: Define support process after launch.

## Future Expansion Notes

- Native mobile app.
- Guardian portal.
- Maintenance requests.
- Meal management.
- Attendance integration.
- Biometric integration.
- Accounting integrations.
- AI-assisted operational insights.

