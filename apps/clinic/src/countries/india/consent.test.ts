// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { WithId } from '@medplum/core';
import type { Patient } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import { buildAbdmConsent, isValidAbdmConsent, revokeAbdmConsent } from './consent';

const patient: WithId<Patient> = { resourceType: 'Patient', id: 'patient-1' };

describe('India ABDM consent', () => {
  test('builds a verified, time-bounded FHIR Consent', () => {
    const consent = buildAbdmConsent({
      patient,
      purposes: ['care-management', 'health-information-exchange'],
      start: '2026-01-01',
      end: '2027-01-01',
      now: '2026-01-01T08:00:00.000Z',
    });
    expect(consent.patient?.reference).toBe('Patient/patient-1');
    expect(consent.verification?.[0]?.verified).toBe(true);
    expect(isValidAbdmConsent(consent, patient, new Date('2026-06-01T00:00:00.000Z'))).toBe(true);
  });

  test('rejects missing purpose and invalid date ranges', () => {
    expect(() => buildAbdmConsent({ patient, purposes: [], start: '2026-01-01', end: '2027-01-01' })).toThrow(
      'purpose'
    );
    expect(() =>
      buildAbdmConsent({
        patient,
        purposes: ['health-information-exchange'],
        start: '2027-01-01',
        end: '2026-01-01',
      })
    ).toThrow('after');
  });

  test('fails closed when expired, revoked, unverified, or for another patient', () => {
    const consent = buildAbdmConsent({
      patient,
      purposes: ['health-information-exchange'],
      start: '2026-01-01',
      end: '2027-01-01',
    });
    const saved = { ...consent, id: 'consent-1' };
    expect(isValidAbdmConsent(saved, patient, new Date('2027-01-01T00:00:00.000Z'))).toBe(false);
    expect(isValidAbdmConsent(revokeAbdmConsent(saved), patient, new Date('2026-06-01T00:00:00.000Z'))).toBe(false);
    expect(isValidAbdmConsent({ ...saved, verification: [{ verified: false }] }, patient)).toBe(false);
    expect(isValidAbdmConsent(saved, { ...patient, id: 'patient-2' }, new Date('2026-06-01T00:00:00.000Z'))).toBe(
      false
    );
  });
});
