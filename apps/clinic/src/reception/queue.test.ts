// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Appointment } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import {
  CLINICBUDDY_FLOW_EXTENSION,
  getAllowedTargets,
  getAppointmentFlowStage,
  getClinicFlowHistory,
  getStageEnteredAt,
  transitionAppointment,
} from './queue';

const appointment: Appointment = {
  resourceType: 'Appointment',
  id: 'appointment-1',
  status: 'booked',
  participant: [{ actor: { reference: 'Patient/patient-1' }, status: 'accepted' }],
};

describe('ClinicBuddy reception queue', () => {
  test('moves through the full reception workflow', () => {
    const stages = ['arrived', 'checked-in', 'vitals', 'waiting', 'consultation', 'billing', 'completed'] as const;
    let current = appointment;
    for (const stage of stages) {
      current = transitionAppointment(current, stage, '2026-08-12T09:00:00.000Z');
      expect(getAppointmentFlowStage(current)).toBe(stage);
    }
    expect(current.status).toBe('fulfilled');
  });

  test('stores operational stage and entered timestamp in one FHIR extension', () => {
    const updated = transitionAppointment(transitionAppointment(appointment, 'arrived'), 'checked-in');
    expect(updated.extension).toContainEqual(expect.objectContaining({ url: CLINICBUDDY_FLOW_EXTENSION }));
    expect(getStageEnteredAt(updated)).toBeDefined();
  });

  test('supports no-show and left-without-consultation terminal states', () => {
    expect(getAppointmentFlowStage(transitionAppointment(appointment, 'no-show'))).toBe('no-show');
    const checkedIn = transitionAppointment(transitionAppointment(appointment, 'arrived'), 'checked-in');
    const left = transitionAppointment(checkedIn, 'left-without-consultation');
    expect(left.status).toBe('cancelled');
    expect(getAppointmentFlowStage(left)).toBe('left-without-consultation');
  });

  test('rejects skipped clinical stages', () => {
    expect(() => transitionAppointment(appointment, 'consultation')).toThrow('Cannot move');
    expect(getAllowedTargets('scheduled')).toEqual(['arrived', 'no-show', 'cancelled']);
  });

  test('retains transition history for operational waiting-time reports', () => {
    let current = appointment;
    current = transitionAppointment(current, 'arrived', '2026-08-12T09:00:00.000Z');
    current = transitionAppointment(current, 'checked-in', '2026-08-12T09:05:00.000Z');
    current = transitionAppointment(current, 'vitals', '2026-08-12T09:10:00.000Z');
    current = transitionAppointment(current, 'waiting', '2026-08-12T09:15:00.000Z');
    current = transitionAppointment(current, 'consultation', '2026-08-12T09:30:00.000Z');
    expect(getClinicFlowHistory(current)).toEqual([
      { stage: 'arrived', enteredAt: '2026-08-12T09:00:00.000Z' },
      { stage: 'checked-in', enteredAt: '2026-08-12T09:05:00.000Z' },
      { stage: 'vitals', enteredAt: '2026-08-12T09:10:00.000Z' },
      { stage: 'waiting', enteredAt: '2026-08-12T09:15:00.000Z' },
      { stage: 'consultation', enteredAt: '2026-08-12T09:30:00.000Z' },
    ]);
  });
});
