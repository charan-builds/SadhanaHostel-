# Notification Test Matrix

Generated: 2026-06-06

## Scope

Validated resident notification behavior for:

- Fee reminders
- Overdue reminders
- Admin notices
- Payment confirmations
- Push notification service behavior
- Duplicate prevention at service/catalog level

## Automated Evidence

Command:

```bash
npx vitest run src/tests/unit/jobs/payment-reminder-smart.test.ts src/tests/unit/services/notification.service.test.ts src/tests/unit/services/web-push.service.test.ts src/tests/unit/lib/notifications-catalog.test.ts src/tests/unit/lib/notice-notification-classification.test.ts
```

Result:

- Test files: 5 passed
- Tests: 10 passed

## Matrix

| Event | Owner | Admin | Resident | Evidence | Result |
| --- | --- | --- | --- | --- | --- |
| Fee due reminder | Metrics/read path only | Scheduling/service path | Notification recipient path | `payment-reminder-smart.test.ts`, `notification.service.test.ts` | PASS - automated |
| Overdue reminder | Metrics/read path only | Scheduling/service path | Notification recipient path | `payment-reminder-smart.test.ts`, `notification.service.test.ts` | PASS - automated |
| Admin notice | Engagement/read metrics | Notice classification | Notice recipient path | `notice-notification-classification.test.ts`, `notification.service.test.ts` | PASS - automated |
| Payment confirmation | Metrics/read path only | Payment event path | Notification recipient path | `notifications-catalog.test.ts`, `notification.service.test.ts` | PASS - automated |
| Push delivery payload | Not applicable | Push subscription service | Push subscription service | `web-push.service.test.ts` | PASS - automated |
| Duplicate notification protection | Metrics integrity | Service/catalog integrity | Recipient inbox integrity | `notification.service.test.ts`, `notifications-catalog.test.ts` | PASS - automated |

## Live Validation Status

Live browser/device validation was not completed in this sprint because production DR validation blocked the release verdict before device-level push verification could become a GO criterion.

Required before GO:

- Login as Owner, Admin, and Resident against the production/staging target.
- Trigger one fee reminder job and one overdue reminder job.
- Create one admin notice targeted to all residents and one selected-resident notice.
- Verify exactly one notification row per intended recipient.
- Verify web push delivery on at least one Android Chrome device and one iOS Safari installed PWA.
- Verify no duplicate notifications after rerunning the same scheduler window.

