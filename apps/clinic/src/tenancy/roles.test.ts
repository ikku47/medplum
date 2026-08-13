// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { ProjectMembership } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import {
  CLINICBUDDY_FACILITY_ACCESS_PARAMETER,
  CLINICBUDDY_ROLE_IDENTIFIER_SYSTEM,
  getAssignedFacilityReferences,
  getClinicBuddyRole,
  hasClinicBuddyPermission,
} from './roles';

function membership(overrides: Partial<ProjectMembership> = {}): ProjectMembership {
  return {
    resourceType: 'ProjectMembership',
    id: 'membership-1',
    project: { reference: 'Project/clinic-1' },
    user: { reference: 'User/user-1' },
    profile: { reference: 'Practitioner/practitioner-1' },
    ...overrides,
  };
}

describe('ClinicBuddy roles', () => {
  test('uses an explicitly configured staff role', () => {
    expect(
      getClinicBuddyRole(
        membership({ identifier: [{ system: CLINICBUDDY_ROLE_IDENTIFIER_SYSTEM, value: 'receptionist' }] })
      )
    ).toBe('receptionist');
  });

  test('maps legacy project administrators to clinic administrators', () => {
    expect(getClinicBuddyRole(membership({ admin: true }))).toBe('clinic-admin');
  });

  test('maps a legacy administrator without a profile safely', () => {
    expect(getClinicBuddyRole(membership({ admin: true, profile: undefined as never }))).toBe('clinic-admin');
  });

  test('applies least-privilege role permissions', () => {
    expect(hasClinicBuddyPermission('receptionist', 'Appointment.Manage')).toBe(true);
    expect(hasClinicBuddyPermission('receptionist', 'Encounter.Sign')).toBe(false);
    expect(hasClinicBuddyPermission('billing-staff', 'Report.Financial')).toBe(true);
  });

  test('reads facility scope parameters from membership access entries', () => {
    expect(
      getAssignedFacilityReferences(
        membership({
          access: [
            {
              policy: { reference: 'AccessPolicy/clinic-staff' },
              parameter: [
                {
                  name: CLINICBUDDY_FACILITY_ACCESS_PARAMETER,
                  valueReference: { reference: 'Location/facility-1' },
                },
              ],
            },
          ],
        })
      )
    ).toEqual(['Location/facility-1']);
  });
});
