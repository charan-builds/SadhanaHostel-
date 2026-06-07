# Staging Smoke-Test Plan

Date: 2026-06-07

Branch: `backend-feature-migration`

Scope: backend functionality only. No UI, styling, layouts, providers, navigation, homepage, or public-page behavior is in scope.

## Final Result

GO

This is a staging execution plan. Production merge/deploy should wait until all required smoke tests below pass or any failures are explicitly accepted by the release owner.

## Common Preconditions

- Staging is deployed from a clean git ref for `backend-feature-migration`.
- Database migrations are applied in order:
  1. `20260606001000_resident_notice_reads.sql`
  2. `20260606002000_smart_notification_center.sql`
  3. `20260606003000_notice_acknowledgements.sql`
  4. `20260606004000_pwa_push_subscriptions.sql`
- Required staging env is configured:
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET`
  - `RATE_LIMIT_ENABLED=true`
  - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, if production-like rate limiting is being validated
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, for Web Push delivery tests
- Same-origin mutation protection is active. Run POST tests from the staging browser session, an API client with bearer auth, or curl with valid staging cookies and `Origin: $STAGING_BASE_URL`.
- Test actors exist:
  - Owner or Admin user with organization and hostel access.
  - Resident A with linked `user_id`, active resident profile, and active room allocation.
  - Resident B in the same organization but outside selected-resident notice targeting.
  - Optional Resident C with no active room allocation for null-field profile enrichment validation.

Use placeholders:

```bash
STAGING_BASE_URL="https://staging.example.com"
ORG_ID="<organization-uuid>"
HOSTEL_ID="<hostel-uuid>"
RESIDENT_A_ID="<targeted-resident-uuid>"
RESIDENT_B_ID="<non-targeted-resident-uuid>"
RESIDENT_A_COOKIE="<cookie-file-or-header>"
RESIDENT_B_COOKIE="<cookie-file-or-header>"
ADMIN_COOKIE="<cookie-file-or-header>"
CRON_SECRET="<staging-cron-secret>"
```

## Test 1: Notice Read

Preconditions:

- Resident A and Resident B can authenticate.
- Admin can create or identify a published notice.
- Notice read migration is applied.

Test data:

- Notice `NOTICE_READ_ID`
  - `organization_id = ORG_ID`
  - `hostel_id = HOSTEL_ID`
  - `status = published`
  - `audience_type = residents`
  - `audience_filter.resident_ids = [RESIDENT_A_ID]`
  - `requires_acknowledgement = false`

Steps:

1. As Resident A, call:

   ```bash
   curl -X POST "$STAGING_BASE_URL/api/notices/$NOTICE_READ_ID/read" \
     -H "Origin: $STAGING_BASE_URL" \
     -H "Content-Type: application/json" \
     -b "$RESIDENT_A_COOKIE" \
     -d "{\"organizationId\":\"$ORG_ID\"}"
   ```

2. Query or inspect `notice_reads` for `(notice_id = NOTICE_READ_ID, resident_id = RESIDENT_A_ID)`.
3. As Resident B, call the same endpoint with the same notice.

Expected result:

- Resident A receives HTTP 200 with success response.
- Response has `is_read: true`.
- `notice_reads` contains one row for Resident A.
- Repeating the call is idempotent and does not create duplicate rows.
- Resident B receives 403 or equivalent forbidden response.
- No read row is created for Resident B.

Failure indicators:

- Resident A gets 401, 403, 404, or validation error.
- Resident B can mark the notice read.
- Duplicate `notice_reads` rows are created.
- A read row is created with the wrong organization or resident.

Rollback action if failed:

- Delete staging `notice_reads` rows for the test notice and residents.
- Mark the test notice inactive or delete the staging test notice.
- Stop release until authorization or tenant scoping is corrected.

## Test 2: Notice Acknowledgement

Preconditions:

- Resident A and Resident B can authenticate.
- Notice acknowledgement migration is applied.

Test data:

- Notice `NOTICE_ACK_ID`
  - `organization_id = ORG_ID`
  - `hostel_id = HOSTEL_ID`
  - `status = published`
  - `audience_type = residents`
  - `audience_filter.resident_ids = [RESIDENT_A_ID]`
  - `requires_acknowledgement = true`

Steps:

1. As Resident A, call:

   ```bash
   curl -X POST "$STAGING_BASE_URL/api/notices/$NOTICE_ACK_ID/acknowledge" \
     -H "Origin: $STAGING_BASE_URL" \
     -H "Content-Type: application/json" \
     -b "$RESIDENT_A_COOKIE" \
     -d "{\"organizationId\":\"$ORG_ID\"}"
   ```

2. Verify `notice_acknowledgements` contains one row for Resident A.
3. Verify `notice_reads` also contains a read row for Resident A.
4. As Resident B, call the same endpoint.

Expected result:

- Resident A receives HTTP 200 with success response.
- Response has `is_acknowledged: true`.
- Acknowledgement and read rows exist for Resident A.
- Repeating the acknowledgement is idempotent and does not create duplicate rows.
- Resident B receives 403 or equivalent forbidden response.
- No acknowledgement row is created for Resident B.

Failure indicators:

- A targeted resident cannot acknowledge.
- A non-targeted resident can acknowledge.
- A non-acknowledgement notice can be acknowledged.
- Duplicate acknowledgement rows are created.

Rollback action if failed:

- Delete staging `notice_acknowledgements` and `notice_reads` rows for the test notice.
- Mark the test notice inactive.
- Block release until audience authorization and acknowledgement requirements are corrected.

## Test 3: Notification Archive

Preconditions:

- Resident A has at least one in-app notification.
- Resident B has a different notification, or Resident B can authenticate to test cross-recipient protection.

Test data:

- Notification `NOTIFICATION_A_ID`
  - `organization_id = ORG_ID`
  - `recipient_user_id = Resident A user id`
  - `channel = in_app`
  - `archived_at is null`

Steps:

1. As Resident A, call:

   ```bash
   curl -X POST "$STAGING_BASE_URL/api/notifications/$NOTIFICATION_A_ID/archive" \
     -H "Origin: $STAGING_BASE_URL" \
     -H "Content-Type: application/json" \
     -b "$RESIDENT_A_COOKIE" \
     -d "{\"organizationId\":\"$ORG_ID\"}"
   ```

2. Verify the notification row now has `archived_at` and `archived_by`.
3. List notifications without `includeArchived`; verify archived notification is absent.
4. As Resident B, attempt to archive `NOTIFICATION_A_ID`.

Expected result:

- Resident A receives HTTP 200 with success response.
- Notification is archived for Resident A only.
- Resident B cannot archive Resident A's notification.
- Default notification list excludes the archived notification.

Failure indicators:

- Archive updates another recipient's notification.
- Archived notification still appears in default notification list.
- Cross-recipient archive succeeds.
- Missing or wrong `archived_by`.

Rollback action if failed:

- Reset staging test notification fields:
  - `archived_at = null`
  - `archived_by = null`
  - `is_active = true`
- Stop release until recipient scoping is corrected.

## Test 4: Push Subscription Create

Preconditions:

- Staging is served over HTTPS.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is configured for a real browser push subscription test.
- Service worker registration is available for the test path, or QA manually registers `/sw.js` in a controlled staging browser session.
- Resident A can authenticate.

Test data:

- Real browser `PushSubscription` from Resident A's staging browser.
- Subscription endpoint must start with `https://`.

