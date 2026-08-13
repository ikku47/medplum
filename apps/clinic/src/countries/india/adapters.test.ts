// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from 'vitest';
import { DisabledIndiaAbdmAdapter } from './abdm-adapter';
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
});
