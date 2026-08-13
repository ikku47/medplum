// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { AllergyIntolerance } from '@medplum/fhirtypes';

export function isActiveConfirmedAllergy(allergy: AllergyIntolerance): boolean {
  const clinicalStatus = allergy.clinicalStatus?.coding?.find(
    (coding) => coding.system === 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical'
  )?.code;
  const verificationStatus = allergy.verificationStatus?.coding?.find(
    (coding) => coding.system === 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification'
  )?.code;

  return clinicalStatus !== 'inactive' && clinicalStatus !== 'resolved' && verificationStatus !== 'refuted';
}

export function getAllergySeverity(allergy: AllergyIntolerance): 'severe' | 'moderate' | 'mild' | undefined {
  const severities = allergy.reaction?.map((reaction) => reaction.severity).filter(Boolean) ?? [];
  if (severities.includes('severe')) {
    return 'severe';
  }
  if (severities.includes('moderate')) {
    return 'moderate';
  }
  if (severities.includes('mild')) {
    return 'mild';
  }
  return undefined;
}

export function getAllergyDisplay(allergy: AllergyIntolerance): string {
  return allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unspecified allergen';
}
