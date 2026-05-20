# Enums and Statuses

## Purpose

Define shared enum and status values used across frontend, backend, database, and documentation.

## Scope

Covers statuses for residents, rooms, allocations, payments, invoices, leaves, notices, notifications, documents, jobs, and CMS content.

## Responsibilities

Frontend responsibilities:

- Display status labels and visual variants.
- Avoid inventing local-only status strings.

Backend responsibilities:

- Enforce allowed status transitions.
- Store canonical values.
- Document new statuses before use.

## Architecture Overview

```txt
Database enum/text value
  -> backend domain transition
  -> shared enum
  -> frontend badge/label mapping
```

## Status Tables

### Resident Status

| Value | Meaning |
| --- | --- |
| `draft` | Created but incomplete |
| `active` | Currently staying |
| `checked_out` | Stay completed |
| `archived` | Historical/hidden |

### Room Status

| Value | Meaning |
| --- | --- |
| `active` | Available for allocation |
| `maintenance` | Temporarily unavailable |
| `inactive` | Not in use |

### Payment Status

| Value | Meaning |
| --- | --- |
| `initiated` | Payment started |
| `pending` | Awaiting confirmation |
| `success` | Confirmed paid |
| `failed` | Failed |
| `cancelled` | Cancelled |
| `refunded` | Refunded |

### Invoice Status

| Value | Meaning |
| --- | --- |
| `draft` | Not issued |
| `issued` | Issued |
| `partially_paid` | Partial payment |
| `paid` | Fully paid |
| `overdue` | Past due |
| `cancelled` | Voided |

### Leave Status

| Value | Meaning |
| --- | --- |
| `pending` | Awaiting review |
| `approved` | Approved |
| `rejected` | Rejected |
| `departed` | Resident has left |
| `returned` | Resident returned |
| `cancelled` | Request cancelled |

### Notice Status

| Value | Meaning |
| --- | --- |
| `draft` | Not published |
| `published` | Visible to audience |
| `archived` | Hidden from active feed |

### Notification Status

| Value | Meaning |
| --- | --- |
| `queued` | Waiting |
| `sent` | Sent to provider |
| `delivered` | Delivery confirmed |
| `failed` | Delivery failed |
| `read` | Read in app |

### Document Status

| Value | Meaning |
| --- | --- |
| `pending` | Uploaded, not verified |
| `verified` | Approved |
| `rejected` | Rejected |
| `expired` | Needs refresh |

## Transition Rules Placeholder

```txt
leave.pending -> leave.approved
leave.pending -> leave.rejected
leave.approved -> leave.departed
leave.departed -> leave.returned
```

## TODO Placeholders

- TODO: Convert finalized statuses into TypeScript unions.
- TODO: Define badge label map.
- TODO: Define database enum vs text strategy.
- TODO: Define allowed state transitions per workflow.

## Future Scalability Notes

- Add organization-specific display labels if needed.
- Add state machine utilities for complex workflows.
- Add transition audit events.

