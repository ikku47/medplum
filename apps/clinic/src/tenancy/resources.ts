// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Location, Organization, Project } from '@medplum/fhirtypes';

export const CLINICBUDDY_TENANT_IDENTIFIER_SYSTEM = 'https://clinicbuddy.health/fhir/identifier/tenant';
export const CLINICBUDDY_FACILITY_IDENTIFIER_SYSTEM = 'https://clinicbuddy.health/fhir/identifier/facility';

export interface ClinicOrganizationInput {
  name: string;
  phone?: string;
  email?: string;
}

export interface ClinicFacilityInput {
  name: string;
  phone?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export function buildClinicOrganization(
  project: Project,
  input: ClinicOrganizationInput,
  existing?: Organization
): Organization {
  if (!project.id) {
    throw new Error('A persisted project is required to configure a clinic organization.');
  }

  return {
    ...existing,
    resourceType: 'Organization',
    active: true,
    name: requireName(input.name, 'Organization name'),
    identifier: replaceIdentifier(existing?.identifier, CLINICBUDDY_TENANT_IDENTIFIER_SYSTEM, project.id),
    type: [
      {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: 'prov' }],
        text: 'Healthcare Provider',
      },
    ],
    telecom: buildTelecom(input.phone, input.email),
  };
}

export function buildClinicFacility(
  project: Project,
  organization: Organization,
  input: ClinicFacilityInput,
  existing?: Location
): Location {
  if (!project.id || !organization.id) {
    throw new Error('Persisted project and organization resources are required to configure a facility.');
  }

  const address = {
    use: 'work' as const,
    type: 'physical' as const,
    line: input.addressLine ? [input.addressLine.trim()] : undefined,
    city: input.city?.trim() || undefined,
    state: input.state?.trim() || undefined,
    postalCode: input.postalCode?.trim() || undefined,
    country: 'IN',
  };

  return {
    ...existing,
    resourceType: 'Location',
    status: 'active',
    mode: 'instance',
    name: requireName(input.name, 'Facility name'),
    identifier: replaceIdentifier(
      existing?.identifier,
      CLINICBUDDY_FACILITY_IDENTIFIER_SYSTEM,
      `${project.id}:primary`
    ),
    telecom: buildTelecom(input.phone),
    address,
    physicalType: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/location-physical-type', code: 'bu' }],
      text: 'Building',
    },
    managingOrganization: { reference: `Organization/${organization.id}`, display: organization.name },
  };
}

function buildTelecom(phone?: string, email?: string): Organization['telecom'] {
  const telecom: NonNullable<Organization['telecom']> = [];
  if (phone?.trim()) {
    telecom.push({ system: 'phone', use: 'work', value: phone.trim() });
  }
  if (email?.trim()) {
    telecom.push({ system: 'email', use: 'work', value: email.trim() });
  }
  return telecom.length > 0 ? telecom : undefined;
}

function replaceIdentifier(
  identifiers: Organization['identifier'],
  system: string,
  value: string
): NonNullable<Organization['identifier']> {
  return [...(identifiers?.filter((identifier) => identifier.system !== system) ?? []), { system, value }];
}

function requireName(value: string, field: string): string {
  const name = value.trim();
  if (!name) {
    throw new Error(`${field} is required.`);
  }
  return name;
}
