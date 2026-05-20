# Payment System

## Purpose

Define backend payment architecture for fees, collections, Cashfree orders, webhooks, reconciliation, and auditability.

## Scope

Covers:

- Monthly fee records.
- Offline payments.
- Online Cashfree payments.
- Webhook processing.
- Reconciliation.
- Refunds and reversals.

## Responsibilities

Backend owns:

- Payment state machine.
- Cashfree integration.
- Webhook verification.
- Ledger/audit updates.
- Invoice and receipt linkage.

Frontend owns:

- Payment initiation UI.
- Status display based on backend state.

## Architecture Overview

```txt
Resident/Admin action
  -> create payment/order
  -> Cashfree checkout, optional
  -> Cashfree webhook
  -> verify + idempotency
  -> update internal payment
  -> update fee/invoice status
  -> audit + notify
```

## Payment Tables

- `monthly_fee_records`
- `payments`
- `invoices`
- `invoice_line_items`
- `webhook_events`
- `audit_logs`

## Webhook Rules

- Verify signature.
- Store raw event.
- Check duplicate provider event ID.
- Process in transaction where possible.
- Return success only after safe persistence.
- Never trust browser redirect as final success.

## Cashfree Endpoint Placeholders

```txt
POST /api/payments/cashfree/create-order
POST /api/payments/cashfree/webhook
GET  /api/payments/:id/status
```

## TODO Placeholders

- TODO: Define payment state machine.
- TODO: Define Cashfree SDK/API approach.
- TODO: Define settlement reconciliation workflow.
- TODO: Define refund policy.
- TODO: Define payment audit log actions.

## Future Scalability Notes

- Add payment provider abstraction.
- Add partial payments and installment plans.
- Add auto-reminders.
- Add accounting export.

