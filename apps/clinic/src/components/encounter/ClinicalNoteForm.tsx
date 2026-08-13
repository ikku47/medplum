// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Card, SimpleGrid, Stack, Text, Textarea, Title, VisuallyHidden } from '@mantine/core';
import type { WithId } from '@medplum/core';
import type { ClinicalImpression } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import type { ClinicalNoteFieldName, ClinicalNoteValues } from '../../clinical/clinical-note';
import { readClinicalNote, writeClinicalNote } from '../../clinical/clinical-note';

export interface ClinicalNoteFormProps {
  clinicalImpression: WithId<ClinicalImpression>;
  disabled: boolean;
  onChange: (clinicalImpression: WithId<ClinicalImpression>) => void;
}

const fields: { name: ClinicalNoteFieldName; label: string; description: string }[] = [
  { name: 'chiefComplaint', label: 'Chief complaint', description: 'Primary reason for this visit' },
  { name: 'subjective', label: 'Subjective / history', description: 'Symptoms and history reported by the patient' },
  {
    name: 'objective',
    label: 'Objective / examination',
    description: 'Examination findings and relevant observations',
  },
  { name: 'assessment', label: 'Assessment', description: 'Clinical assessment and interpretation' },
  { name: 'plan', label: 'Plan', description: 'Treatment, prescriptions, orders and advice' },
  { name: 'followUp', label: 'Follow-up', description: 'Review interval and return precautions' },
];

export function ClinicalNoteForm(props: ClinicalNoteFormProps): JSX.Element {
  const values = readClinicalNote(props.clinicalImpression);

  const updateField = (field: keyof ClinicalNoteValues, value: string): void => {
    props.onChange(writeClinicalNote(props.clinicalImpression, { ...values, [field]: value }));
  };

  return (
    <Card withBorder shadow="sm" mt="md">
      <Stack gap="md">
        <VisuallyHidden>Fill chart note</VisuallyHidden>
        <div>
          <Title order={3}>Clinical documentation</Title>
          <Text size="sm" c="dimmed">
            Structured SOAP-compatible note. Changes save automatically until the note is signed.
          </Text>
        </div>
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          {fields.map((field) => (
            <Textarea
              key={field.name}
              label={field.label}
              description={field.description}
              value={values[field.name]}
              onChange={(event) => updateField(field.name, event.currentTarget.value)}
              autosize
              minRows={field.name === 'chiefComplaint' || field.name === 'followUp' ? 2 : 4}
              maxRows={8}
              disabled={props.disabled}
            />
          ))}
        </SimpleGrid>
        <Textarea
          label="Additional clinical notes"
          description="Optional free-text documentation that does not fit the structured sections"
          value={values.freeText}
          onChange={(event) => updateField('freeText', event.currentTarget.value)}
          autosize
          minRows={3}
          maxRows={8}
          disabled={props.disabled}
        />
        {props.disabled && (
          <Text size="sm" c="dimmed">
            This signed note is read-only. Record any correction or clarification as an addendum.
          </Text>
        )}
      </Stack>
    </Card>
  );
}
