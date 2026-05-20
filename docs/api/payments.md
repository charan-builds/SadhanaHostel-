# Payments API

## Purpose

Document UPI-first payment creation, admin verification, payment history, and immutable financial records.

## Endpoints

| Method | Path | Auth | Rate Limit |
| --- | --- | --- | --- |
| `GET` | `/api/payments` | Admin/staff or resident self-access | None |
| `POST` | `/api/payments/create` | Authenticated | `payments.create` |
| `POST` | `/api/payments/verify` | Admin/staff | None |
| `GET` | `/api/payments/{id}` | Admin/staff or owner resident | None |
| `GET` | `/api/payments/resident/{residentId}` | Admin/staff or owner resident | None |

## Create Payment Request

```json
{
  "organizationId": "uuid",
  "hostelId": "uuid",
  "residentId": "uuid",
  "amount": 6500,
  "transactionId": "UPI123456789",
  "manualReference": "optional-note",
  "isAdvance": false,
  "isPartial": false
}
```

## Verification Request

```json
{
  "organizationId": "uuid",
  "paymentId": "uuid"
}
```

## Financial Controls

- Residents can create pending payment records for themselves only.
- Only admin roles can verify payments.
- Verified payment records are treated as immutable by business rules and RLS.
- Every creation and verification emits structured payment logs.

## TODO

- Add Cashfree order creation.
- Add webhook signature verification documentation.
- Add ledger reconciliation endpoint.
- Persist payment audit events into `audit_logs`.
