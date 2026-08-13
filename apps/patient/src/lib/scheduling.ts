// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { MedplumClient, WithId } from '@medplum/core';
import { createReference, getReferenceString, isDefined, isResource } from '@medplum/core';
import type { Appointment, Bundle, HealthcareService, Patient, Schedule, Slot } from '@medplum/fhirtypes';

export interface PortalSchedulingOption {
  service: WithId<HealthcareService>;
  schedule: WithId<Schedule>;
}

export async function findAvailableAppointments(
  medplum: MedplumClient,
  option: PortalSchedulingOption,
  start: Date,
  end: Date,
  count = 30
): Promise<Appointment[]> {
  if (start >= end) {
    throw new Error('Appointment search start must be before its end.');
  }
  const url = medplum.fhirUrl('Appointment', '$find');
  url.searchParams.set('start', start.toISOString());
  url.searchParams.set('end', end.toISOString());
  url.searchParams.set('service-type-reference', getReferenceString(option.service));
  url.searchParams.set('schedule', getReferenceString(option.schedule));
  url.searchParams.set('_count', String(count));
  const result = await medplum.get<Bundle<Appointment>>(url);
  return result.entry?.map((entry) => entry.resource).filter(isDefined) ?? [];
}

export function preparePatientBooking(proposed: Appointment, patient: Patient & { id: string }): Appointment {
  if (!proposed.start || !proposed.end || proposed.status !== 'proposed') {
    throw new Error('The selected appointment is no longer bookable.');
  }
  return {
    ...proposed,
    participant: [
      ...proposed.participant.filter((participant) => participant.actor?.reference !== `Patient/${patient.id}`),
      { actor: createReference(patient), status: 'accepted', required: 'required' },
    ],
  };
}

export async function bookPatientAppointment(
  medplum: MedplumClient,
  proposed: Appointment,
  patient: Patient & { id: string }
): Promise<WithId<Appointment>> {
  const result = await medplum.post<Bundle<WithId<Appointment> | WithId<Slot>>>(
    medplum.fhirUrl('Appointment', '$book'),
    {
      resourceType: 'Parameters',
      parameter: [{ name: 'appointment', resource: preparePatientBooking(proposed, patient) }],
    }
  );
  const appointment = result.entry
    ?.map((entry) => entry.resource)
    .filter(isDefined)
    .find((resource): resource is WithId<Appointment> => isResource(resource, 'Appointment'));
  if (!appointment) {
    throw new Error('Booking succeeded without returning an appointment.');
  }
  return appointment;
}

export function cancelPatientAppointment(appointment: WithId<Appointment>): WithId<Appointment> {
  if (!['booked', 'pending', 'proposed'].includes(appointment.status)) {
    throw new Error('Only an upcoming appointment can be cancelled.');
  }
  return { ...appointment, status: 'cancelled' };
}
