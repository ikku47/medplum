// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Group, Stack, TextInput } from '@mantine/core';
import { createReference, HTTP_HL7_ORG, HTTP_TERMINOLOGY_HL7_ORG } from '@medplum/core';
import type { CodeableConcept, Condition, Encounter, Patient } from '@medplum/fhirtypes';
import { CodeableConceptInput, Form, SubmitButton } from '@medplum/react';
import type { JSX } from 'react';
import { useCallback, useState } from 'react';
import { indiaTerminology } from '../../countries/india/terminology';
import { showErrorNotification } from '../../utils/notifications';

export interface ConditionDialogProps {
  readonly patient: Patient;
  readonly encounter: Encounter;
  readonly onSubmit: (condition: Condition) => void;
}

export default function ConditionModal(props: ConditionDialogProps): JSX.Element {
  const { patient, encounter, onSubmit } = props;
  const [diagnosis, setDiagnosis] = useState<CodeableConcept | undefined>();
  const [icd10, setIcd10] = useState<CodeableConcept | undefined>();
  const [clinicalStatus, setClinicalStatus] = useState<CodeableConcept | undefined>();
  const [onsetDate, setOnsetDate] = useState('');

  const handleSubmit = useCallback(() => {
    if (!diagnosis) {
      showErrorNotification('Please select a diagnosis');
      return;
    }

    const updatedCondition: Condition = {
      resourceType: 'Condition',
      category: [
        {
          coding: [
            {
              system: HTTP_TERMINOLOGY_HL7_ORG + '/CodeSystem/condition-category',
              code: 'encounter-diagnosis',
              display: 'Encounter Diagnosis',
            },
          ],
          text: 'Encounter Diagnosis',
        },
      ],
      subject: createReference(patient),
      encounter: createReference(encounter),
      code: {
        coding: [...(diagnosis.coding ?? []), ...(icd10?.coding ?? [])],
        text: diagnosis.text ?? diagnosis.coding?.[0]?.display,
      },
      clinicalStatus,
      verificationStatus: {
        coding: [
          {
            system: HTTP_TERMINOLOGY_HL7_ORG + '/CodeSystem/condition-ver-status',
            code: 'confirmed',
            display: 'Confirmed',
          },
        ],
      },
      onsetDateTime: onsetDate || undefined,
      recordedDate: new Date().toISOString(),
    };

    onSubmit(updatedCondition);
  }, [patient, encounter, diagnosis, icd10, clinicalStatus, onsetDate, onSubmit]);

  return (
    <Form onSubmit={handleSubmit}>
      <Stack>
        <CodeableConceptInput
          binding={indiaTerminology.diagnosisValueSet}
          label="Diagnosis (SNOMED CT)"
          name="diagnosis"
          path="Condition.code"
          required
          maxValues={1}
          onChange={(diagnosis) => setDiagnosis(diagnosis)}
        />

        <CodeableConceptInput
          binding={indiaTerminology.icd10ValueSet}
          label="ICD-10 code (optional)"
          name="icd10"
          path="Condition.code"
          maxValues={1}
          onChange={(value) => setIcd10(value)}
        />

        <CodeableConceptInput
          name="clinicalStatus"
          label="Status"
          path="Condition.clinicalStatus"
          maxValues={1}
          binding={HTTP_HL7_ORG + '/fhir/ValueSet/condition-clinical'}
          onChange={(clinicalStatus) => setClinicalStatus(clinicalStatus)}
          required
        />
        <TextInput
          type="date"
          label="Onset date"
          value={onsetDate}
          onChange={(event) => setOnsetDate(event.currentTarget.value)}
        />
        <Group justify="flex-end" gap={4} mt="md">
          <SubmitButton>Save</SubmitButton>
        </Group>
      </Stack>
    </Form>
  );
}
