import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const migrationsDir = path.join(process.cwd(), "supabase", "migrations")

function migration(name: string) {
  return readFileSync(path.join(migrationsDir, name), "utf8")
}

function allMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      file,
      sql: migration(file),
    }))
}

describe("static migration security checks", () => {
  it("does not run ownership-level RLS alterations on Supabase-managed storage tables", () => {
    const combined = allMigrations()
      .map(({ sql }) => sql)
      .join("\n")

    expect(combined).not.toMatch(
      /alter\s+table\s+storage\.(objects|buckets)\s+(enable|force)\s+row\s+level\s+security/i
    )
  })

  it("keeps critical finance and onboarding tables protected by RLS", () => {
    const manualUpi = migration("20260522001000_manual_upi_payment_operations.sql")
    const invites = migration("20260522000000_resident_invite_onboarding.sql")
    const p1Finance = migration("20260605001000_p1_finance_hardening.sql")

    expect(manualUpi).toMatch(
      /alter\s+table\s+public\.payment_settings\s+enable\s+row\s+level\s+security/i
    )
    expect(manualUpi).toMatch(
      /alter\s+table\s+public\.payment_settings\s+force\s+row\s+level\s+security/i
    )
    expect(invites).toMatch(
      /alter\s+table\s+public\.resident_invites\s+enable\s+row\s+level\s+security/i
    )
    expect(p1Finance).toMatch(
      /alter\s+table\s+public\.collection_followups\s+enable\s+row\s+level\s+security/i
    )
    expect(p1Finance).toMatch(
      /alter\s+table\s+public\.collection_followups\s+force\s+row\s+level\s+security/i
    )
    expect(p1Finance).toMatch(/public\.can_manage_finance\(organization_id,\s*hostel_id\)/i)
  })

  it("keeps resident notice reads tenant-scoped and RLS protected", () => {
    const noticeReads = migration("20260606001000_resident_notice_reads.sql")

    expect(noticeReads).toMatch(/create\s+table\s+if\s+not\s+exists\s+public\.notice_reads/i)
    expect(noticeReads).toMatch(/unique\s*\(\s*notice_id,\s*resident_id\s*\)/i)
    expect(noticeReads).toMatch(
      /alter\s+table\s+public\.notice_reads\s+enable\s+row\s+level\s+security/i
    )
    expect(noticeReads).toMatch(
      /alter\s+table\s+public\.notice_reads\s+force\s+row\s+level\s+security/i
    )
    expect(noticeReads).toMatch(/public\.can_manage_organization\(organization_id,\s*hostel_id\)/i)
    expect(noticeReads).toMatch(/public\.owns_resident\(resident_id\)/i)
  })

  it("keeps resident notice acknowledgements tenant-scoped and RLS protected", () => {
    const acknowledgements = migration("20260606003000_notice_acknowledgements.sql")

    expect(acknowledgements).toMatch(
      /add\s+column\s+if\s+not\s+exists\s+notice_type\s+text/i
    )
    expect(acknowledgements).toMatch(
      /notice_type\s+in\s+\('general',\s*'fee_updates',\s*'hostel_rules',\s*'maintenance',\s*'emergency'\)/i
    )
    expect(acknowledgements).toMatch(
      /add\s+column\s+if\s+not\s+exists\s+requires_acknowledgement\s+boolean/i
    )
    expect(acknowledgements).toMatch(
      /create\s+table\s+if\s+not\s+exists\s+public\.notice_acknowledgements/i
    )
    expect(acknowledgements).toMatch(/unique\s*\(\s*notice_id,\s*resident_id\s*\)/i)
    expect(acknowledgements).toMatch(
      /alter\s+table\s+public\.notice_acknowledgements\s+enable\s+row\s+level\s+security/i
    )
    expect(acknowledgements).toMatch(
      /alter\s+table\s+public\.notice_acknowledgements\s+force\s+row\s+level\s+security/i
    )
    expect(acknowledgements).toMatch(
      /public\.can_manage_organization\(organization_id,\s*hostel_id\)/i
    )
    expect(acknowledgements).toMatch(/public\.owns_resident\(resident_id\)/i)
  })

  it("keeps PWA push subscriptions tenant-scoped and RLS protected", () => {
    const pushSubscriptions = migration("20260606004000_pwa_push_subscriptions.sql")

    expect(pushSubscriptions).toMatch(
      /create\s+table\s+if\s+not\s+exists\s+public\.push_subscriptions/i
    )
    expect(pushSubscriptions).toMatch(/organization_id\s+uuid\s+not\s+null/i)
    expect(pushSubscriptions).toMatch(/user_id\s+uuid\s+not\s+null/i)
    expect(pushSubscriptions).toMatch(/unique\s*\(\s*endpoint\s*\)/i)
    expect(pushSubscriptions).toMatch(
      /alter\s+table\s+public\.push_subscriptions\s+enable\s+row\s+level\s+security/i
    )
    expect(pushSubscriptions).toMatch(
      /alter\s+table\s+public\.push_subscriptions\s+force\s+row\s+level\s+security/i
    )
    expect(pushSubscriptions).toMatch(
      /public\.can_manage_organization\(organization_id,\s*hostel_id\)/i
    )
    expect(pushSubscriptions).toMatch(/auth\.uid\(\)\s*=\s*user_id/i)
    expect(pushSubscriptions).toMatch(/public\.belongs_to_organization\(organization_id\)/i)
  })

  it("keeps notification center category, priority, and archive fields indexed", () => {
    const smartNotifications = migration("20260606002000_smart_notification_center.sql")

    expect(smartNotifications).toMatch(/add\s+column\s+if\s+not\s+exists\s+category\s+text/i)
    expect(smartNotifications).toMatch(/category\s+in\s+\('finance',\s*'hostel',\s*'personal'\)/i)
    expect(smartNotifications).toMatch(/add\s+column\s+if\s+not\s+exists\s+priority\s+text/i)
    expect(smartNotifications).toMatch(/priority\s+in\s+\('info',\s*'warning',\s*'urgent',\s*'critical'\)/i)
    expect(smartNotifications).toMatch(/add\s+column\s+if\s+not\s+exists\s+archived_at/i)
    expect(smartNotifications).toMatch(/notifications_recipient_center_idx/i)
    expect(smartNotifications).toMatch(/notifications_unread_center_idx/i)
    expect(smartNotifications).toMatch(/notifications_archived_idx/i)
  })

  it("keeps finance dashboard aggregates database-owned and finance-guarded", () => {
    const p1Finance = migration("20260605001000_p1_finance_hardening.sql")

    expect(p1Finance).toMatch(/create\s+or\s+replace\s+function\s+public\.finance_dashboard_aggregates/i)
    expect(p1Finance).toMatch(/public\.can_manage_finance\(p_organization_id,\s*p_hostel_id\)/i)
    expect(p1Finance).toMatch(/'truncated',\s*false/i)
    expect(p1Finance).toMatch(/'totalRowsScanned'/i)
    expect(p1Finance).toMatch(/balance_amount\s*>\s*0/i)
    expect(p1Finance).toMatch(/verified_at/i)
  })

  it("keeps collection follow-up ownership and priority indexed for finance workflows", () => {
    const collectionCenter = migration(
      "20260605002000_collection_center_followup_assignment.sql"
    )

    expect(collectionCenter).toMatch(/add\s+column\s+if\s+not\s+exists\s+priority\s+text/i)
    expect(collectionCenter).toMatch(
      /check\s*\(\s*priority\s+in\s+\('low',\s*'medium',\s*'high',\s*'critical'\)\s*\)/i
    )
    expect(collectionCenter).toMatch(/add\s+column\s+if\s+not\s+exists\s+assigned_to\s+uuid/i)
    expect(collectionCenter).toMatch(/references\s+public\.users\(id\)\s+on\s+delete\s+set\s+null/i)
    expect(collectionCenter).toMatch(/collection_followups_priority_idx/i)
    expect(collectionCenter).toMatch(/collection_followups_assigned_to_idx/i)
  })

  it("keeps manual UPI duplicate protections at database level", () => {
    const manualUpi = migration("20260522001000_manual_upi_payment_operations.sql")

    expect(manualUpi).toMatch(/payments_upi_transaction_reference_uidx/i)
    expect(manualUpi).toMatch(/documents_active_payment_proof_uidx/i)
    expect(manualUpi).toMatch(/documents_payment_proof_checksum_uidx/i)
  })

  it("keeps payment setting rotation and policy controls database-backed", () => {
    const paymentSecurity = migration("20260522002000_payment_security_configuration.sql")

    expect(paymentSecurity).toMatch(/require_utr/i)
    expect(paymentSecurity).toMatch(/require_screenshot/i)
    expect(paymentSecurity).toMatch(/payment_settings_active_upi_uidx/i)
    expect(paymentSecurity).toMatch(/payment_setting_snapshot_at/i)
    expect(paymentSecurity).toMatch(/pg_advisory_xact_lock/i)
  })

  it("keeps service-role-only onboarding RPCs restricted after security hardening", () => {
    const stabilization = migration("20260521001000_production_stabilization.sql")

    expect(stabilization).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.onboard_resident/i
    )
    expect(stabilization).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.onboard_resident\(uuid,\s*uuid\)\s+to\s+service_role/i
    )
  })

  it("keeps resident invite activation bootstrap atomic and service-role only", () => {
    const activation = migration("20260523007000_resident_activation_bootstrap.sql")

    expect(activation).toMatch(
      /create\s+or\s+replace\s+function\s+public\.activate_resident_invite_atomic/i
    )
    expect(activation).toMatch(/from\s+public\.resident_invites[\s\S]*for\s+update/i)
    expect(activation).toMatch(/from\s+public\.residents[\s\S]*for\s+update/i)
    expect(activation).toMatch(/invite_token_hash\s+=\s+p_invite_token_hash/i)
    expect(activation).toMatch(/status\s+=\s+'used'/i)
    expect(activation).toMatch(/resident\.activation_bootstrap/i)
    expect(activation).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.activate_resident_invite_atomic\(uuid,\s*text,\s*uuid\)\s+from\s+public,\s*anon,\s*authenticated/i
    )
    expect(activation).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.activate_resident_invite_atomic\(uuid,\s*text,\s*uuid\)\s+to\s+service_role/i
    )
  })

  it("keeps new resident rows tenant-scoped at schema level", () => {
    const foundation = migration("20260520000000_foundation_schema.sql")

    expect(foundation).toMatch(/create\s+table\s+public\.residents[\s\S]*organization_id\s+uuid\s+not\s+null/i)
    expect(foundation).toMatch(/create\s+table\s+public\.residents[\s\S]*hostel_id\s+uuid\s+not\s+null/i)
  })

  it("backfills legacy resident onboarding through a restricted migration helper", () => {
    const lifecycle = migration("20260522004000_resident_onboarding_lifecycle.sql")
    const helperBlock = lifecycle.slice(
      lifecycle.indexOf(
        "create or replace function public.backfill_resident_onboarding_status_for_migration"
      ),
      lifecycle.indexOf("create or replace function public.validate_resident_onboarding_status")
    )

    expect(lifecycle).toMatch(/Protected migration pattern/i)
    expect(lifecycle).toMatch(
      /create\s+or\s+replace\s+function\s+public\.backfill_resident_onboarding_status_for_migration\(\)/i
    )
    expect(lifecycle).toMatch(/security\s+definer/i)
    expect(lifecycle).toMatch(
      /alter\s+table\s+public\.residents\s+disable\s+trigger\s+protect_resident_profile_update/i
    )
    expect(lifecycle).toMatch(
      /alter\s+table\s+public\.residents\s+enable\s+trigger\s+protect_resident_profile_update/i
    )
    expect(lifecycle).toMatch(/when\s+others\s+then[\s\S]*enable\s+trigger\s+protect_resident_profile_update/i)
    expect(lifecycle).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.backfill_resident_onboarding_status_for_migration\(\)\s+from\s+public,\s*anon,\s*authenticated/i
    )
    expect(lifecycle).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.backfill_resident_onboarding_status_for_migration\(\)\s+to\s+service_role/i
    )
    expect(lifecycle).toMatch(/resident\.onboarding_legacy_backfill/i)
    expect(helperBlock).toMatch(/update\s+public\.residents/i)
  })

  it("keeps occupancy snapshots derived from active allocations and active residents", () => {
    const occupancy = migration("20260523002000_occupancy_consistency.sql")

    expect(occupancy).toMatch(/create\s+or\s+replace\s+view\s+public\.room_vacancy_view/i)
    expect(occupancy).toMatch(/resident\.status\s+=\s+'active'/i)
    expect(occupancy).toMatch(/resident\.is_active\s+is\s+true/i)
    expect(occupancy).toMatch(/create\s+trigger\s+room_allocations_refresh_capacity/i)
    expect(occupancy).toMatch(/create\s+trigger\s+reservations_refresh_capacity/i)
  })

  it("keeps room allocation and resident deactivation transaction-safe", () => {
    const occupancy = migration("20260523002000_occupancy_consistency.sql")

    expect(occupancy).toMatch(/create\s+or\s+replace\s+function\s+public\.allocate_room_atomic/i)
    expect(occupancy).toMatch(/pg_advisory_xact_lock/i)
    expect(occupancy).toMatch(/perform\s+public\.recalculate_hostel_capacity/i)
    expect(occupancy).toMatch(/create\s+or\s+replace\s+function\s+public\.deactivate_resident_atomic/i)
    expect(occupancy).toMatch(/status\s+=\s+'completed'/i)
  })

  it("keeps resident movement lifecycle mutations transaction-safe", () => {
    const lifecycle = migration("20260523004000_resident_lifecycle_occupancy_hardening.sql")

    expect(lifecycle).toMatch(/create\s+or\s+replace\s+function\s+public\.transfer_room_atomic/i)
    expect(lifecycle).toMatch(/create\s+or\s+replace\s+function\s+public\.checkout_resident_atomic/i)
    expect(lifecycle).toMatch(/pg_advisory_xact_lock/i)
    expect(lifecycle).toMatch(/status\s+=\s+'transferred'/i)
    expect(lifecycle).toMatch(/status\s+=\s+'checked_out'/i)
    expect(lifecycle).toMatch(/perform\s+public\.recalculate_hostel_capacity/i)
    expect(lifecycle).toMatch(/lower\(nullif\(btrim\(bed_label\),\s*''\)\)/i)
  })

  it("releases occupancy when resident status exits active occupancy", () => {
    const lifecycle = migration("20260523004000_resident_lifecycle_occupancy_hardening.sql")

    expect(lifecycle).toMatch(
      /create\s+or\s+replace\s+function\s+public\.release_resident_occupancy_on_status_exit/i
    )
    expect(lifecycle).toMatch(/residents_release_occupancy_on_status_exit/i)
    expect(lifecycle).toMatch(/new\.status\s+in\s+\('suspended',\s*'checked_out',\s*'archived'\)/i)
    expect(lifecycle).toMatch(/Temporary leave does not release a bed/i)
  })

  it("surfaces lifecycle occupancy anomalies for repair dashboards", () => {
    const lifecycle = migration("20260523004000_resident_lifecycle_occupancy_hardening.sql")

    expect(lifecycle).toMatch(/resident_multiple_active_allocations/i)
    expect(lifecycle).toMatch(/room_over_capacity/i)
    expect(lifecycle).toMatch(/active_allocation_without_active_resident/i)
  })

  it("keeps reservation conversion invite-first and non-operational", () => {
    const lifecycle = migration("20260525000000_reservation_conversion_lifecycle_safe.sql")
    const convertBlock = lifecycle.slice(
      lifecycle.indexOf("create or replace function public.convert_reservation_to_resident_atomic"),
      lifecycle.indexOf("create or replace function public.transition_resident_onboarding_atomic")
    )

    expect(convertBlock).toMatch(/status,\s*onboarding_status,\s*joined_on/i)
    expect(convertBlock).toMatch(/'draft',\s*'invited',\s*null/i)
    expect(convertBlock).toMatch(/requires_invite_activation/i)
    expect(convertBlock).toMatch(/requested_room_assignment/i)
    expect(convertBlock).toMatch(/operational_occupancy_created',\s*false/i)
    expect(convertBlock).toMatch(/can_manage_organization\(p_organization_id\)/i)
    expect(convertBlock).not.toMatch(/perform\s+public\.allocate_room_atomic/i)
  })

  it("activates preferred reservation rooms only during verified onboarding", () => {
    const lifecycle = migration("20260525000000_reservation_conversion_lifecycle_safe.sql")
    const transitionBlock = lifecycle.slice(
      lifecycle.indexOf("create or replace function public.transition_resident_onboarding_atomic")
    )

    expect(transitionBlock).toMatch(/if\s+p_next_status\s+=\s+'verified'\s+then/i)
    expect(transitionBlock).toMatch(/requested_room_assignment,room_id/i)
    expect(transitionBlock).toMatch(/perform\s+public\.allocate_room_atomic/i)
    expect(transitionBlock).toMatch(/preferred_room_activation_attempted/i)
  })

  it("keeps phone-first resident access metadata synchronized after invite use", () => {
    const lifecycle = migration("20260525001000_phone_first_onboarding_stabilization.sql")

    expect(lifecycle).toMatch(/sync_resident_invite_activation_metadata/i)
    expect(lifecycle).toMatch(/after update of status,\s*used_at on public\.resident_invites/i)
    expect(lifecycle).toMatch(/temporary_password_active/i)
    expect(lifecycle).toMatch(/temporary_password_expires_at/i)
    expect(lifecycle).toMatch(/resident_access_mode/i)
  })

  it("provides operational cleanup for stale and duplicate resident invites", () => {
    const lifecycle = migration("20260525001000_phone_first_onboarding_stabilization.sql")

    expect(lifecycle).toMatch(/cleanup_resident_onboarding_access/i)
    expect(lifecycle).toMatch(/resident_invite_cleanup_forbidden/i)
    expect(lifecycle).toMatch(/resident_already_activated/i)
    expect(lifecycle).toMatch(/duplicate_active_invite/i)
  })

  it("keeps final loophole repairs tenant-guarded, locked, and audit-backed", () => {
    const repairs = migration("20260525002000_operational_loophole_repair_framework.sql")

    expect(repairs).toMatch(/repair_onboarding_access_consistency_atomic/i)
    expect(repairs).toMatch(/reconcile_invalid_dues_atomic/i)
    expect(repairs).toMatch(/repair_analytics_consistency_atomic/i)
    expect(repairs).toMatch(/can_manage_organization\(p_organization_id,\s*p_hostel_id\)/i)
    expect(repairs).toMatch(/can_manage_finance\(p_organization_id,\s*p_hostel_id\)/i)
    expect(repairs).toMatch(/pg_advisory_xact_lock/i)
    expect(repairs).toMatch(/for update skip locked/i)
    expect(repairs).toMatch(/onboarding_access\.consistency_repair/i)
    expect(repairs).toMatch(/dues\.consistency_reconciliation/i)
    expect(repairs).toMatch(/analytics\.consistency_repair/i)
  })

  it("keeps resident lifecycle repair scoped, traceable, and dry-run capable", () => {
    const repair = migration("20260526002000_resident_lifecycle_repair.sql")

    expect(repair).toMatch(/repair_resident_lifecycle_atomic/i)
    expect(repair).toMatch(/p_dry_run\s+boolean\s+default\s+true/i)
    expect(repair).toMatch(/is_service_context\(\)/i)
    expect(repair).toMatch(/can_manage_organization\(v_resident\.organization_id,\s*v_resident\.hostel_id\)/i)
    expect(repair).toMatch(/pg_advisory_xact_lock/i)
    expect(repair).toMatch(/for update/i)
    expect(repair).toMatch(/auth_lookup/i)
    expect(repair).toMatch(/repair_plan/i)
    expect(repair).toMatch(/resident\.lifecycle_repair/i)
    expect(repair).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.repair_resident_lifecycle_atomic/i
    )
    expect(repair).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.repair_resident_lifecycle_atomic/i
    )
  })

  it("keeps resident auth identity repair service-role-only and alias-unique", () => {
    const repair = migration("20260528002000_resident_auth_identity_canonicalization.sql")

    expect(repair).toMatch(/resident_internal_auth_email/i)
    expect(repair).toMatch(/sync_resident_auth_alias_metadata/i)
    expect(repair).toMatch(/repair_resident_auth_identity_atomic/i)
    expect(repair).toMatch(/is_service_context\(\)/i)
    expect(repair).toMatch(/pg_advisory_xact_lock/i)
    expect(repair).toMatch(/users_resident_auth_login_email_uidx/i)
    expect(repair).toMatch(/users_resident_internal_auth_email_uidx/i)
    expect(repair).toMatch(/users_resident_phone_uidx/i)
    expect(repair).toMatch(/resident\.auth_identity_repair/i)
    expect(repair).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.repair_resident_auth_identity_atomic/i
    )
    expect(repair).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.repair_resident_auth_identity_atomic/i
    )
  })

  it("hardens actor attribution and database permissions through centralized helpers", () => {
    const hardening = migration("20260528003000_actor_permission_operations_hardening.sql")
    const launchHardening = migration("20260530001000_launch_blocker_rbac_notice_hardening.sql")

    expect(hardening).toMatch(/create\s+or\s+replace\s+function\s+public\.assert_trusted_actor/i)
    expect(hardening).toMatch(/p_actor_user_id\s+<>\s+v_auth_user_id/i)
    expect(hardening).toMatch(/actor_spoofing_detected/i)
    expect(hardening).toMatch(/create\s+or\s+replace\s+function\s+public\.role_has_permission/i)
    expect(hardening).toMatch(/create\s+or\s+replace\s+function\s+public\.has_permission_in_organization/i)
    expect(hardening).toMatch(/create\s+or\s+replace\s+function\s+public\.can_manage_finance/i)
    expect(hardening).toMatch(/'finance\.manage'/i)
    expect(hardening).toMatch(/create\s+or\s+replace\s+function\s+public\.enforce_actor_column_trust/i)
    expect(hardening).toMatch(/actor_column_spoofing_detected/i)
    expect(hardening).toMatch(/create\s+trigger\s+enforce_actor_column_trust/i)
    expect(hardening).toMatch(/SECURITY DEFINER ownership alone is not treated as service context/i)
    expect(launchHardening).toMatch(/create\s+or\s+replace\s+function\s+public\.has_permission_in_organization/i)
    expect(launchHardening).toMatch(/with\s+active_assignments\s+as/i)
    expect(launchHardening).toMatch(/not\s+exists\s+\(select\s+1\s+from\s+active_assignments\)/i)
    expect(launchHardening).toMatch(/create\s+or\s+replace\s+function\s+public\.get_current_user_role/i)
  })

  it("normalizes phone identities through a protected migration helper", () => {
    const normalization = migration("20260526001000_phone_identity_normalization.sql")
    const helperBlock = normalization.slice(
      normalization.indexOf(
        "create or replace function public.normalize_phone_identity_records_for_migration"
      )
    )

    expect(normalization).toMatch(/Protected migration pattern/i)
    expect(normalization).toMatch(
      /create\s+or\s+replace\s+function\s+public\.normalize_phone_identity_records_for_migration\(\)/i
    )
    expect(normalization).toMatch(/security\s+definer/i)
    expect(normalization).toMatch(
      /alter\s+table\s+public\.residents\s+disable\s+trigger\s+protect_resident_profile_update/i
    )
    expect(normalization).toMatch(
      /alter\s+table\s+public\.resident_invites\s+disable\s+trigger\s+validate_resident_invites_tenant_scope/i
    )
    expect(normalization).toMatch(
      /alter\s+table\s+public\.residents\s+enable\s+trigger\s+protect_resident_profile_update/i
    )
    expect(normalization).toMatch(
      /alter\s+table\s+public\.resident_invites\s+enable\s+trigger\s+validate_resident_invites_tenant_scope/i
    )
    expect(normalization).toMatch(/when\s+others\s+then[\s\S]*enable\s+trigger\s+protect_resident_profile_update/i)
    expect(normalization).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.normalize_phone_identity_records_for_migration\(\)\s+from\s+public,\s*anon,\s*authenticated/i
    )
    expect(normalization).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.normalize_phone_identity_records_for_migration\(\)\s+to\s+service_role/i
    )
    expect(normalization).toMatch(/phone_identity\.migration_normalization/i)
    expect(normalization).toMatch(/skipped_resident_duplicate_phone_groups/i)
    expect(normalization).toMatch(/tenantless_resident_rows_skipped/i)
    expect(normalization).toMatch(/invalid_resident_organization_rows_skipped/i)
    expect(normalization).toMatch(/invalid_resident_hostel_rows_skipped/i)
    expect(normalization).toMatch(/invalid_invite_resident_link_rows_skipped/i)
    expect(normalization).toMatch(/tenant_identity\.orphan_rows_detected/i)
    expect(normalization).toMatch(/where\s+organization_id\s+is\s+not\s+null/i)
    expect(helperBlock).toMatch(/update\s+public\.residents/i)
  })

  it("reports resident tenant identity anomalies without auto-assigning orphan tenants", () => {
    const normalization = migration("20260526001000_phone_identity_normalization.sql")
    const rpcHardening = migration("20260604005000_repair_rpc_service_role_hardening.sql")

    expect(normalization).toMatch(/create\s+or\s+replace\s+view\s+public\.resident_tenant_identity_anomalies/i)
    expect(normalization).toMatch(
      /create\s+or\s+replace\s+function\s+public\.get_resident_tenant_identity_anomaly_report/i
    )
    expect(normalization).toMatch(/resident_missing_organization_id/i)
    expect(normalization).toMatch(/resident_invalid_organization_id/i)
    expect(normalization).toMatch(/resident_invalid_hostel_id/i)
    expect(normalization).toMatch(/resident_auth_profile_organization_mismatch/i)
    expect(normalization).toMatch(/Do not auto-assign a tenant/i)
    expect(normalization).toMatch(/can_manage_organization\(p_organization_id,\s*p_hostel_id\)/i)
    expect(rpcHardening).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.get_resident_tenant_identity_anomaly_report\(uuid,\s*uuid,\s*integer\)\s+from\s+public,\s*anon,\s*authenticated/i
    )
    expect(rpcHardening).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.get_resident_tenant_identity_anomaly_report\(uuid,\s*uuid,\s*integer\)\s+to\s+service_role/i
    )
  })

  it("keeps repair, reconciliation, and maintenance RPCs service-role-only", () => {
    const rpcHardening = migration("20260604005000_repair_rpc_service_role_hardening.sql")
    const serviceOnlyFunctions = [
      ["financial_reconciliation_counts", "uuid, uuid"],
      ["list_verified_payments_missing_receipts", "uuid, uuid, integer"],
      ["repair_monthly_fee_invoices_atomic", "uuid, uuid, uuid, boolean"],
      ["repair_advance_payment_invoices_atomic", "uuid, uuid, uuid, boolean"],
      ["repair_receipt_invoice_links_atomic", "uuid, uuid, uuid, boolean"],
      ["repair_resident_lifecycle_atomic", "uuid, uuid, uuid, boolean"],
      ["repair_onboarding_access_consistency_atomic", "uuid, uuid, integer, uuid"],
      ["reconcile_invalid_dues_atomic", "uuid, uuid, integer, uuid"],
      ["repair_analytics_consistency_atomic", "uuid, uuid, uuid"],
      ["repair_tenant_linkage_consistency_atomic", "uuid, uuid, uuid"],
      ["repair_occupancy_consistency_atomic", "uuid, uuid, uuid"],
      ["cleanup_resident_onboarding_access", "uuid, uuid, integer, uuid"],
      ["get_resident_tenant_identity_anomaly_report", "uuid, uuid, integer"],
      ["expire_resident_invites", "uuid, uuid, integer"],
      ["expire_reservations", "uuid, uuid, integer"],
    ] as const

    expect(rpcHardening).toMatch(/create\s+or\s+replace\s+function\s+public\.assert_service_role_rpc/i)
    expect(rpcHardening).toMatch(/service_role_rpc_required/i)
    expect(rpcHardening).toMatch(/SECURITY DEFINER ownership alone is not trusted/i)

    for (const [functionName, signature] of serviceOnlyFunctions) {
      expect(rpcHardening).toContain(`perform public.assert_service_role_rpc('${functionName}');`)
      expect(rpcHardening).toContain(
        `grant execute on function public.${functionName}(${signature}) to service_role;`
      )
      expect(rpcHardening).toContain(
        `revoke execute on function public.${functionName}_core(${signature}) from public, anon, authenticated, service_role;`
      )
      expect(rpcHardening).toMatch(
        new RegExp(
          `revoke\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\(${signature.replaceAll(" ", "\\s*")}\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`,
          "i"
        )
      )
    }
  })

  it("makes payment verification invoice linkage atomic at the database layer", () => {
    const invariant = migration("20260604006000_payment_verification_invoice_invariant.sql")

    expect(invariant).toMatch(/payments_verified_invoice_required_chk/i)
    expect(invariant).toMatch(
      /status\s+<>\s+'verified'::public\.payment_status_enum\s+or\s+invoice_id\s+is\s+not\s+null/i
    )
    expect(invariant).toMatch(/not\s+valid/i)
    expect(invariant).toMatch(/create\s+or\s+replace\s+function\s+public\.verify_payment_atomic/i)
    expect(invariant).toMatch(/for\s+update/i)
    expect(invariant).toMatch(/auth\.role\(\)[\s\S]*auth\.uid\(\)/i)
    expect(invariant).toMatch(/payment_verifier_actor_mismatch/i)
    expect(invariant).toMatch(/public\.can_manage_finance\(v_payment\.organization_id,\s*v_payment\.hostel_id\)/i)
    expect(invariant).toMatch(/payment_verification_forbidden/i)
    expect(invariant).toMatch(/payment_proof_required/i)
    expect(invariant).toMatch(/public\.create_monthly_fee_invoice_atomic/i)
    expect(invariant).toMatch(/:payment-receipt:/i)
    expect(invariant).toMatch(/:invoice:/i)
    expect(invariant).toMatch(/metadata->>'source'\s+=\s+'payment_receipt'/i)
    expect(invariant).toMatch(/insert\s+into\s+public\.invoices/i)
    expect(invariant).toMatch(/verified_payment_requires_invoice/i)
    expect(invariant).toMatch(
      /invoice_id\s+=\s+v_payment\.invoice_id,[\s\S]*status\s+=\s+'verified'::public\.payment_status_enum/i
    )
    const requiredInvoiceGuard = invariant.indexOf(
      "raise exception 'verified_payment_requires_invoice'"
    )
    expect(requiredInvoiceGuard).toBeGreaterThan(-1)
    expect(
      invariant.indexOf("status = 'verified'::public.payment_status_enum", requiredInvoiceGuard)
    ).toBeGreaterThan(requiredInvoiceGuard)
    expect(invariant).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.verify_payment_atomic\(uuid,\s*uuid,\s*uuid,\s*text\)\s+to\s+authenticated,\s*service_role/i
    )
  })

  it("keeps resident profile protection active after migration helpers run", () => {
    const activation = migration("20260526000000_activation_state_machine_recovery.sql")
    const lifecycle = migration("20260522004000_resident_onboarding_lifecycle.sql")
    const normalization = migration("20260526001000_phone_identity_normalization.sql")

    expect(activation).toMatch(
      /create\s+or\s+replace\s+function\s+public\.protect_resident_profile_update/i
    )
    expect(activation).toMatch(/Not authorized to update resident profile/i)
    expect(lifecycle).not.toMatch(/drop\s+trigger\s+if\s+exists\s+protect_resident_profile_update/i)
    expect(lifecycle).not.toMatch(/drop\s+function\s+if\s+exists\s+public\.protect_resident_profile_update/i)
    expect(lifecycle).toMatch(
      /alter\s+table\s+public\.residents\s+enable\s+trigger\s+protect_resident_profile_update/i
    )
    expect(normalization).not.toMatch(/drop\s+trigger\s+if\s+exists\s+protect_resident_profile_update/i)
    expect(normalization).not.toMatch(/drop\s+function\s+if\s+exists\s+public\.protect_resident_profile_update/i)
    expect(normalization).toMatch(
      /alter\s+table\s+public\.residents\s+enable\s+trigger\s+protect_resident_profile_update/i
    )
  })

  it("keeps staging demo data reset owner-scoped, service-role only, and config-preserving", () => {
    const reset = migration("20260526003000_staging_demo_data_reset.sql")
    const userGuard = migration("20260526004000_privileged_user_delete_guard.sql")

    expect(reset).toMatch(
      /create\s+or\s+replace\s+function\s+public\.reset_resident_operational_data_for_staging/i
    )
    expect(reset).toMatch(/p_dry_run\s+boolean\s+default\s+true/i)
    expect(reset).toMatch(/demo_data_reset_owner_required/i)
    expect(reset).toMatch(/RESET DEMO DATA/i)
    expect(reset).toMatch(/pg_advisory_xact_lock/i)
    expect(reset).toMatch(/delete\s+from\s+public\.residents/i)
    expect(reset).toMatch(/delete\s+from\s+public\.payments/i)
    expect(reset).toMatch(/delete\s+from\s+public\.invoices/i)
    expect(reset).toMatch(/delete\s+from\s+public\.resident_invites/i)
    expect(reset).toMatch(/document_type::text\s+not\s+in\s+\('gallery_image',\s*'facility_image'\)/i)
    expect(reset).toMatch(/'payment_settings'/i)
    expect(reset).toMatch(/'gallery'/i)
    expect(reset).toMatch(/'website_settings'/i)
    expect(reset).toMatch(/'owner\/admin\/staff auth accounts'/i)
    expect(reset).toMatch(/demo_data_reset\.dry_run/i)
    expect(reset).toMatch(/demo_data_reset\.executed/i)
    expect(reset).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.reset_resident_operational_data_for_staging/i
    )
    expect(reset).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.reset_resident_operational_data_for_staging/i
    )
    expect(userGuard).toMatch(/prevent_privileged_user_hard_delete/i)
    expect(userGuard).toMatch(/privileged_user_hard_delete_blocked/i)
    expect(userGuard).toMatch(/old\.default_role::text\s+not\s+in\s+\('resident',\s*'parent'\)/i)
    expect(userGuard).toMatch(/ur\.role::text\s+not\s+in\s+\('resident',\s*'parent'\)/i)
  })

  it("blocks production destructive operations at the database layer", () => {
    const guard = migration("20260604004000_production_destructive_operation_guard.sql")

    expect(guard).toMatch(/create\s+table\s+if\s+not\s+exists\s+public\.operational_safety_settings/i)
    expect(guard).toMatch(/launch_mode\s+text\s+not\s+null\s+default\s+'production'/i)
    expect(guard).toMatch(/next_public_launch_mode\s+text\s+not\s+null\s+default\s+'production'/i)
    expect(guard).toMatch(/destructive_operations_enabled\s+boolean\s+not\s+null\s+default\s+false/i)
    expect(guard).toMatch(
      /create\s+or\s+replace\s+function\s+public\.assert_non_production_destructive_operation/i
    )
    expect(guard).toMatch(/production_destructive_operation_blocked/i)
    expect(guard).toMatch(
      /perform\s+public\.assert_non_production_destructive_operation\(\s*'reset_resident_operational_data_for_staging'/i
    )

    for (const table of [
      "payments",
      "invoices",
      "monthly_fee_records",
      "residents",
      "documents",
    ]) {
      expect(guard).toMatch(
        new RegExp(`before\\s+delete\\s+on\\s+public\\.${table}`, "i")
      )
    }
  })
})
