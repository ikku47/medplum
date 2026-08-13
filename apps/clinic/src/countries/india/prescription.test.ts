// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from 'vitest';
import { buildIndiaMedicationRequest, getMedicationRequestDisplay } from './prescription';

describe('India prescription', () => {
  test('builds a local printable MedicationRequest with complete directions', () => {
    const request = buildIndiaMedicationRequest({
      input: {
        medication: 'Paracetamol 500 mg tablet',
        dose: '1 tablet',
        route: 'Oral',
        frequency: 'Twice daily after food',
        durationDays: 5,
        quantity: 10,
        quantityUnit: 'tablets',
        refills: 0,
        instructions: 'Stop and seek advice if rash develops.',
      },
      patient: { reference: 'Patient/patient-1' },
      requester: { reference: 'Practitioner/doctor-1' },
      encounter: { reference: 'Encounter/encounter-1' },
      authoredOn: '2026-08-12T10:00:00.000Z',
    });

    expect(request).toMatchObject({
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: { text: 'Paracetamol 500 mg tablet' },
      dosageInstruction: [{ route: { text: 'Oral' }, patientInstruction: 'Stop and seek advice if rash develops.' }],
      dispenseRequest: { quantity: { value: 10, unit: 'tablets' }, numberOfRepeatsAllowed: 0 },
    });
    expect(getMedicationRequestDisplay(request)).toBe('Paracetamol 500 mg tablet');
  });

  test('validates required directions and positive quantities', () => {
    expect(() =>
      buildIndiaMedicationRequest({
        input: {
          medication: '',
          dose: '',
          route: '',
          frequency: '',
          durationDays: 0,
          quantity: 0,
          quantityUnit: '',
          refills: -1,
          instructions: '',
        },
        patient: { reference: 'Patient/patient-1' },
        requester: { reference: 'Practitioner/doctor-1' },
      })
    ).toThrow();
  });
});
