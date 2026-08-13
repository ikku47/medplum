// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable no-nested-ternary */
import { Badge, Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import type { MedicationRequest, Patient } from '@medplum/fhirtypes';
import { IconPill } from '@tabler/icons-react';
import type { JSX } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { PortalPage } from '../components/PortalPage';
import { usePortalSearch } from '../hooks';
import { formatPortalDate, getMedicationName } from '../lib/portal';

export function MedicationsPage({ patient }: { patient: Patient & { id: string } }): JSX.Element {
  const medications = usePortalSearch<MedicationRequest>(
    'MedicationRequest',
    `subject=Patient/${patient.id}&_sort=-authoredon&_count=100`
  );
  return (
    <PortalPage title="Medications" description="Your current and previous prescriptions from the clinic.">
      {medications.loading ? (
        <LoadingState />
      ) : medications.error ? (
        <ErrorState error={medications.error} />
      ) : medications.data.length === 0 ? (
        <EmptyState title="No medications" message="Prescriptions written by your clinic will appear here." />
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {medications.data.map((medication) => (
            <Card key={medication.id} withBorder radius="lg" padding="lg">
              <Group justify="space-between">
                <ThemeIcon color="teal" variant="light" radius="xl">
                  <IconPill size={19} />
                </ThemeIcon>
                <Badge color={medication.status === 'active' ? 'teal' : 'gray'} variant="light">
                  {medication.status}
                </Badge>
              </Group>
              <Text fw={750} size="lg" mt="lg">
                {getMedicationName(medication)}
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                Prescribed {formatPortalDate(medication.authoredOn)}
              </Text>
              <Stack gap={4} mt="md">
                {medication.dosageInstruction?.map((dosage, index) => (
                  <Text key={index} size="sm">
                    {dosage.text ?? 'Take as directed by your clinician.'}
                  </Text>
                ))}
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </PortalPage>
  );
}
