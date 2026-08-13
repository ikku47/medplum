# ClinicBuddy Architecture

## Locked product decisions

- Product name: ClinicBuddy
- Initial market: India
- Delivery model: multi-tenant SaaS
- Staff frontend: Vite, React, TypeScript, and Mantine
- Initial language: English (`en-IN`); localization remains mandatory and RTL support is planned
- Healthcare platform: self-hosted Medplum and FHIR R4

## Runtime layers

```text
Clinic staff
    |
ClinicBuddy clinic application
    |
ClinicBuddy domain modules
    |
Medplum FHIR, authentication, access policy, and audit
    |
PostgreSQL, Redis, and object storage
```

Domain modules are code boundaries first, not independent microservices. They can be extracted into services only when
scale, isolation, or an integration protocol requires it.

## Tenant model

Each clinic organization maps to a Medplum Project. Facilities and departments live inside that project as FHIR
`Location` and `Organization` resources. Authenticated `ProjectMembership` and `AccessPolicy` resources establish the
tenant boundary; browser-supplied tenant identifiers are never authoritative.

Tenant isolation must be verified with automated cross-project access tests before pilot deployment.

## Application surfaces

- `apps/clinic`: staff-facing clinic operations
- `packages/app`: internal FHIR and platform administration
- Patient portal: later, as a dedicated patient-facing application

## India pack

India-specific identity, consent, terminology, prescription, ABDM/ABHA, and NHCX behavior must remain behind adapter
interfaces. The core clinic workflow must operate without external national integrations for the first self-pay pilot.

## External data boundary

Third-party authentication, reCAPTCHA, messaging, payment, terminology, insurance, laboratory, and government services
are disabled unless explicitly configured. Every enabled integration requires a documented data-flow and security review.
