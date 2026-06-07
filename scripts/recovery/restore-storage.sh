#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/recovery/restore-storage.sh <backup-dir>" >&2
  exit 2
fi

tsx scripts/recovery/manual-storage-restore.ts "$1"
