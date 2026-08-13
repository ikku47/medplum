// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Organization, Project } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import {
  buildClinicFacility,
  buildClinicOrganization,
  CLINICBUDDY_FACILITY_IDENTIFIER_SYSTEM,
  CLINICBUDDY_TENANT_IDENTIFIER_SYSTEM,
} from './resources';

const project: Project = { resourceType: 'Project', id: 'clinic-1', name: 'North Clinic' };

describe('ClinicBuddy tenant resources', () => {
  test('builds an India healthcare organization scoped to the tenant project', () => {
    const organization = buildClinicOrganization(project, {
      name: ' North Clinic ',
      phone: ' +91 98765 43210 ',
      email: ' admin@north.example ',
    });

    expect(organization.name).toBe('North Clinic');
    expect(organization.identifier).toContainEqual({
      system: CLINICBUDDY_TENANT_IDENTIFIER_SYSTEM,
      value: 'clinic-1',
    });
    expect(organization.telecom).toHaveLength(2);
  });

  test('builds a facility managed by the tenant organization', () => {
    const organization: Organization = {
      resourceType: 'Organization',
      id: 'organization-1',
      name: 'North Clinic',
    };
    const facility = buildClinicFacility(project, organization, {
      name: ' Bengaluru Centre ',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
    });

    expect(facility.name).toBe('Bengaluru Centre');
    expect(facility.address?.country).toBe('IN');
    expect(facility.managingOrganization?.reference).toBe('Organization/organization-1');
    expect(facility.identifier).toContainEqual({
      system: CLINICBUDDY_FACILITY_IDENTIFIER_SYSTEM,
      value: 'clinic-1:primary',
    });
  });

  test('requires persisted tenant resources', () => {
    expect(() => buildClinicOrganization({ resourceType: 'Project' }, { name: 'Clinic' })).toThrow('persisted project');
  });
});
