// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { ClinicalImpression } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import {
  CLINICBUDDY_CLINICAL_NOTE_EXTENSION,
  hasClinicalNoteContent,
  readClinicalNote,
  writeClinicalNote,
} from './clinical-note';

const impression: ClinicalImpression = {
  resourceType: 'ClinicalImpression',
  id: 'impression-1',
  status: 'in-progress',
  subject: { reference: 'Patient/patient-1' },
  extension: [{ url: 'https://example.com/retained', valueString: 'keep me' }],
};

describe('structured clinical note', () => {
  test('round trips SOAP and follow-up fields without discarding unrelated extensions', () => {
    const updated = writeClinicalNote(impression, {
      chiefComplaint: 'Fever for two days',
      subjective: 'Fatigue and chills',
      objective: 'Temperature 38.2 C',
      assessment: 'Likely viral illness',
      plan: 'Hydration and paracetamol',
      followUp: 'Review in three days',
      freeText: 'Safety-net advice provided.',
    });

    expect(updated.extension).toContainEqual({ url: 'https://example.com/retained', valueString: 'keep me' });
    expect(updated.extension).toContainEqual(expect.objectContaining({ url: CLINICBUDDY_CLINICAL_NOTE_EXTENSION }));
    expect(readClinicalNote(updated)).toEqual({
      chiefComplaint: 'Fever for two days',
      subjective: 'Fatigue and chills',
      objective: 'Temperature 38.2 C',
      assessment: 'Likely viral illness',
      plan: 'Hydration and paracetamol',
      followUp: 'Review in three days',
      freeText: 'Safety-net advice provided.',
    });
  });

  test('removes empty ClinicBuddy note data and recognizes meaningful content', () => {
    const empty = readClinicalNote(impression);
    expect(hasClinicalNoteContent(empty)).toBe(false);
    expect(writeClinicalNote(impression, empty).extension).toEqual(impression.extension);
    expect(hasClinicalNoteContent({ ...empty, assessment: 'Stable' })).toBe(true);
  });
});
