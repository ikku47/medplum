// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import {
  Button,
  Card,
  Container,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { createReference } from '@medplum/core';
import type { Encounter, Patient } from '@medplum/fhirtypes';
import { ResourceName, useMedplum, useMedplumProfile, useResource } from '@medplum/react';
import type { JSX } from 'react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { buildIndiaMedicationRequest } from '../../countries/india/prescription';
import { showErrorNotification } from '../../utils/notifications';

export function IndiaPrescriptionPage(): JSX.Element {
  const medplum = useMedplum();
  const profile = useMedplumProfile();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const patientRef = params.get('patient') ?? '';
  const encounterRef = params.get('encounter') ?? '';
  const patient = useResource<Patient>(patientRef ? { reference: patientRef } : undefined);
  const encounter = useResource<Encounter>(encounterRef ? { reference: encounterRef } : undefined);
  const [medication, setMedication] = useState('');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState('Oral');
  const [frequency, setFrequency] = useState('Once daily');
  const [durationDays, setDurationDays] = useState(5);
  const [quantity, setQuantity] = useState(5);
  const [quantityUnit, setQuantityUnit] = useState('tablets');
  const [refills, setRefills] = useState(0);
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (printAfterSave: boolean): Promise<void> => {
    if (!patient?.id || profile?.resourceType !== 'Practitioner') {
      showErrorNotification('A patient and prescribing practitioner are required.');
      return;
    }
    setSaving(true);
    try {
      await medplum.createResource(
        buildIndiaMedicationRequest({
          input: { medication, dose, route, frequency, durationDays, quantity, quantityUnit, refills, instructions },
          patient: createReference(patient),
          requester: createReference(profile),
          encounter: encounter?.id ? createReference(encounter) : undefined,
        })
      );
      const destination = printAfterSave
        ? `/clinical/prescriptions/print?patient=${encodeURIComponent(`Patient/${patient.id}`)}${encounter?.id ? `&encounter=${encodeURIComponent(`Encounter/${encounter.id}`)}` : ''}`
        : `/Patient/${patient.id}/MedicationRequest`;
      await Promise.resolve(navigate(destination));
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <div>
          <Text tt="uppercase" fw={800} size="xs" c="teal.7" lts="0.14em">
            India prescription
          </Text>
          <Title order={1}>Create prescription</Title>
          {patient && (
            <Text c="dimmed">
              Patient: <ResourceName value={patient} />
            </Text>
          )}
        </div>
        <Card withBorder radius="lg" p="xl">
          <Stack gap="md">
            <TextInput
              label="Medication"
              required
              placeholder="Generic name, strength and formulation"
              value={medication}
              onChange={(event) => setMedication(event.currentTarget.value)}
            />
            <TextInput
              label="Dose"
              required
              placeholder="For example: 1 tablet or 5 mL"
              value={dose}
              onChange={(event) => setDose(event.currentTarget.value)}
            />
            <Select
              label="Route"
              required
              value={route}
              onChange={(value) => value && setRoute(value)}
              data={['Oral', 'Topical', 'Inhaled', 'Nasal', 'Ophthalmic', 'Otic', 'Sublingual', 'Rectal', 'Other']}
              searchable
            />
            <TextInput
              label="Frequency"
              required
              value={frequency}
              onChange={(event) => setFrequency(event.currentTarget.value)}
            />
            <Group grow>
              <NumberInput
                label="Duration (days)"
                min={1}
                value={durationDays}
                onChange={(value) => setDurationDays(Number(value))}
              />
              <NumberInput label="Quantity" min={1} value={quantity} onChange={(value) => setQuantity(Number(value))} />
              <TextInput
                label="Unit"
                value={quantityUnit}
                onChange={(event) => setQuantityUnit(event.currentTarget.value)}
              />
            </Group>
            <NumberInput label="Refills" min={0} value={refills} onChange={(value) => setRefills(Number(value))} />
            <Textarea
              label="Patient instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.currentTarget.value)}
              autosize
              minRows={3}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button variant="light" loading={saving} onClick={() => save(false)}>
                Save
              </Button>
              <Button loading={saving} onClick={() => save(true)}>
                Save & print
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
