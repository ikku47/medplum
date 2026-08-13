// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { AccessPolicy, AccessPolicyResource, ProjectMembership, Reference } from '@medplum/fhirtypes';
import type { ClinicBuddyPermission, ClinicBuddyRole } from './roles';
import {
  CLINICBUDDY_FACILITY_ACCESS_PARAMETER,
  CLINICBUDDY_ROLE_IDENTIFIER_SYSTEM,
  getClinicBuddyPermissions,
} from './roles';

export const CLINICBUDDY_ACCESS_POLICY_IDENTIFIER = 'https://clinicbuddy.health/fhir/identifier/access-policy';

const readInteractions = ['read', 'vread', 'history', 'search'] as const;
const writeInteractions = [...readInteractions, 'create', 'update'] as const;
const adminInteractions = [...writeInteractions, 'delete'] as const;

const permissionResources: Partial<Record<ClinicBuddyPermission, readonly string[]>> = {
  'Patient.Read': ['Patient', 'RelatedPerson', 'Flag', 'AllergyIntolerance', 'Consent'],
  'Patient.Write': ['Patient', 'RelatedPerson', 'Flag', 'AllergyIntolerance', 'Consent'],
  'Appointment.Read': ['Appointment', 'Schedule', 'Slot'],
  'Appointment.Manage': ['Appointment', 'Schedule', 'Slot'],
  'Queue.Read': ['Appointment', 'Encounter'],
  'Queue.Manage': ['Appointment', 'Encounter'],
  'Encounter.Read': ['Encounter', 'ClinicalImpression', 'Condition', 'Procedure', 'CarePlan'],
  'Encounter.Create': ['Encounter', 'ClinicalImpression', 'Condition', 'Procedure', 'CarePlan'],
  'Encounter.Sign': ['Encounter', 'ClinicalImpression', 'Condition', 'Procedure', 'CarePlan', 'Provenance'],
  'Observation.Write': ['Observation'],
  'Order.Create': ['ServiceRequest', 'Specimen'],
  'Result.Manage': ['DiagnosticReport', 'Observation'],
  'Result.Review': ['DiagnosticReport', 'Observation'],
  'Prescription.Create': ['MedicationRequest', 'Medication'],
  'Document.Read': ['DocumentReference', 'Binary'],
  'Document.Manage': ['DocumentReference', 'Binary'],
  'Billing.Read': ['Invoice', 'PaymentReconciliation', 'ChargeItem', 'ChargeItemDefinition', 'Coverage'],
  'Billing.Manage': ['Invoice', 'PaymentReconciliation', 'ChargeItem', 'ChargeItemDefinition', 'Coverage'],
  'Report.Clinical': ['Measure', 'MeasureReport'],
  'Report.Financial': ['Measure', 'MeasureReport', 'Invoice', 'PaymentReconciliation'],
  'Admin.Organization.Manage': ['Organization', 'Location', 'HealthcareService'],
  'Admin.User.Manage': ['ProjectMembership', 'Practitioner', 'PractitionerRole'],
  'Admin.AccessPolicy.Manage': ['AccessPolicy'],
  'Audit.Read': ['AuditEvent'],
};

const writePermissions = new Set<ClinicBuddyPermission>([
  'Patient.Write',
  'Appointment.Manage',
  'Queue.Manage',
  'Encounter.Create',
  'Encounter.Sign',
  'Observation.Write',
  'Order.Create',
  'Result.Manage',
  'Result.Review',
  'Prescription.Create',
  'Document.Manage',
  'Billing.Manage',
  'Admin.Organization.Manage',
  'Admin.User.Manage',
  'Admin.AccessPolicy.Manage',
]);

export function buildClinicBuddyAccessPolicy(role: ClinicBuddyRole): AccessPolicy {
  if (role === 'patient') {
    return buildClinicBuddyPatientAccessPolicy();
  }

  if (role === 'super-admin' || role === 'organization-admin' || role === 'clinic-admin') {
    return {
      resourceType: 'AccessPolicy',
      name: `ClinicBuddy ${formatRole(role)}`,
      meta: { tag: [{ system: CLINICBUDDY_ACCESS_POLICY_IDENTIFIER, code: role }] },
      resource: [{ resourceType: '*', interaction: [...adminInteractions] }],
    };
  }

  const interactions = new Map<string, Set<NonNullable<AccessPolicyResource['interaction']>[number]>>();
  for (const permission of getClinicBuddyPermissions(role)) {
    for (const resourceType of permissionResources[permission] ?? []) {
      const current = interactions.get(resourceType) ?? new Set();
      for (const interaction of writePermissions.has(permission) ? writeInteractions : readInteractions) {
        current.add(interaction);
      }
      interactions.set(resourceType, current);
    }
  }

  // Every staff role needs its own profile plus in-clinic collaboration resources.
  for (const resourceType of ['Practitioner', 'PractitionerRole', 'Organization', 'Location']) {
    interactions.set(resourceType, new Set(readInteractions));
  }
  for (const resourceType of ['Communication', 'CommunicationRequest', 'Task']) {
    interactions.set(resourceType, new Set(writeInteractions));
  }

  return {
    resourceType: 'AccessPolicy',
    name: `ClinicBuddy ${formatRole(role)}`,
    meta: { tag: [{ system: CLINICBUDDY_ACCESS_POLICY_IDENTIFIER, code: role }] },
    resource: [...interactions.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([resourceType, allowed]) => ({ resourceType, interaction: [...allowed] })),
  };
}

