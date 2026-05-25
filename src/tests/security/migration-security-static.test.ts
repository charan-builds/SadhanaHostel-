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
})
