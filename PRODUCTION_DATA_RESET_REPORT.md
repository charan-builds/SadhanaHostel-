# Production Data Reset Report

Generated at: 2026-06-09T12:19:38.412Z
Mode: EXECUTED

## Summary

- Validation: 34 passed, 0 warnings, 0 failed
- Resident-only auth users planned for deletion: 0
- Production safety before reset: production/production/destructive=false
- Production safety after reset: production/production/destructive=false

## Tables Cleaned

| Table | Before | Rows Removed | After |
| --- | --- | --- | --- |
| advance_payment_allocations | 0 | 0 | 0 |
| advance_payment_deposits | 0 | 0 | 0 |
| advance_payment_refund_audit_logs | 0 | 0 | 0 |
| advance_payment_refunds | 0 | 0 | 0 |
| audit_logs | 0 | 0 | 0 |
| collection_followups | 0 | 0 | 0 |
| documents | 0 | 0 | 0 |
| hostel_rule_acceptances | 0 | 0 | 0 |
| invoices | 0 | 0 | 0 |
| lead_activity_logs | 0 | 0 | 0 |
| lead_notes | 0 | 0 | 0 |
| leads | 0 | 0 | 0 |
| leave_requests | 0 | 0 | 0 |
| monthly_fee_records | 0 | 0 | 0 |
| notice_acknowledgements | 0 | 0 | 0 |
| notice_reads | 0 | 0 | 0 |
| notification_logs | 0 | 0 | 0 |
| notifications | 0 | 0 | 0 |
| payment_webhooks | 0 | 0 | 0 |
| payments | 0 | 0 | 0 |
| push_subscriptions | 0 | 0 | 0 |
| reservation_payments | 0 | 0 | 0 |
| reservations | 0 | 0 | 0 |
| resident_invites | 0 | 0 | 0 |
| residents | 0 | 0 | 0 |
| room_allocations | 0 | 0 | 0 |
| support_requests | 0 | 0 | 0 |
| whatsapp_delivery_events | 0 | 0 | 0 |
| whatsapp_message_queue | 0 | 0 | 0 |

## Storage Cleaned

| Bucket | Planned Objects | Objects Removed |
| --- | --- | --- |
| None | 0 |

## Auth Rows Removed

| Auth/Public Table | Rows Removed |
| --- | --- |
| auth.flow_state | 0 |
| auth.identities | 0 |
| auth.mfa_amr_claims | 0 |
| auth.mfa_factors | 0 |
| auth.oauth_authorizations | 0 |
| auth.oauth_consents | 0 |
| auth.one_time_tokens | 0 |
| auth.refresh_tokens | 0 |
| auth.sessions | 0 |
| auth.users | 0 |
| auth.webauthn_challenges | 0 |
| auth.webauthn_credentials | 0 |
| public.user_roles | 0 |
| public.users | 0 |

## Tables Preserved

| Table | Before | After |
| --- | --- | --- |
| automation_job_settings | 1 | 1 |
| employee_accommodation_rooms | 0 | 0 |
| facilities | 8 | 8 |
| gallery | 58 | 58 |
| hostel_capacity | 1 | 1 |
| hostel_rules | 10 | 10 |
| hostels | 1 | 1 |
| notices | 3 | 3 |
| operational_safety_settings | 1 | 1 |
| organizations | 1 | 1 |
| payment_settings | 5 | 5 |
| room_capacity | 9 | 9 |
| rooms | 9 | 9 |
| user_roles | 5 | 5 |
| users | 4 | 4 |
| website_settings | 6 | 6 |
| whatsapp_message_templates | 0 | 0 |

## Validation Results

- PASS - zero:residents: residents rows remaining: 0
- PASS - zero:resident_invites: resident_invites rows remaining: 0
- PASS - zero:leads: leads rows remaining: 0
- PASS - zero:lead_notes: lead_notes rows remaining: 0
- PASS - zero:lead_activity_logs: lead_activity_logs rows remaining: 0
- PASS - zero:reservations: reservations rows remaining: 0
- PASS - zero:reservation_payments: reservation_payments rows remaining: 0
- PASS - zero:payments: payments rows remaining: 0
- PASS - zero:payment_webhooks: payment_webhooks rows remaining: 0
- PASS - zero:invoices: invoices rows remaining: 0
- PASS - zero:monthly_fee_records: monthly_fee_records rows remaining: 0
- PASS - zero:advance_payment_deposits: advance_payment_deposits rows remaining: 0
- PASS - zero:advance_payment_allocations: advance_payment_allocations rows remaining: 0
- PASS - zero:advance_payment_refunds: advance_payment_refunds rows remaining: 0
- PASS - zero:advance_payment_refund_audit_logs: advance_payment_refund_audit_logs rows remaining: 0
- PASS - zero:collection_followups: collection_followups rows remaining: 0
- PASS - zero:leave_requests: leave_requests rows remaining: 0
- PASS - zero:support_requests: support_requests rows remaining: 0
- PASS - zero:notifications: notifications rows remaining: 0
- PASS - zero:notification_logs: notification_logs rows remaining: 0
- PASS - zero:notice_reads: notice_reads rows remaining: 0
- PASS - zero:notice_acknowledgements: notice_acknowledgements rows remaining: 0
- PASS - zero:hostel_rule_acceptances: hostel_rule_acceptances rows remaining: 0
- PASS - zero:push_subscriptions: push_subscriptions rows remaining: 0
- PASS - zero:whatsapp_message_queue: whatsapp_message_queue rows remaining: 0
- PASS - zero:whatsapp_delivery_events: whatsapp_delivery_events rows remaining: 0
- PASS - zero:room_allocations: room_allocations rows remaining: 0
- PASS - zero:operational_documents: Operational document rows remaining: 0
- PASS - foreign_keys: No orphaned foreign key references detected.
- PASS - tenant_integrity: All tenant-scoped rows reference valid organizations and matching hostels.
- PASS - auth_profiles: Public user profiles without auth.users rows: 0
- PASS - privileged_roles_preserved: Owner/admin/staff/super-admin role counts are unchanged.
- PASS - occupancy_reset: Hostel capacity occupied beds: 0; reserved beds: 0
- PASS - production_safety_restored: Safety settings after reset: {"launch_mode":"production","next_public_launch_mode":"production","destructive_operations_enabled":false}

## Remaining Risks

- No Upstash Redis credentials were present, so only database-backed data was reset; external cache flush was not applicable from this environment.
- No analytics snapshot table exists in the live schema.
- No dashboard cache table exists in the live schema.
- No forecast cache table exists in the live schema.
- No generated reports table exists in the live schema.
- No standalone search index table exists in the live schema; tsvector rows were removed with operational tables.
