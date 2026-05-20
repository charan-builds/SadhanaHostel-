# Resident Pages

## Purpose

Define the resident portal frontend structure, mobile-first UX, data visibility rules, and self-service workflows.

## Scope

Resident routes:

- `/resident/dashboard`
- `/resident/profile`
- `/resident/payments`
- `/resident/leave`
- `/resident/notices`

## Responsibilities

Frontend developers own:

- Mobile-friendly portal screens.
- Resident forms and clear feedback.
- Payment status presentation.
- Notice and leave UI.

Backend developers own:

- Resident-scoped data access.
- RLS policies.
- Leave workflow state transitions.
- Payment and invoice records.

## Architecture Overview

```txt
Resident route
  -> Resident layout guard
  -> Server loads own resident profile
  -> Server loads scoped records
  -> Client components handle forms and tabs
  -> Server actions mutate resident-owned workflows
```

## Page Requirements

| Page | Required UI | Backend Contract |
| --- | --- | --- |
| Dashboard | room, dues, notices, leave summary | resident summary endpoint/action |
| Profile | personal details, guardian, documents | resident profile read/update |
| Payments | invoice list, due card, receipt download | invoices/payments scoped to resident |
| Leave | request form, status cards, history | leave create/list |
| Notices | notice feed, unread filter | targeted notices |

## Resident UX Rules

- Prioritize mobile screens.
- Use simple language for payment and leave statuses.
- Avoid admin jargon.
- Show confirmation after every submission.
- Never expose other resident data.
- Make receipt download obvious.

## Payment Status UX

| Backend Status | Resident Label | UI Guidance |
| --- | --- | --- |
| `pending` | Processing | Show waiting state |
| `success` | Paid | Show receipt CTA |
| `failed` | Failed | Show retry CTA if allowed |
| `overdue` | Overdue | Show payment CTA and warning |

## Leave Form Workflow

```txt
Resident opens leave page
  -> sees active leave status
  -> fills dates, reason, destination
  -> client validation
  -> server validation
  -> creates pending request
  -> toast + updated list
```

## TODO Placeholders

- TODO: Define profile fields residents can edit.
- TODO: Define payment failure UX.
- TODO: Define receipt download component.
- TODO: Define leave overlap validation display.
- TODO: Define notice acknowledgement UI.

## Future Scalability Notes

- Add guardian portal views.
- Add PWA offline-ish shell for notices.
- Add maintenance complaint flow.
- Add meal feedback and hostel service requests.

