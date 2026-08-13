// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { MedplumClient, WithId } from '@medplum/core';
import { createReference } from '@medplum/core';
import type { AccessPolicy, Project } from '@medplum/fhirtypes';
import { buildClinicBuddyPatientAccessPolicy, CLINICBUDDY_ACCESS_POLICY_IDENTIFIER } from './access-policies';

export async function configurePatientPortalAccess(
  medplum: MedplumClient,
  project: WithId<Project>
): Promise<{ policy: WithId<AccessPolicy>; project: WithId<Project> }> {
  const existing = await medplum.searchOne('AccessPolicy', {
    _tag: `${CLINICBUDDY_ACCESS_POLICY_IDENTIFIER}|patient`,
  });
  const desired = buildClinicBuddyPatientAccessPolicy();
  const policy = existing?.id
    ? await medplum.updateResource({ ...desired, id: existing.id, meta: { ...existing.meta, ...desired.meta } })
    : await medplum.createResource(desired);
  const accessPolicy = createReference(policy);
  const defaultAccessPolicies = [
    ...(project.defaultAccessPolicies?.filter((item) => item.profileType !== 'Patient') ?? []),
    { profileType: 'Patient' as const, accessPolicy },
  ];
  const updatedProject = await medplum.updateResource({
    ...project,
    defaultPatientAccessPolicy: accessPolicy,
    defaultAccessPolicies,
  });
  return { policy, project: updatedProject };
}
