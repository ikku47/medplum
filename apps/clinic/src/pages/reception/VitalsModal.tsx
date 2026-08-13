// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Button, Group, Modal, NumberInput, SimpleGrid, Stack, Text } from '@mantine/core';
import type { WithId } from '@medplum/core';
import { parseReference } from '@medplum/core';
import type { Appointment, Patient, Reference } from '@medplum/fhirtypes';
import { ResourceName, useMedplum } from '@medplum/react';
import type { JSX } from 'react';
import { useState } from 'react';
import type { VitalSignsInput } from '../../reception/vitals';
import { saveVitalsAndAdvanceQueue } from '../../reception/vitals';
import { showErrorNotification } from '../../utils/notifications';

export function VitalsModal(props: {
  appointment: WithId<Appointment> | undefined;
  opened: boolean;
  onClose: () => void;
  onSaved: (appointment: WithId<Appointment>) => void;
}): JSX.Element {
  const medplum = useMedplum();
  const [values, setValues] = useState<VitalSignsInput>({});
  const [saving, setSaving] = useState(false);
  const patient = props.appointment ? findPatient(props.appointment) : undefined;

  const update = (field: keyof VitalSignsInput, value: string | number): void => {
    setValues((current) => ({ ...current, [field]: value === '' ? undefined : Number(value) }));
  };

  const handleSave = async (): Promise<void> => {
    if (!props.appointment || !patient) {
      showErrorNotification(new Error('This appointment does not have a patient.'));
      return;
    }
    setSaving(true);
    try {
      const saved = await saveVitalsAndAdvanceQueue(medplum, props.appointment, patient, values);
      props.onSaved(saved);
      setValues({});
      props.onClose();
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Record vital signs" size="lg" centered>
      <Stack gap="lg">
        {patient && (
          <Text fw={700}>
            <ResourceName value={patient} />
          </Text>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput label="Height" suffix=" cm" min={20} max={260} onChange={(value) => update('heightCm', value)} />
          <NumberInput
            label="Weight"
            suffix=" kg"
            min={0.5}
            max={500}
            decimalScale={1}
            onChange={(value) => update('weightKg', value)}
          />
          <NumberInput
            label="Systolic BP"
            suffix=" mmHg"
            min={40}
            max={300}
            onChange={(value) => update('systolic', value)}
          />
          <NumberInput
            label="Diastolic BP"
            suffix=" mmHg"
            min={20}
            max={200}
            onChange={(value) => update('diastolic', value)}
          />
          <NumberInput
            label="Temperature"
            suffix=" °C"
            min={25}
            max={45}
            decimalScale={1}
            onChange={(value) => update('temperatureC', value)}
          />
          <NumberInput label="Pulse" suffix=" /min" min={20} max={300} onChange={(value) => update('pulse', value)} />
          <NumberInput
            label="Respiratory rate"
            suffix=" /min"
            min={4}
            max={100}
            onChange={(value) => update('respiratoryRate', value)}
          />
          <NumberInput
            label="SpO₂"
            suffix=" %"
            min={50}
            max={100}
            onChange={(value) => update('oxygenSaturation', value)}
          />
          <NumberInput
            label="Blood glucose"
            suffix=" mg/dL"
            min={10}
            max={1000}
            onChange={(value) => update('bloodGlucoseMgDl', value)}
          />
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          BMI is calculated automatically when both height and weight are recorded.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSave}>
            Save vitals & move to waiting
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function findPatient(appointment: Appointment): Reference<Patient> | undefined {
  return appointment.participant.find((participant) => {
    if (!participant.actor?.reference) {
      return false;
    }
    return parseReference(participant.actor)[0] === 'Patient';
  })?.actor as Reference<Patient> | undefined;
}
