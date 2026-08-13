# ClinicBuddy PRD Delivery Map

This file is the implementation ledger for `ClinicBuddy — Product Requirements Document.md`. The PRD's original
UAE-first wording is superseded by the product decision to launch in India first. RTL remains an architectural
requirement for a later country pack, not a v1 UI requirement.

Status meanings:

- **Available**: inherited capability exists in the first-class ClinicBuddy application and is being verified.
- **Foundation**: the production boundary and core model are implemented; workflows remain to be completed.
- **Next**: part of the active MVP delivery sequence.
- **Later**: intentionally follows the India clinic pilot.

## Product Surfaces

| Surface                  | Technology           | Status     | Implementation                                                                                                           |
| ------------------------ | -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Clinic application       | Vite, React, Mantine | Available  | `apps/clinic`                                                                                                            |
| Platform administration  | Vite, React, Mantine | Foundation | ClinicBuddy has organization/facility, staff/access-policy, service catalog and audit administration routes               |
| Patient portal           | Vite, React, Mantine | Later      | Planned as `apps/patient`                                                                                                |
| FHIR/auth/audit platform | Medplum server       | Available  | `packages/server` and supporting packages                                                                                |

## Architecture And Tenancy

| Requirement                   | Status           | Current delivery                                                                                                                        |
| ----------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| SaaS multi-tenancy            | Foundation       | One Medplum Project per clinic; the active ProjectMembership is validated against the project on every ClinicBuddy session              |
| Organizations and facilities  | Foundation       | FHIR Organization and Location builders plus administrator setup screen; India addresses use `country=IN`                               |
| Multi-facility staff scope    | Foundation       | Staff invitations and edits persist selected Location references as parameterized ProjectMembership access-policy inputs                 |
| Configurable RBAC             | Foundation       | Ten initial roles, a typed permission matrix, generated Medplum AccessPolicies, invitations, role edits and account deactivation exist   |
| Tenant isolation verification | Available        | Server integration tests prove project compartment, search, impersonation and cross-project access-policy isolation                      |
| Audit trail                   | Available        | Medplum generates FHIR AuditEvents for server access and mutations; authorized ClinicBuddy administrators have a tenant audit viewer    |
| Encryption, backups, recovery | Foundation       | Production encryption checklist and safe local backup/restore scripts exist; a checksum-verified restore drill passed, while cloud KMS/PITR evidence remains deployment-specific |
| Desktop and tablet            | Foundation       | Playwright verifies branded sign-in, dashboard and protected administration without overflow at 1440x900 and 1024x768, plus a real queue journey through vitals, Encounter handoff, billing and completion; clinical documentation/payment E2E remains |

## Functional Modules