Steps:

1. In Resident A's browser session, create a browser push subscription using the staging public VAPID key.
2. Call:

   ```bash
   curl -X POST "$STAGING_BASE_URL/api/notifications/push-subscriptions" \
     -H "Origin: $STAGING_BASE_URL" \
     -H "Content-Type: application/json" \
     -b "$RESIDENT_A_COOKIE" \
     -d '{
       "organizationId": "'"$ORG_ID"'",
       "hostelId": "'"$HOSTEL_ID"'",
       "subscription": {
         "endpoint": "<https-browser-push-endpoint>",
         "expirationTime": null,
         "keys": {
           "p256dh": "<browser-p256dh-key>",
           "auth": "<browser-auth-key>"
         }
       },
       "platform": "staging-smoke",
       "deviceLabel": "Resident A smoke browser"
     }'
   ```

3. Verify `push_subscriptions` contains an active row for Resident A's current user.
4. Attempt one invalid request with `endpoint = "http://example.test/push"`.

Expected result:

- Valid subscription returns HTTP 200.
- Row has:
  - `organization_id = ORG_ID`
  - `user_id = Resident A user id`
  - `resident_id = RESIDENT_A_ID`
  - `revoked_at = null`
  - `failure_count = 0`
- Invalid non-HTTPS endpoint is rejected before write.

