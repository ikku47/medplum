# ClinicBuddy Security Verification

This is the evidence ledger for pilot security gates. ClinicBuddy uses one Medplum `Project` per clinic, and the
Medplum server remains the authoritative enforcement boundary. UI role checks improve usability but are never the
security boundary.

## Tenant isolation

Verified on 2026-08-12 against the local `medplum_test` PostgreSQL database:

```sh
npm run test:seed --workspace=@medplum/server
npm test --workspace=@medplum/server -- --run src/fhir/repo.test.ts -t "Prevents setting Project compartments"
npm test --workspace=@medplum/server -- --run src/fhir/onbehalfof.test.ts src/admin/invite.test.ts \
  -t "Forbidden for cross project|Invite with access policy from different project"
```

Evidence:

- Resources created through a clinic repository retain that clinic's project compartment even if a caller attempts
  to inject another project compartment.
- Searching from the other clinic repository does not return the resource.
- `on-behalf-of` authentication using a membership from a different project returns `Forbidden`.
- A staff invitation cannot attach an access policy owned by another project.
- ClinicBuddy additionally rejects a client session when its active `ProjectMembership.project` does not match the
  active `Project` (`apps/clinic/src/tenancy/tenant.test.ts`).

## Role policies

ClinicBuddy generates a Medplum `AccessPolicy` per staff role. Project administrators use project-admin enforcement;
other staff receive only resource interactions implied by the ClinicBuddy permission matrix. Facility references are
stored as membership access parameters for progressive multi-facility scoping.

The role policy tests prove that reception cannot write clinical notes and doctors cannot manage payments.

## External transmission

ABDM, NHCX, and external notification adapters are disabled by default and fail closed. No health or financial data is
transmitted until the clinic configures its own provider credentials and explicitly enables an adapter.

## Remaining production gates

- Verify TLS termination and encrypted managed-database/storage settings in the selected production environment.
- Execute and record a production-like PostgreSQL and object-storage backup/restore drill.
- Review secrets rotation, MFA enforcement, alerting, and audit retention before onboarding a pilot clinic.

## Desktop and tablet browser gate

Verified on 2026-08-13 with Playwright Chromium at 1440x900 and 1024x768 touch viewport:

```sh
npm run test:clinicbuddy --workspace=@medplum/e2e
```

All six scenarios passed. The command starts isolated Medplum and ClinicBuddy development servers, verifies branded
sign-in without horizontal overflow, authenticates the local administrator, opens the dashboard, and verifies the
protected staff/access administration surface. On desktop and tablet it also drives a real patient appointment through
arrival, check-in, vitals, waiting, clinician handoff with Encounter creation, billing, and completion. Earlier runs
identified and fixed valid legacy administrator memberships with no profile or project reference.
