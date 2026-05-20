# Notification System

## Purpose

Define the notification architecture for notices, payment reminders, leave updates, resident alerts, admin alerts, and future provider integrations.

## Overview

The notification system should support in-app notifications first, then email, SMS, and WhatsApp providers as adapters. Notifications must be tenant-aware, auditable for important messages, and safe to retry.

## Notification Types

| Type | Trigger | Audience |
| --- | --- | --- |
| Notice published | Admin publishes notice | Residents, rooms, hostel, or all |
| Payment due | Monthly fee generated or due date reached | Resident |
| Payment received | Payment confirmed | Resident, admin optional |
| Leave requested | Resident submits request | Admin |
| Leave approved | Admin approves request | Resident |
| Leave rejected | Admin rejects request | Resident |
| Return reminder | Leave return date approaches | Resident, admin |
| CMS publish | Website content published | Admin audit only |
| System alert | Failed webhook or critical error | Admin/owner |

## Channels

| Channel | Phase | Notes |
| --- | --- | --- |
| In-app | Phase 1 | Stored in `notifications` table |
| Email | Phase 2 | Provider to be selected |
| SMS | Later | Requires phone verification and provider |
| WhatsApp | Later | Useful for guardians and payment reminders |
| Push | Future | PWA or mobile app required |

## Data Model

Required tables:

- `notices`
- `notifications`
- `notification_templates`
- `notification_preferences`
- `notification_deliveries`, optional if multi-channel volume grows

## Notification Creation Flow

```txt
Business event
  -> Resolve recipients
  -> Render template
  -> Create notification row
  -> Queue channel delivery
  -> Update delivery status
  -> Retry on failure
```

## Notice Publishing Flow

```txt
Admin writes notice
  -> Save as draft
  -> Select audience
  -> Publish notice
  -> Create in-app notifications
  -> Optional external delivery
  -> Audit publish action
```

## Audience Targeting

| Audience | Required Filters |
| --- | --- |
| All organization residents | `organization_id` |
| Hostel residents | `organization_id`, `hostel_id` |
| Room residents | `room_id` active allocation |
| Selected residents | Resident IDs |
| Admins | Membership roles |

## API Placeholder Structures

```txt
GET  /api/notifications
POST /api/notifications/mark-read
POST /api/notices
PATCH /api/notices/:noticeId
POST /api/notices/:noticeId/publish
POST /api/notifications/test
POST /api/notifications/webhooks/provider
```

## Template Placeholder

```txt
Template: payment_due
Subject: Fee due for {{period}}
Body:
  Hello {{resident_name}},
  your hostel fee of {{amount}} is due on {{due_date}}.
```

## Delivery Statuses

| Status | Meaning |
| --- | --- |
| `queued` | Waiting to send |
| `sent` | Provider accepted |
| `delivered` | Provider confirmed delivery |
| `failed` | Delivery failed |
| `read` | User read in-app |
| `cancelled` | Cancelled before delivery |

## Reliability Requirements

- Notifications must be idempotent for repeated business events.
- Provider failures should not break core workflows.
- Important notifications should be queryable for audit.
- Failed delivery should be retryable.
- Bulk sends should be batched.

## Security and Privacy

- Do not expose notices across tenants.
- Avoid sensitive financial detail in SMS or WhatsApp unless approved.
- Respect notification preferences where required.
- Log external provider failures without leaking secrets.

## Monitoring

Track:

- Queue size.
- Failed notifications.
- Delivery latency.
- Provider error rates.
- Unread notices.

## TODO Placeholders

- TODO: Select email provider.
- TODO: Select SMS or WhatsApp provider.
- TODO: Define templates for payment, leave, notice, invoice.
- TODO: Define notification preferences.
- TODO: Define retry schedule.
- TODO: Define whether notifications are sent synchronously or by background jobs.

## Future Expansion Notes

- Add digest emails for owners.
- Add guardian notification preferences.
- Add real-time in-app notification badge with Supabase Realtime.
- Add notification analytics.
- Add rate limits and quiet hours.

