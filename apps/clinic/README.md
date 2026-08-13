# ClinicBuddy Clinic

The staff-facing ClinicBuddy application for outpatient clinics. It is built with Vite, React, TypeScript, and Mantine,
and uses the self-hosted Medplum server as its FHIR, identity, access-control, and audit platform.

## Local development

From the repository root, start PostgreSQL and Redis, then run the server and clinic app in separate terminals:

```bash
docker compose up -d
npm run dev --workspace=@medplum/server
npm run dev:clinic
```

The clinic app runs at `http://localhost:3001` and the API health check is available at
`http://localhost:8103/healthcheck`.

The default local administrator is `admin@example.com` with password `medplum_admin`.

## Product boundaries

- Medplum remains the system of record and security boundary.
- ClinicBuddy owns clinic workflows, role-specific UX, billing, notifications, reporting, and India integrations.
- External services are disabled by default and must be explicitly configured.
