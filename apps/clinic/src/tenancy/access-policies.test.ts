// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { ProjectMembership } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import {
  applyClinicBuddyMembershipAccess,
  buildClinicBuddyAccessPolicy,
  buildClinicBuddyPatientAccessPolicy,
} from './access-policies';

describe('ClinicBuddy access policies', () => {
  test('gives reception appointment writes without clinical note writes', () => {
    const policy = buildClinicBuddyAccessPolicy('receptionist');
    expect(policy.resource?.find((rule) => rule.resourceType === 'Appointment')?.interaction).toContain('update');
    expect(policy.resource?.find((rule) => rule.resourceType === 'Consent')?.interaction).toContain('update');
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

  test('confines patients to their own FHIR compartment', () => {
    const policy = buildClinicBuddyPatientAccessPolicy();
    const patientReadRule = policy.resource?.find(
      (rule) => rule.resourceType === 'Patient' && rule.interaction?.includes('read')
    );
    const patientUpdateRule = policy.resource?.find(
      (rule) => rule.resourceType === 'Patient' && rule.interaction?.includes('update')
    );
    const invoiceRule = policy.resource?.find((rule) => rule.resourceType === 'Invoice');
    const binaryRule = policy.resource?.find((rule) => rule.resourceType === 'Binary');
    const appointmentUpdateRule = policy.resource?.find(
      (rule) => rule.resourceType === 'Appointment' && rule.interaction?.includes('update')
    );
    const receivedMessageRule = policy.resource?.find(
      (rule) => rule.resourceType === 'Communication' && rule.criteria?.includes('recipient')
    );
    const sentMessageRule = policy.resource?.find(
      (rule) => rule.resourceType === 'Communication' && rule.criteria?.includes('sender')
    );

    expect(policy.compartment?.reference).toBe('%patient');
    expect(patientReadRule?.criteria).toBe('Patient?_id=%patient.id');
    expect(patientUpdateRule?.readonlyFields).toContain('identifier');
    expect(patientUpdateRule?.interaction).not.toContain('create');
    expect(invoiceRule?.criteria).toBe('Invoice?_compartment=%patient');
    expect(binaryRule?.criteria).toBe('Binary?_compartment=%patient');
    expect(appointmentUpdateRule?.readonlyFields).toContain('participant');
    expect(appointmentUpdateRule?.readonlyFields).toContain('slot');
    expect(receivedMessageRule?.interaction).not.toContain('update');
    expect(sentMessageRule?.interaction).toContain('create');
    expect(policy.resource?.find((rule) => rule.resourceType === 'PaymentReconciliation')).toBeUndefined();
  });

  test('uses the scoped policy for the patient role', () => {
    expect(buildClinicBuddyAccessPolicy('patient')).toEqual(buildClinicBuddyPatientAccessPolicy());
  });
});
