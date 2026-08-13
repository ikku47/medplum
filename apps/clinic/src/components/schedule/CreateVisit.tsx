// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Button, Flex, Stack, Text, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { WithId } from '@medplum/core';
import type {
  Coding,
  HealthcareService,
  Patient,
  PlanDefinition,
  Practitioner,
  Reference,
  Schedule,
} from '@medplum/fhirtypes';
import { CodingInput, DateTimeInput, Form, ResourceInput, useMedplum } from '@medplum/react';
import { IconAlertSquareRounded, IconCircleCheck, IconCirclePlus } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Range } from '../../types/scheduling';
import { getAppointmentDuration } from '../../tenancy/clinic-configuration';
import { createAppointment, createEncounter } from '../../utils/encounter';
import { showErrorNotification } from '../../utils/notifications';
import { PlanDefinitionSummary } from '../plandefinition/PlanDefinitionSummary';

interface CreateVisitProps {
  appointmentSlot: Range | undefined;
  practitioner: Reference<Practitioner>;
  schedule?: Schedule;
}

export function CreateVisit(props: CreateVisitProps): JSX.Element {
  const { appointmentSlot, schedule } = props;
  const [patient, setPatient] = useState<Patient | undefined>();
  const [planDefinitionData, setPlanDefinitionData] = useState<PlanDefinition | undefined>();
  const [encounterClass, setEncounterClass] = useState<Coding | undefined>();
  const [appointmentType, setAppointmentType] = useState<WithId<HealthcareService> | undefined>();
  const [start, setStart] = useState(appointmentSlot?.start);
  const [end, setEnd] = useState(appointmentSlot?.end);
  const [isLoading, setIsLoading] = useState(false);
  const medplum = useMedplum();
  const navigate = useNavigate();

  const [formattedDate, formattedSlotTime] = useMemo(() => {
    if (!appointmentSlot) {
      return ['', ''];
    }

    const startDate = new Date(appointmentSlot?.start);
    const endDate = new Date(appointmentSlot?.end);

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    const dateStr = startDate.toLocaleDateString('en-US', options);

    const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
    const startTimeStr = startDate.toLocaleTimeString('en-US', timeOptions);
    const endTimeStr = endDate.toLocaleTimeString('en-US', timeOptions);

    const formattedTime = `${startTimeStr} – ${endTimeStr}`;
    return [dateStr, formattedTime];
  }, [appointmentSlot]);

  async function handleSubmit(): Promise<void> {
    if (!patient || !encounterClass || !start || !end) {
      showNotification({
        color: 'yellow',
        icon: <IconAlertSquareRounded />,
        title: 'Error',
        message: 'Please fill out required fields.',
      });
      return;
    }
    setIsLoading(true);
    try {
      const appointment = await createAppointment(
        medplum,
        start,
        end,
        patient,
        props.practitioner,
        schedule,
        appointmentType
      );
      const encounter = await createEncounter(
        medplum,
        encounterClass,
        patient,
        planDefinitionData,
        appointment,
        props.practitioner
      );
      showNotification({ icon: <IconCircleCheck />, title: 'Success', message: 'Visit created' });
      navigate(`/Patient/${patient.id}/Encounter/${encounter.id}`)?.catch(console.error);
    } catch (err) {
      showErrorNotification(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form onSubmit={handleSubmit}>
      <Flex direction="column" gap="md" h="100%" justify="space-between">
        <Stack gap="md" h="100%">
          <Stack gap={0}>
            <Title order={1} fw={500}>
              {formattedDate}
            </Title>
            <Text size="lg">{formattedSlotTime}</Text>
          </Stack>

          <ResourceInput
            label="Practitioner"
            resourceType="Practitioner"
            name="Practitioner-id"
            required={true}
            defaultValue={props.practitioner}
            disabled={true}
          />

          <ResourceInput
            label="Patient"
            resourceType="Patient"
            name="Patient-id"
            required={true}
            onChange={(value) => setPatient(value as Patient)}
          />

          <ResourceInput<WithId<HealthcareService>>
            label="Appointment type"
            resourceType="HealthcareService"
            name="HealthcareService-id"
            searchCriteria={{ active: 'true' }}
            onChange={(value) => {
              setAppointmentType(value);
              const duration = value && getAppointmentDuration(value);
              if (duration && start && !Number.isNaN(start.getTime())) {
                setEnd(new Date(start.getTime() + duration * 60 * 1000));
              }
            }}
          />

          <DateTimeInput
            name="start"
            label="Start Time"
            defaultValue={appointmentSlot?.start?.toISOString()}
            required={true}
            onChange={(value) => {
              setStart(new Date(value));
            }}
          />

          <DateTimeInput
            key={appointmentType?.id ?? 'no-appointment-type'}
            name="end"
            label="End Time"
            defaultValue={end && !Number.isNaN(end.getTime()) ? end.toISOString() : undefined}
            required={true}
            onChange={(value) => {
              setEnd(new Date(value));
            }}
          />

          <CodingInput
            name="class"
            label="Class"
            binding="http://terminology.hl7.org/ValueSet/v3-ActEncounterCode"
            required={true}
            onChange={setEncounterClass}
            path="Encounter.class"
          />

          <ResourceInput
            name="plandefinition"
            resourceType="PlanDefinition"
            label="Care template"
            onChange={(value) => {
              setPlanDefinitionData(value as PlanDefinition);
            }}
          />
        </Stack>

        <PlanDefinitionSummary planDefinition={planDefinitionData} />

        <Button fullWidth mt="xl" type="submit" loading={isLoading} disabled={isLoading}>
          <IconCirclePlus /> <Text ml="xs">Create Visit</Text>
        </Button>
      </Flex>
    </Form>
  );
}
