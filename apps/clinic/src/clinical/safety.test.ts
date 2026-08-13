// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { AllergyIntolerance } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import { getAllergyDisplay, getAllergySeverity, isActiveConfirmedAllergy } from './safety';

const allergy: AllergyIntolerance = {
  resourceType: 'AllergyIntolerance',
  patient: { reference: 'Patient/patient-1' },
  code: { coding: [{ system: 'http://snomed.info/sct', code: '91936005', display: 'Penicillin' }] },
  clinicalStatus: {
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }],
  },
  verificationStatus: {
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }],
  },
  reaction: [
    { manifestation: [{ text: 'Rash' }], severity: 'moderate' },
    { manifestation: [{ text: 'Breathing difficulty' }], severity: 'severe' },
  ],
};

describe('clinical safety', () => {
  test('identifies active confirmed allergies and their highest severity', () => {
    expect(isActiveConfirmedAllergy(allergy)).toBe(true);
    expect(getAllergySeverity(allergy)).toBe('severe');
    expect(getAllergyDisplay(allergy)).toBe('Penicillin');
  });

  test('excludes resolved and refuted allergies', () => {
    expect(
      isActiveConfirmedAllergy({
        ...allergy,
        clinicalStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'resolved' }],
        },
      })
    ).toBe(false);
    expect(
      isActiveConfirmedAllergy({
        ...allergy,
        verificationStatus: {
          coding: [
            { system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'refuted' },
          ],
        },
      })
    ).toBe(false);
  });
});
