// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Patient } from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { describe, expect, test, vi } from 'vitest';
import {
  ABHA_NUMBER_SYSTEM,
  createIndiaPatientIdentifiers,
  findDuplicatePatients,
  normalizeAbhaNumber,
  normalizeIndiaMobile,
} from './patient';

describe('India patient identity', () => {
  test('normalizes Indian mobile numbers', () => {
    expect(normalizeIndiaMobile('98765 43210')).toBe('+919876543210');
    expect(normalizeIndiaMobile('+91 98765-43210')).toBe('+919876543210');
    expect(() => normalizeIndiaMobile('12345')).toThrow('valid 10-digit');
  });

  test('validates and formats a 14 digit ABHA number', () => {
    expect(normalizeAbhaNumber('12 3456 7890 1234')).toBe('12-3456-7890-1234');
    expect(() => normalizeAbhaNumber('1234')).toThrow('14 digits');
  });

  test('creates tenant-specific MRN and optional ABHA identifiers', () => {
    const identifiers = createIndiaPatientIdentifiers(
      'clinic-1',
      '12345678901234',
      '12345678-1234-1234-1234-123456789012'
    );
    expect(identifiers[0]).toMatchObject({
      system: 'https://clinicbuddy.health/fhir/identifier/mrn/clinic-1',
      value: 'CB-1234567812',
    });
    expect(identifiers[1]).toMatchObject({ system: ABHA_NUMBER_SYSTEM, value: '12-3456-7890-1234' });
  });

  test('finds an exact demographic duplicate', async () => {
    const medplum = new MockClient();
    const existing: Patient = {
      resourceType: 'Patient',
      id: 'patient-1',
      name: [{ given: ['Asha'], family: 'Sharma' }],
      birthDate: '1990-01-01',
      telecom: [{ system: 'phone', value: '+919876543210' }],
    };
    medplum.searchResources = vi.fn().mockResolvedValue([existing]);

    await expect(findDuplicatePatients(medplum, { ...existing, id: undefined })).resolves.toEqual([existing]);
  });
});
