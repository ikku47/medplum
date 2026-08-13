// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Appointment } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import { transitionAppointment } from '../reception/queue';
import { buildClinicalReport, buildOperationalReport } from './analytics';

function completedAppointment(): Appointment {
  let appointment: Appointment = {
    resourceType: 'Appointment',
    status: 'booked',
    participant: [
      { actor: { reference: 'Patient/p1' }, status: 'accepted' },
      { actor: { reference: 'Practitioner/d1', display: 'Dr Rao' }, status: 'accepted' },
    ],
  };
  appointment = transitionAppointment(appointment, 'arrived', '2026-08-12T09:00:00Z');
  appointment = transitionAppointment(appointment, 'checked-in', '2026-08-12T09:05:00Z');
  appointment = transitionAppointment(appointment, 'vitals', '2026-08-12T09:10:00Z');
  appointment = transitionAppointment(appointment, 'waiting', '2026-08-12T09:15:00Z');
  appointment = transitionAppointment(appointment, 'consultation', '2026-08-12T09:25:00Z');
  appointment = transitionAppointment(appointment, 'billing', '2026-08-12T09:45:00Z');
  return transitionAppointment(appointment, 'completed', '2026-08-12T09:50:00Z');
}

describe('ClinicBuddy reports', () => {
  test('calculates operational completion, no-show, patient, provider, and wait metrics', () => {
    const noShow: Appointment = {
      resourceType: 'Appointment',
      status: 'noshow',
      participant: [{ actor: { reference: 'Patient/p2' }, status: 'accepted' }],
    };
    const report = buildOperationalReport([completedAppointment(), noShow]);
    expect(report.patientVolume).toBe(2);
    expect(report.completed).toBe(1);
    expect(report.noShowRate).toBe(50);
    expect(report.averageWaitMinutes).toBe(20);
    expect(report.providers[0]).toEqual({ label: 'Dr Rao', count: 1 });
  });

  test('groups clinical activity and order categories', () => {
    const report = buildClinicalReport({
      conditions: [
        { resourceType: 'Condition', subject: { reference: 'Patient/p1' }, code: { text: 'Hypertension' } },
        { resourceType: 'Condition', subject: { reference: 'Patient/p2' }, code: { text: 'Hypertension' } },
      ],
      procedures: [
        { resourceType: 'Procedure', status: 'completed', subject: { reference: 'Patient/p1' }, code: { text: 'ECG' } },
      ],
      medications: [
        {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/p1' },
          medicationCodeableConcept: { text: 'Amlodipine' },
        },
      ],
      orders: [
        {
          resourceType: 'ServiceRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/p1' },
          category: [{ text: 'Laboratory' }],
        },
      ],
    });
    expect(report.diagnoses[0]).toEqual({ label: 'Hypertension', count: 2 });
    expect(report.labOrders).toBe(1);
    expect(report.medications[0].label).toBe('Amlodipine');
  });
});
