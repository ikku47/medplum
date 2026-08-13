// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { WithId } from '@medplum/core';
import type { Appointment, Patient, Reference } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import { buildVitalSignObservations } from './vitals';

const patient: Reference<Patient> = { reference: 'Patient/patient-1' };
const appointment: WithId<Appointment> = {
  resourceType: 'Appointment',
  id: 'appointment-1',
  status: 'checked-in',
  participant: [{ actor: patient, status: 'accepted' }],
};

describe('reception vitals', () => {
  test('creates standard vital-sign Observations and calculated BMI', () => {
    const observations = buildVitalSignObservations(
      patient,
      appointment,
      { heightCm: 170, weightKg: 68, systolic: 120, diastolic: 80, pulse: 72, oxygenSaturation: 98 },
      '2026-08-12T09:00:00.000Z'
    );
    const codes = observations.map((observation) => observation.code.coding?.[0]?.code);
    expect(codes).toEqual(expect.arrayContaining(['8302-2', '29463-7', '85354-9', '8867-4', '2708-6', '39156-5']));
    expect(observations.every((observation) => observation.status === 'final')).toBe(true);
    expect(observations.every((observation) => observation.category?.[0]?.coding?.[0]?.code === 'vital-signs')).toBe(
      true
    );
  });

  test('requires at least one measurement and validates safe ranges', () => {
    expect(() => buildVitalSignObservations(patient, appointment, {})).toThrow('at least one');
    expect(() => buildVitalSignObservations(patient, appointment, { oxygenSaturation: 120 })).toThrow(
      'Oxygen saturation'
    );
  });
});
