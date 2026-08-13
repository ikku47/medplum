// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from 'vitest';
import { buildClinicalOrder, CLINICBUDDY_ORDER_CATEGORY_SYSTEM } from './orders';

describe('clinical order builder', () => {
  test('creates an encounter-linked imaging ServiceRequest', () => {
    const order = buildClinicalOrder({
      input: {
        type: 'imaging',
        requestedService: 'Chest X-ray PA and lateral',
        priority: 'urgent',
        reason: 'Persistent cough',
        instructions: 'Rule out pneumonia',
        requestedDate: '2026-08-13',
      },
      patient: { reference: 'Patient/patient-1' },
      requester: { reference: 'Practitioner/doctor-1' },
      encounter: 'Encounter/encounter-1',
      authoredOn: '2026-08-12T10:00:00.000Z',
    });

    expect(order).toMatchObject({
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      priority: 'urgent',
      code: { text: 'Chest X-ray PA and lateral' },
      subject: { reference: 'Patient/patient-1' },
      encounter: { reference: 'Encounter/encounter-1' },
      category: [{ coding: [{ system: CLINICBUDDY_ORDER_CATEGORY_SYSTEM, code: 'imaging' }] }],
    });
  });

  test('rejects a blank requested service', () => {
    expect(() =>
      buildClinicalOrder({
        input: { type: 'referral', requestedService: ' ', priority: 'routine' },
        patient: { reference: 'Patient/patient-1' },
        requester: { reference: 'Practitioner/doctor-1' },
      })
    ).toThrow('Requested service is required.');
  });
});
