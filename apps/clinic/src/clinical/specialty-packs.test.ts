// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { MockClient } from '@medplum/mock';
import { describe, expect, test } from 'vitest';
import { buildGeneralPracticePack, installGeneralPracticePack } from './specialty-packs';

const organization = { resourceType: 'Organization' as const, id: 'clinic-1', name: 'Example Clinic' };

describe('specialty packs', () => {
  test('builds the General Practice pack across clinical, scheduling, and billing resources', () => {
    const resources = buildGeneralPracticePack(organization).map((artifact) => artifact.resource);
    expect(resources.filter((resource) => resource.resourceType === 'Questionnaire')).toHaveLength(3);
    expect(resources.filter((resource) => resource.resourceType === 'PlanDefinition')).toHaveLength(2);
    expect(resources.filter((resource) => resource.resourceType === 'HealthcareService')).toHaveLength(3);
    expect(resources.filter((resource) => resource.resourceType === 'ChargeItemDefinition')).toHaveLength(3);
    expect(resources.every((resource) => resource.meta?.tag?.some((tag) => tag.code === 'general-practice'))).toBe(
      true
    );
  });

  test('installs idempotently without overwriting clinic-owned artifacts', async () => {
    const medplum = new MockClient();
    const first = await installGeneralPracticePack(medplum, organization);
    const second = await installGeneralPracticePack(medplum, organization);
    expect(first).toEqual({ created: 11, existing: 0, total: 11 });
    expect(second).toEqual({ created: 0, existing: 11, total: 11 });
  });
});
