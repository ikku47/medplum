// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Project, ProjectMembership } from '@medplum/fhirtypes';
import type { ClinicBuddyRole } from './roles';
import { getAssignedFacilityReferences, getClinicBuddyRole } from './roles';

export interface ClinicTenantContext {
  projectId: string;
  projectName: string;
  membershipId: string;
  role: ClinicBuddyRole;
  facilityReferences: string[];
}

export function resolveClinicTenant(
  project: Project | undefined,
  membership: ProjectMembership | undefined
): ClinicTenantContext | undefined {
  if (!project && !membership) {
    return undefined;
  }

  if (!project?.id || !membership?.id) {
    throw new Error('ClinicBuddy requires an authenticated project and project membership.');
  }

  if (membership.active === false) {
    throw new Error('Your ClinicBuddy membership is inactive.');
  }

  const membershipProject = membership.project?.reference;
  if (!membershipProject && !membership.admin) {
    throw new Error('ClinicBuddy requires a project-scoped membership.');
  }

  if (membershipProject && membershipProject !== `Project/${project.id}`) {
    throw new Error('The active project does not match your ClinicBuddy membership.');
  }

  return {
    projectId: project.id,
    projectName: project.name || 'ClinicBuddy clinic',
    membershipId: membership.id,
    role: getClinicBuddyRole(membership),
    facilityReferences: getAssignedFacilityReferences(membership),
  };
}