Failure indicators:

- Non-HTTPS endpoint is accepted.
- Subscription row is stored for the wrong user, resident, hostel, or organization.
- Anonymous user can subscribe.
- Cross-tenant hostel id is accepted.

Rollback action if failed:

- Revoke or delete the staging test `push_subscriptions` row.
- Stop release until validation and user scoping are corrected.

## Test 5: Push Subscription Revoke

Preconditions:

- Test 4 has created an active subscription for Resident A.
- Resident B can authenticate for negative scoping validation.

Test data:

- Resident A active push endpoint `PUSH_ENDPOINT_A`.

Steps:

1. As Resident A, call:

   ```bash
   curl -X POST "$STAGING_BASE_URL/api/notifications/push-subscriptions/revoke" \
     -H "Origin: $STAGING_BASE_URL" \
     -H "Content-Type: application/json" \
     -b "$RESIDENT_A_COOKIE" \
     -d "{\"endpoint\":\"$PUSH_ENDPOINT_A\"}"
   ```

2. Verify the row has `revoked_at` and `revoked_by = Resident A user id`.
3. Recreate the subscription if needed.
4. As Resident B, attempt to revoke `PUSH_ENDPOINT_A`.

Expected result:

- Resident A receives HTTP 200 with `revoked >= 1`.
- Resident A's endpoint is inactive after revoke.
- Resident B's revoke call does not revoke Resident A's active endpoint.
- Revoke with no endpoint only revokes current user's subscriptions.

Failure indicators:

- Revoke affects another user's subscription.
- Revoke does not update `revoked_at`.
- Anonymous revoke succeeds.

Rollback action if failed:

- Recreate Resident A's staging push subscription.
- Restore any accidentally revoked staging subscription rows if needed.
- Stop release until current-user scoping is corrected.

## Test 6: Web Push Delivery

Preconditions:

- Test 4 has an active subscription.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are configured.
- Browser notification permission is granted.
- Service worker is registered and active in Resident A's staging browser.

Test data:

- A published notice or notification targeted to Resident A that queues an immediate `in_app` notification.

Steps:

1. Confirm active service worker registration in the browser.
2. Confirm Resident A active row exists in `push_subscriptions`.
3. Trigger an immediate in-app notification for Resident A:
   - publish a new selected-resident notice for Resident A, or
   - run scheduled notice fanout for a staging notice targeted to Resident A.
4. Observe browser notification.
5. Verify `notification_logs` has a row:
   - `provider = web-push`
   - `status = sent`
   - `notification_id` matches the generated notification
6. Revoke or invalidate the endpoint in staging and trigger a second notification to verify 404/410 cleanup if feasible.

Expected result:

- Browser notification appears for Resident A.
- Notification click opens or focuses a same-origin resident route.
- `notification_logs` records `status = sent`.
- `push_subscriptions.last_sent_at` and `last_seen_at` update.
- Expired endpoints are revoked on 404/410.

Failure indicators:

- Delivery silently skips despite VAPID keys being configured.
- `notification_logs` shows repeated `status = failed`.
- Endpoint is logged without masking.
- Invalid endpoints are not revoked on 404/410.

Rollback action if failed:

