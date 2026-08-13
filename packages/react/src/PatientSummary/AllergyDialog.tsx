// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Group, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { createReference, HTTP_HL7_ORG } from '@medplum/core';
import type { AllergyIntolerance, Encounter, Patient } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { useCallback, useState } from 'react';
import { CodeableConceptInput } from '../CodeableConceptInput/CodeableConceptInput';
import { DateTimeInput } from '../DateTimeInput/DateTimeInput';
import { Form } from '../Form/Form';
import { SubmitButton } from '../Form/SubmitButton';

export interface AllergyDialogProps {
  readonly patient: Patient;
  readonly encounter?: Encounter;
  readonly allergy?: AllergyIntolerance;
  readonly onSubmit: (allergy: AllergyIntolerance) => void;
}

const ALLERGEN_VALUE_SET = 'http://snomed.info/sct?fhir_vs=refset/60944005';

export function AllergyDialog(props: AllergyDialogProps): JSX.Element {
  const { patient, encounter, allergy, onSubmit } = props;
  const [code, setCode] = useState(allergy?.code);
  const [clinicalStatus, setClinicalStatus] = useState(allergy?.clinicalStatus);

  const handleSubmit = useCallback(
    (formData: Record<string, string>) => {
      onSubmit({
        ...allergy,
        resourceType: 'AllergyIntolerance',
        patient: createReference(patient),
        encounter: encounter ? createReference(encounter) : undefined,
        code,
        clinicalStatus,
        verificationStatus: allergy?.verificationStatus ?? {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
              code: 'confirmed',
              display: 'Confirmed',
            },
          ],
        },
        recordedDate: formData.recordedDate || allergy?.recordedDate || new Date().toISOString(),
        onsetDateTime: formData.onsetDateTime || undefined,
        reaction: formData.reaction
          ? [
              {
                manifestation: [{ text: formData.reaction }],
                severity: formData.severity as 'mild' | 'moderate' | 'severe' | undefined,
              },
            ]
          : undefined,
        note: formData.notes ? [{ text: formData.notes }] : undefined,
      });
    },
    [patient, encounter, allergy, code, clinicalStatus, onSubmit]
  );

  return (
    <Form key={allergy?.id} onSubmit={handleSubmit}>
      <Stack>
        <CodeableConceptInput
          name="allergy"
          label="Allergen"
          path="AllergyIntolerance.code"
          data-autofocus={true}
          binding={ALLERGEN_VALUE_SET}
          maxValues={1}
          defaultValue={allergy?.code}
          onChange={(code) => setCode(code)}
          outcome={undefined}
        />
        <TextInput name="reaction" label="Reaction" defaultValue={allergy?.reaction?.[0]?.manifestation?.[0]?.text} />
        <Select
          name="severity"
          label="Severity"
          data={[
            { value: 'mild', label: 'Mild' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'severe', label: 'Severe' },
          ]}
          defaultValue={allergy?.reaction?.[0]?.severity}
          clearable
        />
        <CodeableConceptInput
          name="clinicalStatus"
          label="Clinical Status"
          path="AllergyIntolerance.clinicalStatus"
          binding={HTTP_HL7_ORG + '/fhir/ValueSet/allergyintolerance-clinical'}
          maxValues={1}
          defaultValue={allergy?.clinicalStatus}
          onChange={(clinicalStatus) => setClinicalStatus(clinicalStatus)}
          outcome={undefined}
        />
        <DateTimeInput name="recordedDate" label="Date identified" defaultValue={allergy?.recordedDate} />
        <DateTimeInput name="onsetDateTime" label="Onset" defaultValue={allergy?.onsetDateTime} />
        <Textarea name="notes" label="Notes" defaultValue={allergy?.note?.[0]?.text} autosize minRows={2} />
        <Group justify="flex-end" gap={4} mt="md">
          <SubmitButton>Save</SubmitButton>
        </Group>
      </Stack>
    </Form>
  );
}
