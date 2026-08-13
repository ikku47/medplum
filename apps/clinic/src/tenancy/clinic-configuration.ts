// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { SchedulingParametersURI, schedulingDurationToMinutes } from '@medplum/core';
import type { Extension, HealthcareService, Location, Organization, Reference } from '@medplum/fhirtypes';

export const CLINICBUDDY_LOCATION_KIND = 'https://clinicbuddy.health/fhir/CodeSystem/location-kind';
export const CLINICBUDDY_APPOINTMENT_TYPE = 'https://clinicbuddy.health/fhir/CodeSystem/appointment-type';

export const INDIA_CLINIC_TIMEZONE = 'Asia/Kolkata';

const DEFAULT_CLINIC_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

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
  workingHours?: { daysOfWeek: readonly string[]; start: string; end: string };
}): HealthcareService {
  const name = required(input.name, 'Appointment type name');
  const code = required(input.code, 'Appointment type code');
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 5 || input.durationMinutes > 480) {
    throw new Error('Appointment duration must be between 5 and 480 minutes.');
  }
  const workingHours = input.workingHours ?? {
    daysOfWeek: DEFAULT_CLINIC_DAYS,
    start: '09:00:00',
    end: '18:00:00',
  };
  if (workingHours.daysOfWeek.length === 0 || workingHours.start >= workingHours.end) {
    throw new Error('Appointment type working hours are invalid.');
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
        url: SchedulingParametersURI,
        extension: [
          { url: 'duration', valueDuration: { value: input.durationMinutes, unit: 'min' } },
          { url: 'alignmentInterval', valueDuration: { value: input.durationMinutes, unit: 'min' } },
          { url: 'timezone', valueCode: INDIA_CLINIC_TIMEZONE },
          {
            url: 'availability',
            extension: [
              {
                url: 'availableTime',
                extension: [
                  ...workingHours.daysOfWeek.map((day) => ({ url: 'daysOfWeek', valueCode: day })),
                  { url: 'availableStartTime', valueTime: workingHours.start },
                  { url: 'availableEndTime', valueTime: workingHours.end },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

export function getAppointmentDuration(service: HealthcareService): number | undefined {
  const parameters = getSchedulingParameters(service);
  return schedulingDurationToMinutes(parameters?.extension?.find((extension) => extension.url === 'duration')?.valueDuration);
}

export function getAppointmentWorkingHours(service: HealthcareService): string | undefined {
  const availableTime = getSchedulingParameters(service)
    ?.extension?.find((extension) => extension.url === 'availability')
    ?.extension?.find((extension) => extension.url === 'availableTime');
  const days = availableTime?.extension
    ?.filter((extension) => extension.url === 'daysOfWeek')
    .map((extension) => extension.valueCode)
    .filter((day): day is string => !!day);
  const start = availableTime?.extension?.find((extension) => extension.url === 'availableStartTime')?.valueTime;
  const end = availableTime?.extension?.find((extension) => extension.url === 'availableEndTime')?.valueTime;
  if (!days?.length || !start || !end) {
    return undefined;
  }
  return `${days.join(', ')} ${start.slice(0, 5)}-${end.slice(0, 5)}`;
}

function getSchedulingParameters(service: HealthcareService): Extension | undefined {
  return service.extension?.find((extension) => extension.url === SchedulingParametersURI);
}

function required(value: string, field: string): string {
  const result = value.trim();
  if (!result) {
    throw new Error(`${field} is required.`);
  }
  return result;
}
