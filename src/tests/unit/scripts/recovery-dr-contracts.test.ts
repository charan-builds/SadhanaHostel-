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
})
