// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Project } from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { describe, expect, test } from 'vitest';
import { configurePatientPortalAccess } from './patient-portal';

describe('patient portal tenant setup', () => {
  test('creates the scoped policy and makes it the Patient registration default', async () => {
    const medplum = new MockClient();
    const project = await medplum.createResource<Project>({
      resourceType: 'Project',
      name: 'Aarogya Clinic',
    });

    const result = await configurePatientPortalAccess(medplum, project);

    expect(result.policy.resource?.find((rule) => rule.resourceType === 'Invoice')?.criteria).toBe(
      'Invoice?_compartment=%patient'
    );
    expect(result.project.defaultPatientAccessPolicy?.reference).toBe(`AccessPolicy/${result.policy.id}`);
    expect(
      result.project.defaultAccessPolicies?.find((item) => item.profileType === 'Patient')?.accessPolicy.reference
    ).toBe(`AccessPolicy/${result.policy.id}`);
  });

  test('updates an existing ClinicBuddy policy without duplicating it', async () => {
    const medplum = new MockClient();
    const project = await medplum.createResource<Project>({ resourceType: 'Project', name: 'Clinic' });

    const first = await configurePatientPortalAccess(medplum, project);
    const second = await configurePatientPortalAccess(medplum, first.project);

    expect(second.policy.id).toBe(first.policy.id);
    expect(
      await medplum.searchResources('AccessPolicy', {
        _tag: 'https://clinicbuddy.health/fhir/identifier/access-policy|patient',
      })
    ).toHaveLength(1);
  });
});
