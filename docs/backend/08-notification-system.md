# Notification System

## Purpose

Define backend notification architecture for notices, reminders, leave updates, payment updates, and provider delivery.

## Scope

Covers:

- In-app notifications.
- Notice publishing.
- Delivery providers.
- Retry handling.
- Templates.
- Monitoring.

## Responsibilities

Backend owns:

- Recipient resolution.
- Template rendering.
- Delivery queue/state.
- Provider integration.
- Failure tracking.

Frontend owns:

- Notice display.
- Notification badges and read state UI.

## Architecture Overview

```txt
Domain event
  -> notification service
  -> resolve recipients
  -> create notification rows
  -> deliver channel
  -> update status
  -> monitor failures
```

## Notification Events

- `notice.published`
- `payment.due`
- `payment.received`
- `leave.requested`
- `leave.approved`
- `leave.rejected`
- `invoice.generated`

## Provider Strategy

Start with in-app notifications. Add email/SMS/WhatsApp through adapters:

```ts
interface NotificationProvider {
  send(input: NotificationDeliveryInput): Promise<DeliveryResult>
}
```

## TODO Placeholders

- TODO: Define notification tables.
- TODO: Define template syntax.
- TODO: Select email provider.
- TODO: Select SMS/WhatsApp provider.
- TODO: Define retry policy.

## Future Scalability Notes

- Add queue worker.
- Add digest notifications.
- Add realtime delivery using Supabase Realtime.
- Add notification analytics.

