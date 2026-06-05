# Platform Integration Notes

## Scheduler

Vercel Cron invokes the following protected routes:

| Route | Job | Schedule |
| --- | --- | --- |
| `/api/cron/monthly-fee-generation` | Monthly fee generation | `30 0 1 * *` |
| `/api/cron/payment-reminders` | Payment reminders | `0 2 * * *` |
| `/api/cron/invoice-cleanup` | Invoice retention scan | `0 3 * * 0` |
| `/api/cron/stale-upload-cleanup` | Stale upload cleanup | `30 3 * * *` |
| `/api/cron/scheduled-notices` | Notice fan-out | `0 * * * *` |

All cron routes require:

```text
Authorization: Bearer $CRON_SECRET
```

## Email

Email delivery uses Resend behind the internal notification provider abstraction.

Required production settings:

```text
NOTIFICATIONS_SEND_ENABLED=true
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_REPLY_TO=
```

Supported templates:

- `payment_receipt`
- `payment_reminder`
- `resident_onboarding`
- `password_reset`
- `leave_approved`
- `leave_rejected`
- `leave_status_parent_notification`
- `notification_generic`

## Search

Search is backed by PostgreSQL generated `tsvector` columns and GIN indexes for:

- `residents`
- `payments`
- `rooms`
- `notices`

Application route:

```text
GET /api/v1/search?organizationId=<uuid>&query=<term>&types=residents,payments
```

Search is tenant-scoped and rate-limited.

## Google Analytics 4

GA4 is loaded once from the root App Router layout with `@next/third-parties/google`.

Production setting:

```text
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-39K0JSVGSZ
```

The app does not send manual `page_view` events. GA4 page views and client-side route changes are handled by the Google tag plus GA4 Enhanced Measurement history-change tracking. Keep "Page changes based on browser history events" enabled in the GA4 web stream.

Tracked custom events:

- `contact_action`
- `whatsapp_click`
- `resident_registration`
- `resident_login`
- `admin_login`
- `general_login`
- `lead_submission`
- `room_enquiry_submission`

Do not add a separate GTM container or raw `gtag.js` snippet unless this root integration is removed first.

## Realtime

Realtime events use tenant-scoped channels:

```text
tenant:<organizationId>:global
tenant:<organizationId>:hostel:<hostelId>
```

Published events:

- `notification.created`
- `payment.status_changed`
- `leave.status_changed`
- `dashboard.refresh`

## Financial Concurrency

Payments support:

- `idempotency_key`
- `lock_version`
- unique organization-level idempotency
- atomic verification through `verify_payment_atomic`

Verified payments update payment, fee record, and invoice state in one database function.
