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

The role policy tests prove that reception cannot write clinical notes and doctors cannot manage payments. Patient
members use a separate policy: the authenticated `%patient` profile constrains Patient, appointments, encounters,
clinical records, results, invoices, messages, documents and Binary attachments to that patient's compartment.
Patient profile updates cannot modify identifiers, clinic ownership, links or assigned clinicians; appointment updates
cannot rewrite the clinician, service, slot or visit time. Tenant setup installs this policy as the project's default
Patient registration policy.

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

All eight scenarios passed. The command starts isolated Medplum, ClinicBuddy clinic and ClinicBuddy patient-portal
development servers, verifies branded sign-in without horizontal overflow, authenticates the local administrator,
opens the dashboard, and verifies the protected staff/access administration surface. On desktop and tablet it also
provisions a patient under the Project's authoritative default Patient policy, navigates their appointment, medication,
result, document, invoice and secure message, proves cross-patient reads fail, and proves protected ABHA/MRN fields are
restored rather than overwritten. It then drives a real staff-side patient appointment through
arrival, check-in, vitals, waiting, clinician handoff with Encounter creation, diagnosis, UI clinical-note autosave,
prescription, imaging order, encounter-linked follow-up, an INR 800 invoice, payment, printable receipt, billing handoff
and completion. Earlier runs identified and fixed valid legacy administrator memberships with no profile or project
reference.

## Patient portal gate

Verified on 2026-08-13:

```sh
npm run test --workspace=@clinicbuddy/patient
npm run build --workspace=@clinicbuddy/patient
npm run test --workspace=@clinicbuddy/clinic -- \
  src/tenancy/access-policies.test.ts src/tenancy/patient-portal.test.ts
```

The portal unit suite validates rejection of staff profiles, patient injection into bookings, compartment-linked
messages, invoice balance handling and appointment cancellation guards. Clinic tests validate the generated patient
policy and idempotent installation as the tenant's default registration policy. Production builds pass for both the
patient and clinic applications. The full Playwright command above passes the patient portal on desktop and tablet as
part of its eight-scenario gate.
