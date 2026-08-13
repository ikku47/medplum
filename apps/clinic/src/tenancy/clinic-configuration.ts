// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { HealthcareService, Location, Organization, Reference } from '@medplum/fhirtypes';

export const CLINICBUDDY_LOCATION_KIND = 'https://clinicbuddy.health/fhir/CodeSystem/location-kind';
export const CLINICBUDDY_APPOINTMENT_TYPE = 'https://clinicbuddy.health/fhir/CodeSystem/appointment-type';
export const CLINICBUDDY_SCHEDULING_EXTENSION = 'https://clinicbuddy.health/fhir/StructureDefinition/scheduling';

export type ClinicLocationKind = 'department' | 'room';

export function buildClinicSubLocation(input: {
  name: string;
  kind: ClinicLocationKind;
  organization: Reference<Organization>;
  parent?: Reference<Location>;
}): Location {
  const name = required(input.name, 'Location name');
  if (!input.organization.reference) {
    throw new Error('A clinic organization is required.');
  }
  if (input.kind === 'room' && !input.parent?.reference) {
    throw new Error('A room requires a parent facility or department.');
  }
  return {
    resourceType: 'Location',
    status: 'active',
    mode: 'instance',
    name,
    type: [{ coding: [{ system: CLINICBUDDY_LOCATION_KIND, code: input.kind }], text: input.kind }],
    physicalType: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
          code: input.kind === 'room' ? 'ro' : 'wa',
          display: input.kind === 'room' ? 'Room' : 'Ward',
        },
      ],
    },
    managingOrganization: input.organization,
    partOf: input.parent,
  };
}

export function buildAppointmentType(input: {
  name: string;
  code: string;
  durationMinutes: number;
  organization: Reference<Organization>;
  locations?: Reference<Location>[];
}): HealthcareService {
  const name = required(input.name, 'Appointment type name');
  const code = required(input.code, 'Appointment type code');
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 5 || input.durationMinutes > 480) {
    throw new Error('Appointment duration must be between 5 and 480 minutes.');
  }
  return {
    resourceType: 'HealthcareService',
    active: true,
    name,
    providedBy: input.organization,
    location: input.locations,
    type: [{ coding: [{ system: CLINICBUDDY_APPOINTMENT_TYPE, code, display: name }], text: name }],
    appointmentRequired: true,
    extension: [
      {
        url: CLINICBUDDY_SCHEDULING_EXTENSION,
        extension: [{ url: 'duration-minutes', valuePositiveInt: input.durationMinutes }],
      },
    ],
  };
}

export function getAppointmentDuration(service: HealthcareService): number | undefined {
  return service.extension
    ?.find((extension) => extension.url === CLINICBUDDY_SCHEDULING_EXTENSION)
    ?.extension?.find((extension) => extension.url === 'duration-minutes')?.valuePositiveInt;
}

function required(value: string, field: string): string {
  const result = value.trim();
  if (!result) {
    throw new Error(`${field} is required.`);
  }
  return result;
}
