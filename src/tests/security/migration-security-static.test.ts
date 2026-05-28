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

    expect(manualUpi).toMatch(
      /alter\s+table\s+public\.payment_settings\s+enable\s+row\s+level\s+security/i
    )
    expect(manualUpi).toMatch(
      /alter\s+table\s+public\.payment_settings\s+force\s+row\s+level\s+security/i
    )
    expect(invites).toMatch(
      /alter\s+table\s+public\.resident_invites\s+enable\s+row\s+level\s+security/i
    )
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
    expect(normalization).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.get_resident_tenant_identity_anomaly_report\(uuid,\s*uuid,\s*integer\)\s+from\s+public,\s*anon/i
    )
    expect(normalization).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.get_resident_tenant_identity_anomaly_report\(uuid,\s*uuid,\s*integer\)\s+to\s+authenticated,\s*service_role/i
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
})
