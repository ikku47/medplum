// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { createReference, getReferenceString } from '@medplum/core';
import type { WithId } from '@medplum/core';
import type { Consent, Organization, Patient, Practitioner, Reference, RelatedPerson } from '@medplum/fhirtypes';

export const ABDM_CONSENT_PROFILE = 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/Consent';
export const CLINICBUDDY_ABDM_CONSENT_POLICY = 'https://clinicbuddy.health/fhir/CodeSystem/consent-policy';
export const CLINICBUDDY_ABDM_CONSENT_PURPOSE = 'https://clinicbuddy.health/fhir/CodeSystem/abdm-consent-purpose';

export const abdmConsentPurposes = [
  { value: 'care-management', label: 'Care management' },
  { value: 'health-information-exchange', label: 'Health information exchange' },
  { value: 'insurance', label: 'Insurance and claims' },
] as const;

export type AbdmConsentPurpose = (typeof abdmConsentPurposes)[number]['value'];

export function buildAbdmConsent(input: {
  patient: WithId<Patient>;
  purposes: readonly AbdmConsentPurpose[];
  start: string;
  end: string;
  performer?: Reference<Patient | Practitioner | RelatedPerson>;
  organization?: Reference<Organization>;
  note?: string;
  now?: string;
}): Consent {
  if (input.purposes.length === 0) {
    throw new Error('Select at least one ABDM consent purpose.');
  }
  const start = validDate(input.start, 'Consent start date');
  const end = validDate(input.end, 'Consent end date');
  if (start.getTime() >= end.getTime()) {
    throw new Error('Consent end date must be after its start date.');
  }
  const patientReference = createReference(input.patient);
  const dateTime = input.now ?? new Date().toISOString();
  return {
    resourceType: 'Consent',
    meta: { profile: [ABDM_CONSENT_PROFILE] },
    status: 'active',
    scope: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/consentscope',
          code: 'patient-privacy',
          display: 'Privacy Consent',
        },
      ],
    },
    category: [
      {
        coding: [{ system: 'http://loinc.org', code: '64292-6', display: 'Release of information consent' }],
      },
    ],
    patient: patientReference,
    dateTime,
    performer: [input.performer ?? patientReference],
    organization: input.organization ? [input.organization] : undefined,
    sourceAttachment: input.note?.trim()
      ? { contentType: 'text/plain', title: input.note.trim(), creation: dateTime }
      : undefined,
    policy: [{ authority: 'Ayushman Bharat Digital Mission', uri: 'https://abdm.gov.in/' }],
    policyRule: {
      coding: [
        {
          system: CLINICBUDDY_ABDM_CONSENT_POLICY,
          code: 'abdm-health-information-exchange',
          display: 'ABDM health information exchange consent',
        },
      ],
    },
    verification: [{ verified: true, verifiedWith: patientReference, verificationDate: dateTime }],
    provision: {
      type: 'permit',
      period: { start: start.toISOString(), end: end.toISOString() },
      purpose: input.purposes.map((purpose) => ({ system: CLINICBUDDY_ABDM_CONSENT_PURPOSE, code: purpose })),
    },
  };
}

export function isValidAbdmConsent(
  consent: Consent,
  patient: Patient & { id: string },
  at: Date = new Date()
): boolean {
  if (
    consent.status !== 'active' ||
    consent.patient?.reference !== getReferenceString(patient) ||
    !consent.meta?.profile?.includes(ABDM_CONSENT_PROFILE) ||
    !consent.verification?.some((verification) => verification.verified)
  ) {
    return false;
  }
  const policy = consent.policyRule?.coding?.some(
    (coding) =>
      coding.system === CLINICBUDDY_ABDM_CONSENT_POLICY && coding.code === 'abdm-health-information-exchange'
  );
  const permitsExchange = consent.provision?.purpose?.some(
    (purpose) =>
      purpose.system === CLINICBUDDY_ABDM_CONSENT_PURPOSE && purpose.code === 'health-information-exchange'
  );
  const start = consent.provision?.period?.start ? new Date(consent.provision.period.start) : undefined;
  const end = consent.provision?.period?.end ? new Date(consent.provision.period.end) : undefined;
  return Boolean(policy && permitsExchange && start && end && start <= at && at < end);
}

export function revokeAbdmConsent(consent: WithId<Consent>): WithId<Consent> {
  if (consent.status !== 'active') {
    throw new Error('Only an active consent can be revoked.');
  }
  return { ...consent, status: 'inactive' };
}

function validDate(value: string, field: string): Date {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) {
    throw new Error(`${field} is invalid.`);
  }
  return result;
}
