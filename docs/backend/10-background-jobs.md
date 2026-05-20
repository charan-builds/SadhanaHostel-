# Background Jobs

## Purpose

Define background job architecture for long-running, scheduled, or retryable backend work.

## Scope

Candidate jobs:

- Monthly fee generation.
- Invoice PDF generation.
- Payment reconciliation.
- Notification delivery.
- Reminder scheduling.
- Report exports.
- Storage cleanup.

## Responsibilities

Backend owns:

- Job definitions.
- Idempotency.
- Retry policy.
- Monitoring.
- Failure recovery.

Frontend owns:

- Displaying job status where user-facing.

## Architecture Overview

```txt
Trigger
  -> create job record
  -> worker/scheduled process
  -> process batch
  -> update job status
  -> notify/audit
```

## Initial Strategy

Start with admin-triggered server actions for simple workflows. Move to scheduled jobs or queue workers when:

- execution exceeds request limits,
- retries are required,
- large batches are needed,
- provider failures are common.

## Job Statuses

| Status | Meaning |
| --- | --- |
| queued | waiting |
| running | processing |
| succeeded | complete |
| failed | failed permanently or needs attention |
| retrying | scheduled retry |

## TODO Placeholders

- TODO: Select queue provider.
- TODO: Define job table.
- TODO: Define scheduled fee generation.
- TODO: Define notification retry worker.
- TODO: Define dead-letter handling.

## Future Scalability Notes

- Add separate worker service.
- Add cron jobs.
- Add event-driven domain events.
- Add job observability dashboard.

