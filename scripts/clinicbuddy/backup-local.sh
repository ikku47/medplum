#!/usr/bin/env bash
set -euo pipefail

clinicbuddy_db_name="${CLINICBUDDY_DB_NAME:-medplum}"
clinicbuddy_binary_dir="${CLINICBUDDY_BINARY_DIR:-packages/server/binary}"
clinicbuddy_backup_root="${1:-backups/clinicbuddy}"
clinicbuddy_timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
clinicbuddy_backup_dir="${clinicbuddy_backup_root}/${clinicbuddy_timestamp}"

mkdir -p "${clinicbuddy_backup_dir}"

docker compose exec -T postgres pg_dump \
  --username medplum \
  --dbname "${clinicbuddy_db_name}" \
  --format custom \
  --no-owner \
  --no-acl > "${clinicbuddy_backup_dir}/database.dump"

if [[ -d "${clinicbuddy_binary_dir}" ]]; then
  tar -C "${clinicbuddy_binary_dir}" -czf "${clinicbuddy_backup_dir}/binary-storage.tar.gz" .
fi

(
  cd "${clinicbuddy_backup_dir}"
  shasum -a 256 database.dump > checksums.sha256
  if [[ -f binary-storage.tar.gz ]]; then
    shasum -a 256 binary-storage.tar.gz >> checksums.sha256
  fi
)

{
  echo "created_at=${clinicbuddy_timestamp}"
  echo "database=${clinicbuddy_db_name}"
  echo "binary_storage_included=$([[ -f "${clinicbuddy_backup_dir}/binary-storage.tar.gz" ]] && echo true || echo false)"
  echo "git_revision=$(git rev-parse --verify HEAD 2>/dev/null || echo uncommitted)"
} > "${clinicbuddy_backup_dir}/manifest.txt"

echo "ClinicBuddy backup created: ${clinicbuddy_backup_dir}"
