// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import type { Encounter, Patient } from '@medplum/fhirtypes';
import { IconCalendarPlus, IconFileUpload, IconFlask, IconPill } from '@tabler/icons-react';
import type { JSX } from 'react';
import { Link } from 'react-router';

export function EncounterActions(props: {
  patient: Patient & { id: string };
  encounter: Encounter & { id: string };
}): JSX.Element {
  const { patient, encounter } = props;
  const patientPath = `/Patient/${patient.id}`;
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
          <Button component={Link} to="/Calendar/Schedule" variant="light" leftSection={<IconCalendarPlus size={17} />}>
            Follow-up appointment
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
