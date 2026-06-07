#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/recovery/restore-db.sh <backup-dir-or-sql-file>" >&2
  exit 2
fi

if [ -z "${RESTORE_DATABASE_URL:-}" ]; then
  echo "RESTORE_DATABASE_URL is required." >&2
  exit 2
fi

if [ -n "${DATABASE_URL:-}" ] && [ "$RESTORE_DATABASE_URL" = "$DATABASE_URL" ]; then
  echo "Refusing to restore: RESTORE_DATABASE_URL must not equal DATABASE_URL." >&2
  exit 2
fi

INPUT="$1"

if [ -d "$INPUT" ]; then
  BACKUP_DIR="$(cd "$INPUT" && pwd -P)"
  SQL_FILE="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'backup-*.sql' | sort | head -n 1)"
else
  SQL_FILE="$(cd "$(dirname "$INPUT")" && pwd -P)/$(basename "$INPUT")"
  BACKUP_DIR="$(dirname "$SQL_FILE")"
fi

if [ -z "${SQL_FILE:-}" ] || [ ! -f "$SQL_FILE" ]; then
  echo "No backup-YYYY-MM-DD-HHMM.sql file found." >&2
  exit 2
fi

START_MS="$(node -e 'console.log(Date.now())')"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
END_MS="$(node -e 'console.log(Date.now())')"
DURATION_MS="$((END_MS - START_MS))"
REPORT_PATH="$BACKUP_DIR/manual-db-restore-report.json"

node - "$REPORT_PATH" "$(basename "$BACKUP_DIR")" "$SQL_FILE" "$DURATION_MS" <<'NODE'
const { writeFileSync } = require("node:fs")

const [reportPath, backupName, sqlFile, durationMs] = process.argv.slice(2)
writeFileSync(
  reportPath,
  `${JSON.stringify(
    {
      ok: true,
      restoredAt: new Date().toISOString(),
      backupName,
      sqlFile,
      rto: {
        databaseRestoreDurationMs: Number(durationMs),
      },
    },
    null,
    2
  )}\n`
)
NODE

cat "$REPORT_PATH"
