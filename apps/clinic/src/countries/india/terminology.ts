// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

export const indiaTerminology = {
  diagnosisValueSet: import.meta.env.CLINICBUDDY_DIAGNOSIS_VALUESET || 'http://snomed.info/sct?fhir_vs',
  icd10ValueSet: import.meta.env.CLINICBUDDY_ICD10_VALUESET || 'http://hl7.org/fhir/sid/icd-10/vs',
} as const;
