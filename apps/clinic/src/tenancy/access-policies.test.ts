// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { ProjectMembership } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import { applyClinicBuddyMembershipAccess, buildClinicBuddyAccessPolicy } from './access-policies';

describe('ClinicBuddy access policies', () => {
  test('gives reception appointment writes without clinical note writes', () => {
    const policy = buildClinicBuddyAccessPolicy('receptionist');
    expect(policy.resource?.find((rule) => rule.resourceType === 'Appointment')?.interaction).toContain('update');
    expect(policy.resource?.find((rule) => rule.resourceType === 'ClinicalImpression')).toBeUndefined();
  });

  test('gives doctors clinical writes without billing management', () => {
    const policy = buildClinicBuddyAccessPolicy('doctor');
    expect(policy.resource?.find((rule) => rule.resourceType === 'ClinicalImpression')?.interaction).toContain(
      'create'
    );
    expect(policy.resource?.find((rule) => rule.resourceType === 'PaymentReconciliation')).toBeUndefined();
  });

  test('applies role, policy, and deduplicated facility scope to a membership', () => {
    const membership: ProjectMembership = {
      resourceType: 'ProjectMembership',
      project: { reference: 'Project/clinic-1' },
      user: { reference: 'User/u1' },
      profile: { reference: 'Practitioner/p1' },
    };
    const result = applyClinicBuddyMembershipAccess(membership, 'nurse', { reference: 'AccessPolicy/nurse' }, [
      'Location/a',
      'Location/a',
      'Location/b',
    ]);
    expect(result.admin).toBe(false);
    expect(result.access?.[0]?.parameter).toHaveLength(2);
    expect(result.identifier).toContainEqual({
      system: 'https://clinicbuddy.health/fhir/identifier/staff-role',
      value: 'nurse',
    });
  });

  test('preserves an inactive membership while changing its role', () => {
    const membership: ProjectMembership = {
      resourceType: 'ProjectMembership',
      project: { reference: 'Project/clinic-1' },
      user: { reference: 'User/u1' },
      profile: { reference: 'Practitioner/p1' },
      active: false,
    };
    expect(
      applyClinicBuddyMembershipAccess(membership, 'doctor', { reference: 'AccessPolicy/doctor' }, []).active
    ).toBe(false);
  });
});
