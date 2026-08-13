// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { WithId } from '@medplum/core';
import type { Appointment, Bundle, Encounter } from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { describe, expect, test, vi } from 'vitest';
import { beginConsultation } from './consultation';
import { transitionAppointment } from './queue';

const booked: WithId<Appointment> = {
  resourceType: 'Appointment',
  id: 'appointment-1',
  status: 'booked',
  participant: [
    { actor: { reference: 'Patient/patient-1' }, status: 'accepted' },
    { actor: { reference: 'Practitioner/doctor-1' }, status: 'accepted' },
  ],
};

describe('beginConsultation', () => {
  test('atomically starts an Encounter and advances the queue', async () => {
    const medplum = new MockClient();
    medplum.searchOne = vi.fn().mockResolvedValue(undefined);
    const waiting = transitionAppointment(
      transitionAppointment(transitionAppointment(transitionAppointment(booked, 'arrived'), 'checked-in'), 'vitals'),
      'waiting'
    ) as WithId<Appointment>;
    const responseAppointment = transitionAppointment(waiting, 'consultation') as WithId<Appointment>;
    const responseEncounter: WithId<Encounter> = {
      resourceType: 'Encounter',
      id: 'encounter-1',
      status: 'in-progress',
      statusHistory: [],
      classHistory: [],
      class: { code: 'AMB' },
    };
    medplum.executeBatch = vi.fn().mockResolvedValue({
      resourceType: 'Bundle',
      type: 'transaction-response',
      entry: [{ resource: responseAppointment }, { resource: responseEncounter }],
    } satisfies Bundle);

    const result = await beginConsultation(medplum, waiting, '2026-08-12T09:00:00.000Z');

    expect(result.encounter.id).toBe('encounter-1');
    expect(result.appointment.status).toBe('checked-in');
    expect(medplum.executeBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transaction',
        entry: expect.arrayContaining([
          expect.objectContaining({ request: { method: 'POST', url: 'Encounter' } }),
          expect.objectContaining({ request: { method: 'POST', url: 'ClinicalImpression' } }),
        ]),
      })
    );
  });
});