- Revoke the staging push subscription.
- Keep in-app notifications enabled but do not announce browser push readiness.
- If failure volume is high, remove VAPID keys from staging until fixed.

## Test 7: Payment Reminder Execution

Preconditions:

- Admin can run jobs or cron in staging.
- Resident A is operationally verified and has a linked user.
- `CRON_SECRET` is configured if using the cron route.

Test data:

- Fee record `FEE_RECORD_ID`
  - `organization_id = ORG_ID`
  - `hostel_id = HOSTEL_ID`
  - `resident_id = RESIDENT_A_ID`
  - balance amount greater than zero
  - due date equal to one of the supported windows:
    - 7 days from run date
    - 3 days from run date
    - tomorrow
    - today
    - overdue

Steps:

1. Prefer controlled job execution:

   ```bash
   curl -X POST "$STAGING_BASE_URL/api/v1/jobs/run" \
     -H "Origin: $STAGING_BASE_URL" \
     -H "Content-Type: application/json" \
     -b "$ADMIN_COOKIE" \
     -d '{
       "name": "payment_reminder",
       "organizationId": "'"$ORG_ID"'",
       "hostelId": "'"$HOSTEL_ID"'",
       "payload": {
         "dueBeforeDate": "<run-date-plus-7-days>",
         "runDate": "<run-date>",
         "limit": 20
       }
     }'
   ```

