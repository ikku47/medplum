// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { isReference } from '@medplum/core';
import type { Encounter, Patient, Practitioner } from '@medplum/fhirtypes';
import { IconCalendarPlus, IconFileUpload, IconFlask, IconPill } from '@tabler/icons-react';
import type { JSX } from 'react';
import { Link } from 'react-router';
import { FollowUpAppointmentModal } from './FollowUpAppointmentModal';

export function EncounterActions(props: {
  patient: Patient & { id: string };
  encounter: Encounter & { id: string };
}): JSX.Element {
  const { patient, encounter } = props;
  const patientPath = `/Patient/${patient.id}`;
  const [followUpOpened, followUpHandlers] = useDisclosure(false);
  const practitioner = encounter.participant
    ?.map((participant) => participant.individual)
    .find((reference) => isReference<Practitioner>(reference, 'Practitioner'));
  return (
    <Card withBorder shadow="sm">
      <Stack gap="sm">
        <div>
          <Title order={3}>Care actions</Title>
          <Text size="sm" c="dimmed">
            Prescriptions, investigations, documents and follow-up remain linked to this patient record.
          </Text>
        </div>
        <Group gap="sm">
          <Button
            component={Link}
            to={`/clinical/prescriptions/new?patient=${encodeURIComponent(`Patient/${patient.id}`)}&encounter=${encodeURIComponent(`Encounter/${encounter.id}`)}`}
            leftSection={<IconPill size={17} />}
          >
            Prescription
          </Button>
          <Button
            component={Link}
            to={`/clinical/orders/new?patient=${encodeURIComponent(`Patient/${patient.id}`)}&encounter=${encodeURIComponent(`Encounter/${encounter.id}`)}`}
            variant="light"
            leftSection={<IconFlask size={17} />}
          >
            Imaging / referral
          </Button>
          <Button
            component={Link}
            to={`${patientPath}/DocumentReference`}
            variant="light"
            leftSection={<IconFileUpload size={17} />}
          >
            Documents
          </Button>
          <Button
            variant="light"
            leftSection={<IconCalendarPlus size={17} />}
            disabled={!practitioner}
            onClick={followUpHandlers.open}
          >
            Follow-up appointment
          </Button>
        </Group>
      </Stack>
      {practitioner && (
        <FollowUpAppointmentModal
          opened={followUpOpened}
          onClose={followUpHandlers.close}
          patient={patient}
          encounter={encounter}
          practitioner={practitioner}
        />
      )}
    </Card>
  );
}
