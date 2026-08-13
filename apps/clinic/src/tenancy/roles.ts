// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { ProjectMembership } from '@medplum/fhirtypes';

export const CLINICBUDDY_ROLE_IDENTIFIER_SYSTEM = 'https://clinicbuddy.health/fhir/identifier/staff-role';
export const CLINICBUDDY_FACILITY_ACCESS_PARAMETER = 'clinicbuddy.facility';

export const clinicBuddyRoles = [
  'super-admin',
  'organization-admin',
  'clinic-admin',
  'doctor',
  'nurse',
  'receptionist',
  'billing-staff',
  'lab-staff',
  'medical-records-staff',
  'patient',
] as const;

export type ClinicBuddyRole = (typeof clinicBuddyRoles)[number];

export const clinicBuddyPermissions = [
  'Patient.Read',
  'Patient.Write',
  'Appointment.Read',
  'Appointment.Manage',
  'Queue.Read',
  'Queue.Manage',
  'Encounter.Read',
  'Encounter.Create',
  'Encounter.Sign',
  'Observation.Write',
  'Order.Create',
  'Result.Manage',
  'Result.Review',
  'Prescription.Create',
  'Document.Read',
  'Document.Manage',
  'Billing.Read',
  'Billing.Manage',
  'Report.Clinical',
  'Report.Financial',
  'Admin.Organization.Manage',
  'Admin.User.Manage',
  'Admin.AccessPolicy.Manage',
  'Audit.Read',
] as const;

export type ClinicBuddyPermission = (typeof clinicBuddyPermissions)[number];

const allPermissions = new Set<ClinicBuddyPermission>(clinicBuddyPermissions);

const rolePermissions: Record<ClinicBuddyRole, ReadonlySet<ClinicBuddyPermission>> = {
  'super-admin': allPermissions,
  'organization-admin': allPermissions,
  'clinic-admin': allPermissions,
  doctor: new Set([
    'Patient.Read',
    'Patient.Write',
    'Appointment.Read',
    'Queue.Read',
    'Encounter.Read',
    'Encounter.Create',
    'Encounter.Sign',
    'Observation.Write',
    'Order.Create',
    'Result.Review',
    'Prescription.Create',
    'Document.Read',
    'Document.Manage',
    'Report.Clinical',
  ]),
  nurse: new Set([
    'Patient.Read',
    'Patient.Write',
    'Appointment.Read',
    'Queue.Read',
    'Queue.Manage',
    'Encounter.Read',
    'Encounter.Create',
    'Observation.Write',
    'Order.Create',
    'Result.Review',
    'Document.Read',
    'Document.Manage',
  ]),
  receptionist: new Set([
    'Patient.Read',
    'Patient.Write',
    'Appointment.Read',
    'Appointment.Manage',
    'Queue.Read',
    'Queue.Manage',
    'Document.Read',
    'Billing.Read',
  ]),
  'billing-staff': new Set([
    'Patient.Read',
    'Appointment.Read',
    'Document.Read',
    'Billing.Read',
    'Billing.Manage',
    'Report.Financial',
  ]),
  'lab-staff': new Set([
    'Patient.Read',
    'Appointment.Read',
    'Encounter.Read',
    'Order.Create',
    'Result.Manage',
    'Result.Review',
    'Document.Read',
    'Document.Manage',
  ]),
  'medical-records-staff': new Set([
    'Patient.Read',
    'Patient.Write',
    'Encounter.Read',
    'Document.Read',
    'Document.Manage',
    'Audit.Read',
  ]),
  patient: new Set(['Patient.Read', 'Appointment.Read', 'Document.Read', 'Billing.Read']),
};

export function getClinicBuddyRole(membership: ProjectMembership): ClinicBuddyRole {
  const configuredRole = membership.identifier?.find(
    (identifier) => identifier.system === CLINICBUDDY_ROLE_IDENTIFIER_SYSTEM
  )?.value;

  if (configuredRole && clinicBuddyRoles.includes(configuredRole as ClinicBuddyRole)) {
    return configuredRole as ClinicBuddyRole;
  }

  if (membership.admin) {
    return 'clinic-admin';
  }

  if (membership.profile?.reference?.startsWith('Patient/')) {
    return 'patient';
  }

  return 'doctor';
}

export function hasClinicBuddyPermission(role: ClinicBuddyRole, permission: ClinicBuddyPermission): boolean {
  return rolePermissions[role].has(permission);
}

export function getClinicBuddyPermissions(role: ClinicBuddyRole): ReadonlySet<ClinicBuddyPermission> {
  return rolePermissions[role];
}

export function getAssignedFacilityReferences(membership: ProjectMembership): string[] {
  return (
    membership.access
      ?.flatMap((access) => access.parameter ?? [])
      .filter((parameter) => parameter.name === CLINICBUDDY_FACILITY_ACCESS_PARAMETER)
      .map((parameter) => parameter.valueReference?.reference)
      .filter((reference): reference is string => Boolean(reference)) ?? []
  );
}
