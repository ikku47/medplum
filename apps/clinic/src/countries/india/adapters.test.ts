// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from 'vitest';
import type { Consent, Patient } from '@medplum/fhirtypes';
import { DisabledIndiaAbdmAdapter, requireValidAbdmExchangeContext } from './abdm-adapter';
import { buildAbdmConsent } from './consent';
import { DisabledIndiaNhcxAdapter } from './nhcx-adapter';

describe('India external adapters', () => {
  test('ABDM is fail-closed until explicitly configured', async () => {
    const adapter = new DisabledIndiaAbdmAdapter();
    expect(adapter.enabled).toBe(false);
    await expect(adapter.lookupAbha('patient@abdm')).rejects.toThrow('disabled');
  });

  test('NHCX is fail-closed until explicitly configured', async () => {
    const adapter = new DisabledIndiaNhcxAdapter();
    expect(adapter.enabled).toBe(false);
    await expect(adapter.getClaimStatus('claim-1')).rejects.toThrow('disabled');
  });

  test('ABDM exchange guard rejects missing or expired patient consent', () => {
    const patient: Patient & { id: string } = { resourceType: 'Patient', id: 'patient-1' };
    const consent = {
      ...buildAbdmConsent({
        patient,
        purposes: ['health-information-exchange'],
        start: '2026-01-01',
        end: '2027-01-01',
      }),
      id: 'consent-1',
    } satisfies Consent & { id: string };
    expect(() =>
      requireValidAbdmExchangeContext({ tenantId: 'clinic-1', patient, consent }, new Date('2026-06-01'))
    ).not.toThrow();
    expect(() =>
      requireValidAbdmExchangeContext({ tenantId: 'clinic-1', patient, consent }, new Date('2027-06-01'))
    ).toThrow('consent');
  });
});
