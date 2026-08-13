// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { ClinicalImpression, Extension } from '@medplum/fhirtypes';

export const CLINICBUDDY_CLINICAL_NOTE_EXTENSION = 'https://clinicbuddy.health/fhir/StructureDefinition/clinical-note';

export const clinicalNoteFieldNames = [
  'chiefComplaint',
  'subjective',
  'objective',
  'assessment',
  'plan',
  'followUp',
] as const;

export type ClinicalNoteFieldName = (typeof clinicalNoteFieldNames)[number];

export interface ClinicalNoteValues extends Record<ClinicalNoteFieldName, string> {
  freeText: string;
}

const extensionNames: Record<ClinicalNoteFieldName, string> = {
  chiefComplaint: 'chief-complaint',
  subjective: 'subjective',
  objective: 'objective',
  assessment: 'assessment',
  plan: 'plan',
  followUp: 'follow-up',
};

export function readClinicalNote(clinicalImpression: ClinicalImpression): ClinicalNoteValues {
  const root = clinicalImpression.extension?.find((extension) => extension.url === CLINICBUDDY_CLINICAL_NOTE_EXTENSION);
  const readField = (field: ClinicalNoteFieldName): string =>
    root?.extension?.find((extension) => extension.url === extensionNames[field])?.valueString ?? '';

  return {
    chiefComplaint: readField('chiefComplaint'),
    subjective: readField('subjective'),
    objective: readField('objective'),
    assessment: readField('assessment'),
    plan: readField('plan'),
    followUp: readField('followUp'),
    freeText: clinicalImpression.note?.[0]?.text ?? '',
  };
}

export function writeClinicalNote<T extends ClinicalImpression>(clinicalImpression: T, values: ClinicalNoteValues): T {
  const retainedExtensions =
    clinicalImpression.extension?.filter((extension) => extension.url !== CLINICBUDDY_CLINICAL_NOTE_EXTENSION) ?? [];
  const noteExtensions: Extension[] = clinicalNoteFieldNames.flatMap((field) => {
    const value = values[field].trim();
    return value ? [{ url: extensionNames[field], valueString: value }] : [];
  });
  const freeText = values.freeText.trim();
  let updatedExtensions: Extension[] | undefined;
  if (noteExtensions.length > 0) {
    updatedExtensions = [
      ...retainedExtensions,
      { url: CLINICBUDDY_CLINICAL_NOTE_EXTENSION, extension: noteExtensions },
    ];
  } else if (retainedExtensions.length > 0) {
    updatedExtensions = retainedExtensions;
  }

  return {
    ...clinicalImpression,
    extension: updatedExtensions,
    note: freeText ? [{ text: freeText }] : undefined,
  };
}

export function hasClinicalNoteContent(values: ClinicalNoteValues): boolean {
  return [...clinicalNoteFieldNames.map((field) => values[field]), values.freeText].some(Boolean);
}
