# Protected Migration Pattern

Runtime protections on resident, finance, onboarding, and occupancy tables must remain strict. Migrations that need to normalize or repair protected data should not remove triggers or weaken RLS permanently.

Use this pattern instead:

- Put bulk protected writes inside a narrow `SECURITY DEFINER` repair helper.
- Revoke helper execution from `public`, `anon`, and `authenticated`.
- Grant only to `service_role` when the helper must remain available for operational repair.
- If a protection trigger must be bypassed, disable only that named trigger inside the helper, re-enable it before returning, and re-enable it again in the exception path.
- Keep the write scope fixed and tenant-safe. Do not accept arbitrary table names, SQL fragments, or unbounded user input.
- Insert audit logs with row counts, migration source, and skipped unsafe records.
- Skip tenantless or invalid tenant-linked records instead of guessing an organization. Surface them through operational anomaly reports for manual review.
- Leave runtime RLS and protection triggers active after the migration commits.

The phone identity normalization migration follows this approach with `public.normalize_phone_identity_records_for_migration()`. It normalizes only known phone columns, skips duplicate active resident phone groups that could violate uniqueness, records audit metadata, and keeps `protect_resident_profile_update` active after the repair.

Tenant orphan rule: migrations must never blindly assign a fallback `organization_id` to historical resident rows. Tenantless residents, invalid hostel links, and broken auth ownership are reported through `public.get_resident_tenant_identity_anomaly_report(...)` and must be resolved from invite, hostel, auth, and audit history.
