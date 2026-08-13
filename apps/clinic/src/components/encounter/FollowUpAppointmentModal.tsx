// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Button, Group, Modal, NumberInput, Stack, Textarea } from '@mantine/core';
import type { WithId } from '@medplum/core';
import { createReference, isResourceWithId } from '@medplum/core';
import type { Encounter, HealthcareService, Patient, Practitioner, Reference } from '@medplum/fhirtypes';
import { DateTimeInput, ResourceInput, useMedplum } from '@medplum/react';
import type { JSX } from 'react';
import { useState } from 'react';
import { getAppointmentDuration } from '../../tenancy/clinic-configuration';
import { createAppointment } from '../../utils/encounter';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';

export function FollowUpAppointmentModal(props: {
  opened: boolean;
  onClose: () => void;
  patient: WithId<Patient>;
  encounter: WithId<Encounter>;
  practitioner: Reference<Practitioner>;
}): JSX.Element {
  const medplum = useMedplum();
  const [start, setStart] = useState(() => defaultFollowUpDate());
  const [duration, setDuration] = useState(15);
  const [appointmentType, setAppointmentType] = useState<WithId<HealthcareService>>();
  const [reason, setReason] = useState('Clinical follow-up');
  const [saving, setSaving] = useState(false);

  const save = async (): Promise<void> => {
    if (Number.isNaN(start.getTime())) {
      showErrorNotification(new Error('Choose a valid follow-up date and time.'));
      return;
    }
    setSaving(true);
    try {
      const appointment = await createAppointment(
        medplum,
        start,
        new Date(start.getTime() + duration * 60_000),
        props.patient,
        props.practitioner,
        undefined,
        appointmentType,
        { originatingEncounter: createReference(props.encounter), reason }
      );
      showSuccessNotification({
        title: 'Follow-up scheduled',
        message: `${appointment.start?.slice(0, 16) ?? 'The appointment'} is linked to this visit.`,
      });
      props.onClose();
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Schedule follow-up" size="lg" centered>
      <Stack>
        <DateTimeInput
          name="follow-up-start"
          label="Date and time"
          required
          defaultValue={start.toISOString()}
          onChange={(value) => setStart(new Date(value))}
        />
        <ResourceInput<HealthcareService>
          name="follow-up-service"
          resourceType="HealthcareService"
          label="Appointment type"
          searchCriteria={{ active: 'true' }}
          onChange={(value) => {
            if (value && isResourceWithId(value)) {
              setAppointmentType(value);
              setDuration(getAppointmentDuration(value) ?? 15);
            } else {
              setAppointmentType(undefined);
            }
          }}
        />
        <NumberInput
          required
          label="Duration"
          suffix=" min"
          min={5}
          max={480}
          value={duration}
          onChange={(value) => setDuration(Number(value))}
        />
        <Textarea label="Reason" required value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Schedule follow-up
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function defaultFollowUpDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(10, 0, 0, 0);
  return date;
}