/**
 * Patient access is deliberately separate from staff RBAC. Every clinical and financial rule is
 * constrained to the authenticated Patient profile; shared scheduling/catalog resources are read-only.
 */
export function buildClinicBuddyPatientAccessPolicy(): AccessPolicy {
  const patientReadResources = [
    'AllergyIntolerance',
    'Binary',
    'CarePlan',
    'Condition',
    'Consent',
    'Coverage',
    'DiagnosticReport',
    'DocumentReference',
    'Encounter',
    'Immunization',
    'Invoice',
    'MedicationRequest',
    'MedicationStatement',
    'Observation',
    'Procedure',
    'ServiceRequest',
  ];
  const sharedReadResources = [
    'HealthcareService',
    'Location',
    'Medication',
    'Organization',
    'Practitioner',
    'PractitionerRole',
    'Questionnaire',
    'Schedule',
  ];

  return {
    resourceType: 'AccessPolicy',
    name: 'ClinicBuddy Patient',
    meta: { tag: [{ system: CLINICBUDDY_ACCESS_POLICY_IDENTIFIER, code: 'patient' }] },
    compartment: { reference: '%patient' },
    resource: [
      {
        resourceType: 'Patient',
        criteria: 'Patient?_id=%patient.id',
        interaction: [...readInteractions],
      },
      {
        resourceType: 'Patient',
        criteria: 'Patient?_id=%patient.id',
        interaction: ['update'],
        readonlyFields: ['active', 'generalPractitioner', 'identifier', 'link', 'managingOrganization'],
      },
      ...patientReadResources.map((resourceType) => ({
        resourceType,
        criteria: `${resourceType}?_compartment=%patient`,
        interaction: [...readInteractions],
      })),
      {
        resourceType: 'Appointment',
        criteria: 'Appointment?_compartment=%patient',
        interaction: [...readInteractions, 'create'],
      },
      {
        resourceType: 'Appointment',
        criteria: 'Appointment?_compartment=%patient',
        interaction: ['update'],
        readonlyFields: [
          'appointmentType',
          'basedOn',
          'end',
          'participant',
          'serviceCategory',
          'serviceType',
          'slot',
          'specialty',
          'start',
          'supportingInformation',
        ],
      },
      {
        resourceType: 'Communication',
        criteria: 'Communication?recipient=%patient',
        interaction: [...readInteractions],
      },
      {
        resourceType: 'Communication',
        criteria: 'Communication?sender=%patient',
        interaction: [...writeInteractions],
      },
      {
        resourceType: 'QuestionnaireResponse',
        criteria: 'QuestionnaireResponse?_compartment=%patient',
        interaction: [...writeInteractions],
      },
      {
        // The scheduling $book operation creates PHI-free busy slots atomically.
        resourceType: 'Slot',
        interaction: ['search', 'read', 'create'],
      },
      ...sharedReadResources.map((resourceType) => ({
        resourceType,
        interaction: [...readInteractions],
      })),
    ],
  };
}

export function applyClinicBuddyMembershipAccess(
  membership: ProjectMembership,
  role: ClinicBuddyRole,
  policy: Reference<AccessPolicy>,
  facilityReferences: string[]
): ProjectMembership {
  return {
    ...membership,
    ...buildClinicBuddyMembershipSettings(
      role,
      policy,
      facilityReferences,
      membership.identifier,
      membership.active ?? true
    ),
  };
}

export function buildClinicBuddyMembershipSettings(
  role: ClinicBuddyRole,
  policy: Reference<AccessPolicy>,
  facilityReferences: string[],
  identifiers: ProjectMembership['identifier'] = [],
  active = true
): Pick<ProjectMembership, 'active' | 'admin' | 'identifier' | 'accessPolicy' | 'access'> {
  const identifier = [
    ...(identifiers?.filter((item) => item.system !== CLINICBUDDY_ROLE_IDENTIFIER_SYSTEM) ?? []),
    { system: CLINICBUDDY_ROLE_IDENTIFIER_SYSTEM, value: role },
  ];
  const admin = role === 'super-admin' || role === 'organization-admin' || role === 'clinic-admin';
  return {
    active,
    admin,
    identifier,
    accessPolicy: policy,
    access: [
      {
        policy,
        parameter: [...new Set(facilityReferences)].map((reference) => ({
          name: CLINICBUDDY_FACILITY_ACCESS_PARAMETER,
          valueReference: { reference },
        })),
      },
    ],
  };
}

export function formatRole(role: ClinicBuddyRole): string {
  return role
    .split('-')
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