| PRD module            | Status                 | Current delivery and next slice                                                                                                                                                                                                                                                           |
| --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard             | Foundation             | Role-aware Reception, Doctor and Administrator home views now use live appointment, patient, clinical and financial FHIR data; recently-viewed history and deeper analytics remain                                                                                                        |
| Patients              | Available / Foundation | India-native registration now creates tenant MRNs, validates mobile and optional consent-gated ABHA, and blocks exact duplicates; patient summary and advanced merge controls remain                                                                                                      |
| Appointments          | Available / Foundation | Day/week and provider calendars, slots, rescheduling, cancellation and status management exist; administrators configure bookable appointment types with duration, India timezone/default hours and locations, then enable them per practitioner calendar; facility view, recurring schedules and holidays remain |
| Reception & Queue     | Foundation             | Live day board implements arrival, check-in, vitals, waiting, consultation, billing, completion, cancellation, no-show and left-without-consultation; staff can assign configured rooms inline, and desktop/tablet E2E proves the main flow and Encounter handoff                              |
| Clinical / EHR        | Available / Foundation | Encounter hand-off opens structured SOAP-compatible notes with immutable signatures and addenda; administrators can create/retire reusable FHIR Questionnaires and existing PlanDefinition care templates remain selectable; installable specialty packs remain |
| Orders & Results      | Available / Foundation | Laboratory ordering remains available; encounter-linked imaging, procedure, referral and other ServiceRequests are implemented, with a clinician results inbox for new/reviewed, abnormal/critical and patient-notified state; external India lab adapters remain                         |
| Prescriptions         | Available / Foundation | India-local MedicationRequest entry and printable prescriptions work without an external pharmacy network; national/provider transmission remains an optional adapter                                                                                                                     |
| Laboratory            | Available / Next       | Internal lab workflow exists; external India lab adapters remain                                                                                                                                                                                                                          |
| Pharmacy              | Later                  | India pharmacy/dispensing workflow follows prescribing MVP                                                                                                                                                                                                                                |
| Billing               | Foundation             | INR self-pay invoices support service lines, discounts, taxes, split cash/card/bank/online payments, refunds, outstanding balances and printable receipts                                                                                                                                    |
| Insurance             | Foundation             | FHIR coverage/claim models exist; NHCX adapter remains disabled until configured                                                                                                                                                                                                          |
| Documents             | Available              | Upload, view, metadata and download workflows exist; audit coverage remains                                                                                                                                                                                                               |
| Communications        | Foundation             | Tasks and messages exist; tenant-bound FHIR notification requests and a fail-closed provider adapter contract now cover internal, email, SMS, push and WhatsApp; provider credentials remain tenant configuration                                                                            |
| Patient Portal        | Later                  | Separate patient surface after staff MVP                                                                                                                                                                                                                                                  |
| Reports & Analytics   | Foundation             | Financial, operational and clinical reports cover revenue, collections, balances, patient volume, completion/cancellation/no-show, waiting time, provider utilization, diagnoses, procedures, medications and order categories                                                               |
| Administration        | Foundation             | Organization/facility, department/room hierarchy, bookable appointment types, staff invitation/access/deactivation, audit, INR service catalog, forms and care templates exist; an idempotent General Practice pack installs forms, templates, scheduling and billing defaults without changing the core |
| Integrations          | Foundation             | Notification, ABDM and NHCX adapter contracts are explicit, tenant-configured and fail closed; no external transmission occurs without an enabled implementation                                                                                                                            |
| Country Configuration | Foundation             | India-only runtime configuration is active; future country packs must not modify the clinical core                                                                                                                                                                                        |

## India Country Pack

| Capability                 | Status     | Boundary                                                                                                                                                                                   |
| -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Indian patient identifiers | Foundation | Tenant-specific MRN plus optional validated ABHA identifiers are stored using typed FHIR systems; ABDM lookup remains opt-in                                                               |
| ABHA / ABDM                | Foundation | A disabled-by-default adapter contract requires tenant context and verified FHIR Consent before health-information exchange; live ABDM credentials remain opt-in                           |
| Consent                    | Foundation | Patient charts record, verify, time-bound and revoke profiled FHIR Consents; the ABDM exchange guard fails closed unless the same patient has active, unexpired health-information-exchange permission |
| India terminology          | Foundation | Diagnosis search now uses configurable SNOMED CT and ICD-10 value-set bindings without a US-only profile; procedure, medication and administrative catalogs remain                         |
| Prescription configuration | Foundation | India-local entry captures medication, dose, route, frequency, duration, quantity, refills and instructions; printable output includes patient, clinician registration and clinic identity |
| NHCX / insurance           | Foundation | A disabled-by-default eligibility, submission and claim-status adapter is isolated from core billing; no automatic external transmission                                                    |
| INR and India locale       | Foundation | `INR`, `en-IN`, and `IN` are the current application defaults                                                                                                                              |
| Future RTL                 | Later      | Keep layout direction and locale concerns isolated for a future country pack                                                                                                               |

## MVP Definition Of Done

The delivery order for the PRD's pilot checklist is:

1. Organization, facility, tenant context, roles and staff access policies. **Administrator workflows and generated server policies implemented; multi-facility clinical filtering remains progressive.**
2. Patient registration, search, duplicate prevention and Indian identifiers. **Core registration path implemented; advanced merge/review remains.**
3. Appointment, check-in, queue, vitals and clinician hand-off. **Desktop and tablet browser journeys pass through Encounter creation and visit completion.**
4. Encounter documentation, diagnosis, prescriptions, orders, results, documents and follow-up.
5. INR invoice, payment and receipt. **Self-pay vertical slice implemented, including split payments, refunds, receipts and financial reporting.**
6. Critical audit events, tenant-isolation tests, encryption review, backup/restore drill and desktop/tablet E2E tests.

No item is considered complete merely because the underlying FHIR resource exists; the ClinicBuddy workflow, access
policy, validation, audit behavior and end-to-end tests must all pass.
