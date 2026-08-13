#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup-directory>" >&2
  exit 2
fi

clinicbuddy_backup_dir="$1"
clinicbuddy_dump="${clinicbuddy_backup_dir}/database.dump"
if [[ ! -f "${clinicbuddy_dump}" ]]; then
  echo "Missing database dump: ${clinicbuddy_dump}" >&2
  exit 2
fi

(
  cd "${clinicbuddy_backup_dir}"
  shasum -a 256 --check checksums.sha256
)

clinicbuddy_drill_db="clinicbuddy_restore_$(date -u +%Y%m%d%H%M%S)_${RANDOM}"
cleanup_restore_database() {
  docker compose exec -T postgres dropdb --username medplum --if-exists "${clinicbuddy_drill_db}" >/dev/null
}
trap cleanup_restore_database EXIT

docker compose exec -T postgres createdb --username medplum "${clinicbuddy_drill_db}"
docker compose exec -T postgres pg_restore \
  --username medplum \
  --dbname "${clinicbuddy_drill_db}" \
  --no-owner \
  --no-acl < "${clinicbuddy_dump}"

clinicbuddy_resource_count="$(
  docker compose exec -T postgres psql \
    --username medplum \
    --dbname "${clinicbuddy_drill_db}" \
    --tuples-only \
    --no-align \
    --command 'SELECT COUNT(*) FROM "Project";'
)"

if [[ ! "${clinicbuddy_resource_count}" =~ ^[0-9]+$ ]] || [[ "${clinicbuddy_resource_count}" -lt 1 ]]; then
  echo "Restore verification failed: no Project resources were restored." >&2
  exit 1
fi

echo "Restore drill passed: ${clinicbuddy_resource_count} project resource(s) restored into temporary database."
