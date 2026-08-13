// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { MedplumClient, WithId } from '@medplum/core';
import { getReferenceString, isReference } from '@medplum/core';
import type {
  Appointment,
  Bundle,
  ClinicalImpression,
  Encounter,
  Patient,
  Practitioner,
  Resource,
} from '@medplum/fhirtypes';
import { transitionAppointment } from './queue';

export interface ConsultationStartResult {
  appointment: WithId<Appointment>;
  encounter: WithId<Encounter>;
}

export async function beginConsultation(
  medplum: MedplumClient,
  appointment: WithId<Appointment>,
  startedAt: string = new Date().toISOString()
): Promise<ConsultationStartResult> {
  const patient = appointment.participant
    .map((item) => item.actor)
    .find((actor) => isReference<Patient>(actor, 'Patient'));
  const practitioner = appointment.participant
    .map((item) => item.actor)
    .find((actor) => isReference<Practitioner>(actor, 'Practitioner'));
  if (!patient || !practitioner) {
    throw new Error('A patient and practitioner are required to begin consultation.');
  }

  const currentEncounter = await medplum.searchOne('Encounter', { appointment: getReferenceString(appointment) });
  const updatedAppointment = transitionAppointment(appointment, 'consultation', startedAt);
  const encounterFullUrl = currentEncounter?.id ? undefined : `urn:uuid:${crypto.randomUUID()}`;
  const encounter: Encounter = currentEncounter
    ? {
        ...currentEncounter,
        status: 'in-progress',
        period: { ...currentEncounter.period, start: currentEncounter.period?.start ?? startedAt },
      }
    : {
        resourceType: 'Encounter',
        status: 'in-progress',
        statusHistory: [],
        classHistory: [],
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'AMB',
          display: 'ambulatory',
        },
        subject: patient,
        appointment: [{ reference: `Appointment/${appointment.id}` }],
        participant: [{ individual: practitioner }],
        period: { start: startedAt },
      };

  const clinicalImpression: ClinicalImpression | undefined = encounterFullUrl
    ? {
        resourceType: 'ClinicalImpression',
        status: 'in-progress',
        subject: patient,
        encounter: { reference: encounterFullUrl },
        date: startedAt,
        description: 'Clinic consultation',
      }
    : undefined;
  const transaction: Bundle<Appointment | Encounter | ClinicalImpression> = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      {
        resource: updatedAppointment,
        request: { method: 'PUT', url: `Appointment/${appointment.id}` },
      },
      {
        fullUrl: encounterFullUrl,
        resource: encounter,
        request: currentEncounter?.id
          ? { method: 'PUT', url: `Encounter/${currentEncounter.id}` }
          : { method: 'POST', url: 'Encounter' },
      },
      ...(clinicalImpression
        ? [{ resource: clinicalImpression, request: { method: 'POST' as const, url: 'ClinicalImpression' } }]
        : []),
    ],
  };

  const result = await medplum.executeBatch(transaction);
  const savedAppointment = result.entry?.find((entry) => entry.resource?.resourceType === 'Appointment')?.resource;
  const savedEncounter = result.entry?.find((entry) => entry.resource?.resourceType === 'Encounter')?.resource;

  const finalAppointment =
    savedAppointment?.resourceType === 'Appointment' && savedAppointment.id
      ? requireResourceId(savedAppointment, 'Consultation started without returning an Appointment.')
      : await medplum.readResource('Appointment', appointment.id);
  let finalEncounter: WithId<Encounter>;
  if (savedEncounter?.resourceType === 'Encounter' && savedEncounter.id) {
    finalEncounter = requireResourceId(savedEncounter, 'Consultation started without returning an Encounter.');
  } else if (currentEncounter?.id) {
    finalEncounter = await medplum.readResource('Encounter', currentEncounter.id);
  } else {
    finalEncounter = await findCreatedEncounter(medplum, appointment);
  }

  return { appointment: finalAppointment, encounter: finalEncounter };
}

async function findCreatedEncounter(
  medplum: MedplumClient,
  appointment: WithId<Appointment>
): Promise<WithId<Encounter>> {
  const encounter = await medplum.searchOne('Encounter', { appointment: getReferenceString(appointment) });
  if (!encounter?.id) {
    throw new Error('Consultation started without returning an Encounter.');
  }
  return requireResourceId(encounter, 'Consultation started without returning an Encounter.');
}

function requireResourceId<T extends Resource>(resource: T, errorMessage: string): WithId<T> {
  if (!resource.id) {
    throw new Error(errorMessage);
  }
  return { ...resource, id: resource.id };
}
