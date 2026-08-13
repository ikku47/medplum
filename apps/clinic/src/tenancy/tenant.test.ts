// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Project, ProjectMembership } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import { resolveClinicTenant } from './tenant';

const project: Project = { resourceType: 'Project', id: 'clinic-1', name: 'North Clinic' };
const membership: ProjectMembership = {
  resourceType: 'ProjectMembership',
  id: 'membership-1',
  active: true,
  admin: true,
  project: { reference: 'Project/clinic-1' },
  user: { reference: 'User/user-1' },
  profile: { reference: 'Practitioner/practitioner-1' },
};

describe('resolveClinicTenant', () => {
  test('binds the session to the active Medplum project', () => {
    expect(resolveClinicTenant(project, membership)).toEqual({
      projectId: 'clinic-1',
      projectName: 'North Clinic',
      membershipId: 'membership-1',
      role: 'clinic-admin',
      facilityReferences: [],
    });
  });

  test('rejects a membership from another tenant', () => {
    expect(() =>
      resolveClinicTenant(project, { ...membership, project: { reference: 'Project/another-clinic' } })
    ).toThrow('does not match');
  });

  test('rejects inactive memberships', () => {
    expect(() => resolveClinicTenant(project, { ...membership, active: false })).toThrow('inactive');
  });

  test('allows a server administrator to enter the active project without a project reference', () => {
    expect(resolveClinicTenant(project, { ...membership, admin: true, project: undefined as never })?.projectId).toBe(
      'clinic-1'
    );
  });

  test('rejects a non-admin membership without project scope', () => {
    expect(() => resolveClinicTenant(project, { ...membership, admin: false, project: undefined as never })).toThrow(
      'project-scoped'
    );
  });
});
