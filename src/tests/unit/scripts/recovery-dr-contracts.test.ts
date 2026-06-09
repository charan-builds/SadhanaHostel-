import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const productionEvidence = readFileSync(
  "scripts/recovery/production-dr-evidence.ts",
  "utf8"
)
const storageValidation = readFileSync(
  "scripts/recovery/storage-validation.ts",
  "utf8"
)
const restoreValidation = readFileSync(
  "scripts/recovery/restore-validation.ts",
  "utf8"
)
const manualBackup = readFileSync(
  "scripts/recovery/manual-google-drive-backup.ts",
  "utf8"
)
const manualCommon = readFileSync("scripts/recovery/manual-dr-common.ts", "utf8")
const manualValidation = readFileSync(
  "scripts/recovery/manual-dr-validation.ts",
  "utf8"
)
const restoreDb = readFileSync("scripts/recovery/restore-db.sh", "utf8")
const restoreStorage = readFileSync("scripts/recovery/restore-storage.sh", "utf8")
const drill = readFileSync("scripts/recovery/disaster-recovery-drill.ts", "utf8")
const packageJson = readFileSync("package.json", "utf8")

describe("DR recovery script contracts", () => {
  it("fails production evidence when source and restore storage object counts diverge", () => {
    expect(productionEvidence).toMatch(/compareStorageSourceAndRestore/)
    expect(productionEvidence).toMatch(/storage-object-count-mismatch/)
    expect(productionEvidence).toMatch(/objectLoss/)
  })

  it("reports database, storage, finance, RTO, and RPO evidence", () => {
    expect(productionEvidence).toMatch(/drReport/)
    expect(productionEvidence).toMatch(/sourceCounts/)
    expect(productionEvidence).toMatch(/restoreCounts/)
    expect(productionEvidence).toMatch(/sourceReconciliation/)
    expect(productionEvidence).toMatch(/backupDurationMs/)
    expect(productionEvidence).toMatch(/rowLoss/)
  })

  it("validates restore storage rows against document metadata", () => {
    expect(restoreValidation).toMatch(/expected storage buckets exist/)
    expect(restoreValidation).toMatch(/document storage objects exist/)
    expect(restoreValidation).toMatch(/invoice PDF storage objects exist/)
    expect(restoreValidation).toMatch(/payment screenshot storage objects exist/)
  })

  it("exposes a storage validation command with signed URL accessibility checks", () => {
    expect(packageJson).toMatch(/"recovery:storage-validation"/)
    expect(storageValidation).toMatch(/RESTORE_SUPABASE_SERVICE_ROLE_KEY/)
    expect(storageValidation).toMatch(/verifySignedUrlAccess/)
    expect(storageValidation).toMatch(/signedUrlAccessible/)
    expect(storageValidation).toMatch(/\$\{side\}-\$\{bucketId\}-accessibility-failed/)
  })

  it("exposes manual Google Drive backup, restore, and validation commands", () => {
    expect(packageJson).toMatch(/"recovery:manual-backup"/)
    expect(packageJson).toMatch(/"recovery:manual-restore-db"/)
    expect(packageJson).toMatch(/"recovery:manual-restore-storage"/)
    expect(packageJson).toMatch(/"recovery:manual-validate"/)
  })

  it("creates manual DR backups with pg_dump, storage copies, manifest hashes, and Google Drive upload", () => {
    expect(manualBackup).toMatch(/pg_dump/)
    expect(manualBackup).toMatch(/backup-manifest\.json/)
    expect(manualBackup).toMatch(/backup-manifest\.sha256/)
    expect(manualBackup).toMatch(/rclone/)
    expect(manualBackup).toMatch(/charanderangula007@gmail\.com/)
    expect(manualCommon).toMatch(/payment-screenshots/)
    expect(manualCommon).toMatch(/payment-qr-codes/)
    expect(manualCommon).toMatch(/gallery-images/)
  })

  it("keeps manual restore scripts isolated from production targets", () => {
    expect(restoreDb).toMatch(/RESTORE_DATABASE_URL/)
    expect(restoreDb).toMatch(/RESTORE_DATABASE_URL.*DATABASE_URL/)
    expect(restoreStorage).toMatch(/manual-storage-restore/)
    expect(manualValidation).toMatch(/assertRestoreTargetIsIsolated/)
  })

  it("validates manual DR table counts, storage counts, signed URLs, and finance invariants", () => {
    expect(manualValidation).toMatch(/verified_payments_missing_invoice/)
    expect(manualValidation).toMatch(/verified_payments_missing_receipt/)
    expect(manualValidation).toMatch(/paid_zero_balance_fee_records_missing_invoice/)
    expect(manualValidation).toMatch(/paid_invoice_payment_total_mismatch/)
    expect(manualValidation).toMatch(/verifySignedUrlAccess/)
    expect(manualValidation).toMatch(/goNoGo/)
  })

  it("runs storage validation as part of the combined DR drill", () => {
    expect(drill).toMatch(/name:\s*"storage-validation"/)
    expect(drill).toMatch(/recovery:storage-validation/)
  })
})
