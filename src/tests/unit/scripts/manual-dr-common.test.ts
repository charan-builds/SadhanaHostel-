import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  assertRestoreTargetIsIsolated,
  buildBackupName,
  formatBackupTimestamp,
  storageObjectLocalPath,
} from "../../../../scripts/recovery/manual-dr-common"

describe("manual DR helpers", () => {
  it("formats Google Drive backup names in UTC using the required pattern", () => {
    const date = new Date("2026-06-05T19:07:59.000Z")

    expect(formatBackupTimestamp(date)).toBe("2026-06-05-1907")
    expect(buildBackupName(date)).toBe("backup-2026-06-05-1907")
  })

  it("maps storage object paths under the backup directory", () => {
    const backupDir = path.resolve("/tmp/sadhana-backup")
    const objectPath = "tenant-a/invoices/invoice 01.pdf"

    const localPath = storageObjectLocalPath(backupDir, "invoices", objectPath)

    expect(localPath.startsWith(path.join(backupDir, "storage", "invoices"))).toBe(true)
    expect(localPath).toContain("invoice%2001.pdf")
  })

  it("refuses to restore to the source production database URL", () => {
    expect(() => assertRestoreTargetIsIsolated("postgres://prod", "postgres://prod")).toThrow(
      "RESTORE_DATABASE_URL must not equal DATABASE_URL"
    )
  })
})
