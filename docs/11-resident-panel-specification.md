# Resident Panel Specification

## Purpose

Define the resident portal pages, workflows, data visibility rules, UI expectations, and future expansion direction.

## Overview

The resident portal should be simple, mobile-friendly, and focused on self-service. Residents should see only their own profile, room assignment, fees, invoices, leave requests, and notices.

## Resident Routes

| Route | Page | Primary Functions |
| --- | --- | --- |
| `/resident/dashboard` | Dashboard | Summary, dues, notices, leave status |
| `/resident/profile` | Profile | Personal details, guardian info, documents |
| `/resident/payments` | Payments | Invoices, dues, receipts, payment actions |
| `/resident/leave` | Leave | Submit request, track status |
| `/resident/notices` | Notices | View announcements and reminders |

## Resident Dashboard

Should show:

- Current room or bed.
- Current fee due.
- Upcoming due date.
- Active leave request.
- Latest notices.
- Profile completion status.

## Profile Page

Sections:

- Personal information.
- Contact details.
- Guardian details.
- Emergency contact.
- Room assignment.
- Documents.

Editing rules:

- Residents can request or edit limited fields.
- Admin-verified fields may require approval.
- Sensitive data changes should be audited.

## Payments Page

Features:

- View due amount.
- View invoice history.
- Download receipts.
- Start online payment through Cashfree later.
- See payment status.

Payment UX rules:

- Do not mark payment as success from redirect alone.
- Show pending state while awaiting webhook confirmation.
- Explain offline payments if allowed.

## Leave Page

Features:

- Submit leave request.
- Choose from and to dates.
- Add reason and destination.
- View approval status.
- View leave history.
- See return status.

Validation:

- End date must be after start date.
- Active overlapping leave requests should be blocked or flagged.
- Required fields should be clear.

## Notices Page

Features:

- View published notices.
- Filter unread or pinned notices.
- Mark as read.
- View attachments later.

## Data Visibility Rules

- Resident can read only own resident profile.
- Resident can read only own payment and invoice records.
- Resident can read notices targeted to self, room, hostel, or organization.
- Resident can create own leave requests.
- Resident cannot approve or edit leave decisions.
- Resident cannot access admin routes.

## UI Requirements

- Mobile-first layouts.
- Clear payment status badges.
- Simple forms.
- Accessible controls.
- Minimal dashboard complexity.
- Strong feedback after actions.

## Performance Notes

- Keep resident dashboard query count low.
- Paginate invoice and notice history.
- Cache non-sensitive public assets.
- Avoid exposing admin-only aggregates.

## TODO Placeholders

- TODO: Define resident profile editable fields.
- TODO: Define leave form fields.
- TODO: Define payment card UX.
- TODO: Define invoice PDF download flow.
- TODO: Define notice read status model.
- TODO: Define resident onboarding flow.

## Future Expansion Notes

- Add PWA install support.
- Add guardian-linked view.
- Add complaint or maintenance requests.
- Add meal feedback.
- Add digital agreement signing.
- Add push notifications.

