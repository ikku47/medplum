// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { MedplumClient } from '@medplum/core';
import type { HumanName, Identifier, Patient } from '@medplum/fhirtypes';

export const ABDM_PATIENT_PROFILE = 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient';
export const ABDM_IDENTIFIER_TYPE_SYSTEM = 'https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-identifier-type-code';
export const ABHA_NUMBER_SYSTEM = 'https://healthid.ndhm.gov.in';
export const CLINICBUDDY_MRN_SYSTEM_ROOT = 'https://clinicbuddy.health/fhir/identifier/mrn';

export class DuplicatePatientError extends Error {
  readonly patients: Patient[];

  constructor(patients: Patient[]) {
    super('A matching patient already exists. Open the existing record or verify the registration details.');
    this.name = 'DuplicatePatientError';
    this.patients = patients;
  }
}

export function normalizeIndiaMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  const nationalNumber = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
    throw new Error('Enter a valid 10-digit Indian mobile number.');
  }
  return `+91${nationalNumber}`;
}

export function normalizeAbhaNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!/^\d{14}$/.test(digits)) {
    throw new Error('ABHA number must contain 14 digits.');
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
}

export function createIndiaPatientIdentifiers(
  projectId: string,
  abhaNumber?: string,
  randomId: string = crypto.randomUUID()
): Identifier[] {
  const identifiers: Identifier[] = [
    {
      use: 'usual',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'MR',
            display: 'Medical record number',
          },
        ],
      },
      system: `${CLINICBUDDY_MRN_SYSTEM_ROOT}/${projectId}`,
      value: `CB-${randomId.replace(/-/g, '').slice(0, 10).toUpperCase()}`,
    },
  ];

  if (abhaNumber?.trim()) {
    identifiers.push({
      use: 'official',
      type: {
        coding: [
          {
            system: ABDM_IDENTIFIER_TYPE_SYSTEM,
            code: 'ABHA',
            display: 'Ayushman Bharat Health Account (ABHA) ID',
          },
        ],
      },
      system: ABHA_NUMBER_SYSTEM,
      value: normalizeAbhaNumber(abhaNumber),
    });
  }

  return identifiers;
}

export async function findDuplicatePatients(medplum: MedplumClient, candidate: Patient): Promise<Patient[]> {
  const abha = candidate.identifier?.find((identifier) => identifier.system === ABHA_NUMBER_SYSTEM)?.value;
  if (abha) {
    const matches = await medplum.searchResources('Patient', {
      identifier: `${ABHA_NUMBER_SYSTEM}|${abha}`,
      _count: 5,
    });
    if (matches.length > 0) {
      return matches;
    }
  }

  const phone = candidate.telecom?.find((contact) => contact.system === 'phone')?.value;
  if (!candidate.birthDate || !phone) {
    return [];
  }

  const matches = await medplum.searchResources('Patient', {
    birthdate: candidate.birthDate,
    phone,
    _count: 10,
  });
  const candidateName = normalizedName(candidate.name?.[0]);
  return matches.filter((patient) => normalizedName(patient.name?.[0]) === candidateName);
}

function normalizedName(name: HumanName | undefined): string {
  return [...(name?.given ?? []), name?.family ?? '']
    .join(' ')
    .toLocaleLowerCase('en-IN')
    .replace(/[^a-z0-9]/g, '');
}
