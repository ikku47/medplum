# ClinicBuddy Production Readiness

This runbook is mandatory before a clinic pilot. Local development settings are not production settings.

## Encryption and secrets

- Terminate TLS 1.2 or newer at the load balancer and use HTTPS for ClinicBuddy, the FHIR API, storage URLs, and all
  configured integrations.
- Set `MEDPLUM_DATABASE_SSL_REQUIRE=true`; validate the CA with
  `MEDPLUM_DATABASE_SSL_REJECT_UNAUTHORIZED=true` and `MEDPLUM_DATABASE_SSL_CA` for private database certificates.
- Use encrypted PostgreSQL volumes/snapshots and encrypted object storage with a customer-controlled cloud KMS key.
- Use TLS and authentication for Redis. Redis is queue/cache infrastructure and is not a substitute for PostgreSQL
  or object-storage backups.
- Configure a persistent Medplum signing key. The development server's temporary signing key invalidates signed
  storage URLs after restart and is not acceptable in production.
- Keep database, Redis, email, SMS, WhatsApp, ABDM, NHCX, and storage credentials in the deployment secret manager;
  never place them in Vite variables, source control, or browser storage.
- Require MFA for organization and clinic administrators and rotate production credentials on a documented schedule.

## Backup policy

- PostgreSQL: automated encrypted daily full backups plus point-in-time recovery logs. Pilot target RPO: 15 minutes.
- Binary/object storage: versioning, deletion protection, and cross-zone or cross-region replication as required by
  the clinic's data residency agreement.
- Configuration and application version: retain the deployment manifest, Medplum configuration without secret
  values, migration version, and ClinicBuddy Git revision alongside each backup.
- Retention: define the clinical/legal retention period with the deploying organization. Test expiration without
  deleting records that remain under a legal or clinical hold.
- Access: backup operators must be separate from ordinary clinic users; backup reads and restore operations must be
  audited.

For the local Docker environment only:

```sh
CLINICBUDDY_DB_NAME=medplum scripts/clinicbuddy/backup-local.sh
scripts/clinicbuddy/restore-drill-local.sh backups/clinicbuddy/<timestamp>
```

The scripts checksum the database and optional filesystem binary archive. The restore drill creates a uniquely named
temporary database, restores the dump, verifies project resources, and drops the temporary database on exit. It never
overwrites the source database.

## Restore drill

Perform quarterly and before every pilot launch:

1. Select a backup without disclosing production data to a lower-trust environment.
2. Restore PostgreSQL to a new isolated database and object data to a new isolated bucket/prefix.
3. Start the same ClinicBuddy/Medplum release against the restored copies with outbound integrations disabled.
4. Verify clinic count, patient count, a recent encounter, a signed note, a prescription, an invoice, its receipt,
   and an uploaded document checksum.
5. Verify tenant A cannot search, read, or export tenant B resources.
6. Record backup timestamp, restore start/end, achieved RPO/RTO, row/object counts, verifier, and any discrepancy.
7. Destroy the isolated restored environment using the organization's approved secure-deletion procedure.

Pilot target RTO is four hours. A green automated backup job without a successful restore drill is not sufficient.

Local drill evidence (2026-08-12): a checksum-verified `medplum_test` dump restored successfully into a uniquely named
temporary PostgreSQL database; nine Project resources were verified and the temporary database was removed on exit.

## Go-live record

Create a dated evidence record containing TLS checks, KMS/encryption settings, backup policy, latest restore result,
tenant-isolation test output, MFA status, monitoring/alert routes, incident contacts, and approval by the clinic data
owner. Do not include secret values in that record.