2. Alternative cron route:

   ```bash
   curl "$STAGING_BASE_URL/api/cron/payment-reminders" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

3. Verify job result has `status = completed`.
4. Verify in-app notification exists for Resident A with expected payment reminder template key.
5. Run the same job again with the same `runDate`.

Expected result:

- First run processes the expected resident and queues reminder notifications.
- Second run skips the existing reminder and does not duplicate same-day reminders.
- Job logs include `job.started` and `job.completed`.
- Notification payload includes fee record id and reminder date.

Failure indicators:

- Job fails or times out.
- Duplicate reminders are created on repeat execution.
- Unverified/inactive residents receive reminders.
- Unexpectedly high processed count.

Rollback action if failed:

- Disable scheduled execution with `CRON_JOBS_ENABLED=false` before production deploy.
- Delete staging test reminder notifications.
- Reset test fee record if created only for smoke testing.
- Stop release until deduplication or resident eligibility is corrected.

## Test 8: Analytics Metrics

Preconditions:

- Owner/Admin user has `analytics.view`.
- Notice read, acknowledgement, notification archive, and payment reminder tests have generated staging data.

Test data:

- At least one read notice.
- At least one acknowledgement-required notice.
- At least one unread notification.
- At least one payment reminder notification.

Steps:

1. As Owner/Admin, call:

   ```bash
   curl "$STAGING_BASE_URL/api/v1/analytics/owner?organizationId=$ORG_ID&hostelId=$HOSTEL_ID" \
     -b "$ADMIN_COOKIE"
   ```

2. Verify response contains `communications`.
3. Compare key values against staging data:
   - `unreadNotifications`
   - `unreadNotices`
   - `noticeReadRate`
   - `noticeAcknowledgementRate`
   - `feeReminderEngagement`
4. As an unauthorized or resident user, call the same route.

Expected result:

- Owner/Admin receives HTTP 200.
- `communications` object is present and numeric fields are finite numbers.
- Metrics move in the expected direction after read/ack/payment reminder tests.
- Unauthorized user receives 401/403.

Failure indicators:

- Owner/Admin is denied despite valid access.
- Metrics are missing, null where numbers are expected, or inconsistent with staging data.
- Resident or unauthorized user can access owner analytics.

Rollback action if failed:

- No data rollback required unless test rows are polluting metrics.
- Remove staging test notices/notifications/fee records if needed.
- Stop release until analytics authorization or metric calculations are corrected.

## Test 9: Resident Profile Enrichment

Preconditions:

- Resident A has active room allocation.
- Optional Resident C has no active room allocation.

Test data:

- Active room allocation for Resident A linked to a room with room number/name.

Steps:

1. As Resident A, call:

   ```bash
   curl "$STAGING_BASE_URL/api/residents/me?organizationId=$ORG_ID" \
     -b "$RESIDENT_A_COOKIE"
   ```

2. Verify response includes:
   - `current_room_allocation_id`
   - `current_room_number`
   - `current_room_name`
3. As Resident C, call the same route if available.

Expected result:

- Resident A receives HTTP 200.
- Existing resident profile fields remain present.
- New room fields are populated for active allocation.
- Resident C receives the same response shape with new fields as `null`.

Failure indicators:

- Existing resident profile route fails.
- New fields are missing.
- Resident with active allocation receives null room fields.
- Resident without active allocation throws an error instead of returning null fields.

Rollback action if failed:

- No data rollback required.
- Stop release until resident repository/service enrichment is corrected.

## Test 10: Support Operational Alerts

Preconditions:

- Owner/Admin user has admin portal access and hostel access.
- Non-admin or resident user exists for negative authorization check.

Test data:

- At least one of the following staging conditions, if possible:
  - open support request
  - pending payment
  - failed payment
  - failed background job
  - consistency finding
- Empty alert state is acceptable if no operational issues exist, but authorization must still pass.

Steps:

1. As Owner/Admin, call:

   ```bash
   curl "$STAGING_BASE_URL/api/support/alerts?organizationId=$ORG_ID&hostelId=$HOSTEL_ID" \
     -b "$ADMIN_COOKIE"
   ```

2. Verify response is an array.
3. If seeded operational conditions exist, verify matching alert ids/severities/counts.
4. As non-admin/resident user, call the same endpoint.

Expected result:

- Owner/Admin receives HTTP 200.
- Response is an array, empty or populated.
- Alert counts match seeded staging conditions.
- Non-admin/resident user receives 401/403.
- Owner/Admin is not blocked by request-scoped RLS aggregate reads.

Failure indicators:

- Owner/Admin receives permission/RLS error.
- Alert counts are obviously wrong for seeded data.
- Non-admin can read operational alerts.
- Endpoint throws 500 for empty staging data.

Rollback action if failed:

- Remove any seeded staging support/payment/job test data.
- Stop release until support authorization or admin-scoped aggregate reads are corrected.

## Cross-Test Negative Checks

Run these once after the positive smoke tests:

- Cross-tenant organization id on notice read/ack/archive returns 403/404 and writes nothing.
- Missing `organizationId` on POST routes returns validation error.
- Cross-site `Origin` header is rejected for mutation routes.
- Repeating read/ack/payment reminder does not create duplicate rows.
- Push subscribe with `http://` endpoint returns validation error.
- Rate-limit smoke reaches 429 when threshold is intentionally exceeded in staging.

## Evidence To Capture

For each test, save:

- Request path and actor role.
- HTTP status.
- Response body excerpt.
- Relevant database row ids.
- Relevant structured log event names.
- Any cleanup SQL or rollback action performed.

Minimum evidence:

- Notice read row id.
- Notice acknowledgement row id.
- Archived notification id.
- Push subscription id and revoke result.
- Web Push notification log id.
- Payment reminder job result.
- Owner analytics `communications` object.
- Resident profile response room fields.
- Support alerts response count.

## Release Decision Criteria

GO when:

- All ten smoke tests pass.
- Negative authorization checks pass.
- No cross-tenant or cross-recipient write succeeds.
- No duplicate reminder/read/ack rows are created.
- Web Push either sends successfully with VAPID keys or is explicitly marked not enabled for launch.
- Payment reminder first-run count is understood and accepted.

NO-GO when:

- Any unauthorized tenant/user write succeeds.
- Notice read or acknowledgement bypasses audience targeting.
- Push subscription create/revoke crosses user boundaries.
- Payment reminders duplicate for the same resident, fee record, template, and run date.
- Owner/Admin support alerts fail because of authorization or RLS.
- Resident profile route breaks for current residents.

## Final Decision

GO
