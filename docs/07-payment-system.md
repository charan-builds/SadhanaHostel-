# Payment System

## Purpose

Define the payment, fee, invoice, receipt, and Cashfree integration architecture for the platform.

## Overview

The payment system must support offline and online collections, monthly fee generation, invoice generation, receipts, reconciliation, refunds, and audit logs. Cashfree integration should be added only after the internal payment data model is stable.

## Payment Principles

- Internal payment records must be the source of truth for application state.
- Cashfree should be treated as an external provider, not the primary ledger.
- Payment webhooks must be verified and idempotent.
- Financial records should be immutable where practical.
- Corrections should be recorded as adjustments, reversals, or refunds.
- All payment mutations must create audit logs.

## Core Payment Entities

| Entity | Purpose |
| --- | --- |
| `fee_plans` | Defines recurring or custom fee amounts |
| `monthly_fee_records` | Monthly resident dues |
| `payments` | Payment attempts and confirmed collections |
| `invoices` | Issued billing documents |
| `invoice_line_items` | Itemized charges |
| `receipts` | Optional separate receipt entity if needed |
| `webhook_events` | Raw gateway callbacks for audit and idempotency |
| `audit_logs` | Human and system financial event trail |

## Monthly Fee Generation Workflow

```txt
Scheduled or admin-triggered job
  -> Select active residents
  -> Resolve fee plan and room allocation
  -> Create monthly_fee_records
  -> Create draft or issued invoice
  -> Notify resident
  -> Audit generation event
```

## Online Payment Workflow with Cashfree

```txt
Resident opens invoice
  -> Create Cashfree order through server route/action
  -> Redirect or open Cashfree checkout
  -> Cashfree processes payment
  -> Cashfree sends webhook
  -> Verify webhook signature
  -> Store webhook event
  -> Update payment status idempotently
  -> Update monthly fee record
  -> Generate receipt
  -> Notify resident and admin
```

## Offline Payment Workflow

```txt
Admin records offline payment
  -> Validate resident and due record
  -> Capture payment mode and reference
  -> Create payment record
  -> Update due status
  -> Generate receipt
  -> Audit admin action
```

## Payment Statuses

| Status | Meaning |
| --- | --- |
| `initiated` | Payment order was created |
| `pending` | Awaiting provider confirmation |
| `success` | Payment confirmed |
| `failed` | Payment failed |
| `cancelled` | User or provider cancelled |
| `refunded` | Fully refunded |
| `partially_refunded` | Partial refund recorded |

## Invoice Statuses

| Status | Meaning |
| --- | --- |
| `draft` | Prepared but not issued |
| `issued` | Sent or visible to resident |
| `partially_paid` | Some payment received |
| `paid` | Fully paid |
| `overdue` | Past due date |
| `cancelled` | Voided invoice |

## API Endpoint Placeholders

```txt
POST /api/payments/cashfree/create-order
POST /api/payments/cashfree/webhook
GET  /api/payments/:paymentId/status
POST /api/payments/offline
POST /api/invoices/generate
GET  /api/invoices/:invoiceId/pdf
POST /api/refunds/request
```

## Cashfree Configuration Placeholders

```bash
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_ENV=sandbox
CASHFREE_WEBHOOK_SECRET=
```

## Idempotency Requirements

- Store gateway event ID or unique provider reference.
- Reject duplicate webhook processing.
- Use database transactions where multiple financial tables update.
- Never mark payment successful from browser redirect alone.
- Webhook confirmation should be authoritative for online payments.

## Reconciliation

Reconciliation views should compare:

- Cashfree settlement records.
- Internal `payments`.
- Monthly fee records.
- Invoices and receipts.
- Refund records.

TODO: Define Cashfree settlement import or API sync strategy.

## Reporting Requirements

| Report | Audience |
| --- | --- |
| Daily collections | Admin, owner |
| Monthly dues | Admin, owner |
| Resident ledger | Admin, resident |
| Outstanding fees | Admin |
| Cash vs online collection | Owner |
| Failed payment attempts | Admin |

## Security Requirements

- Verify Cashfree webhook signatures.
- Store service credentials only in server environment variables.
- Do not expose gateway secret keys in browser bundles.
- Restrict offline payment creation to finance-capable admin roles.
- Audit all manual payment adjustments.

## Performance and Indexing

Recommended indexes:

```sql
create index on payments (organization_id, hostel_id, paid_at desc);
create index on payments (provider_reference);
create index on invoices (organization_id, hostel_id, status, issued_at desc);
create index on monthly_fee_records (resident_id, period_month);
```

## TODO Placeholders

- TODO: Finalize fee plan schema.
- TODO: Define invoice numbering convention.
- TODO: Define receipt numbering convention.
- TODO: Define late fee and discount logic.
- TODO: Define refund approval workflow.
- TODO: Define payment reversal policy.
- TODO: Confirm Cashfree integration mode and checkout UX.

## Future Expansion Notes

- Add payment reminders and scheduled auto-notifications.
- Add owner financial analytics dashboard.
- Add GST/tax support if business requires it.
- Add accounting export.
- Add subscription billing for SaaS tenants.

