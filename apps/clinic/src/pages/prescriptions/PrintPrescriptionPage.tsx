// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Button, Container, Divider, Group, Loader, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { formatHumanName } from '@medplum/core';
import type { MedicationRequest, Patient, Practitioner } from '@medplum/fhirtypes';
import { ResourceName, useMedplum, useResource } from '@medplum/react';
import { IconPrinter } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getMedicationRequestDisplay } from '../../countries/india/prescription';
import { showErrorNotification } from '../../utils/notifications';

export function PrintPrescriptionPage(): JSX.Element {
  const medplum = useMedplum();
  const [params] = useSearchParams();
  const patientRef = params.get('patient') ?? '';
  const encounterRef = params.get('encounter') ?? undefined;
  const patient = useResource<Patient>(patientRef ? { reference: patientRef } : undefined);
  const [requests, setRequests] = useState<MedicationRequest[]>([]);
  const [practitioner, setPractitioner] = useState<Practitioner>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!patientRef) {
        return;
      }
      const result = await medplum.searchResources('MedicationRequest', [
        ['patient', patientRef],
        ['status', 'active'],
        ['_sort', '-authoredon'],
        ['_count', '100'],
        ...(encounterRef ? ([['encounter', encounterRef]] as [string, string][]) : []),
      ]);
      setRequests(result);
      const requester = result[0]?.requester;
      if (requester?.reference?.startsWith('Practitioner/')) {
        setPractitioner(await medplum.readResource('Practitioner', requester.reference.slice('Practitioner/'.length)));
      }
      setLoading(false);
    };
    load().catch((error) => {
      setLoading(false);
      showErrorNotification(error);
    });
  }, [encounterRef, medplum, patientRef]);

  if (!patient || loading) {
    return (
      <Group justify="center" py="6rem">
        <Loader />
      </Group>
    );
  }
  const registration = practitioner?.identifier?.find((identifier) => identifier.value)?.value;
  return (
    <Container size="md" py="xl">
      <Stack gap="md">
        <Group justify="flex-end" className="no-print">
          <Button leftSection={<IconPrinter size={17} />} onClick={() => window.print()}>
            Print prescription
          </Button>
        </Group>
        <Paper withBorder p="xl" radius="md">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={1}>ClinicBuddy</Title>
                <Text c="dimmed">Medical prescription</Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text fw={700}>{medplum.getProject()?.name ?? 'Clinic'}</Text>
                <Text size="sm">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date())}</Text>
              </div>
            </Group>
            <Divider />
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed">
                  Patient
                </Text>
                <Text fw={700}>
                  <ResourceName value={patient} />
                </Text>
                <Text size="sm">
                  DOB: {patient.birthDate ?? 'Not recorded'} · {patient.gender ?? 'Not recorded'}
                </Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text size="xs" c="dimmed">
                  Prescriber
                </Text>
                <Text fw={700}>
                  {practitioner?.name?.[0] ? formatHumanName(practitioner.name[0]) : 'Prescribing clinician'}
                </Text>
                {registration && <Text size="sm">Registration: {registration}</Text>}
              </div>
            </Group>
            <Title order={2}>Rx</Title>
            <Table verticalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Medication</Table.Th>
                  <Table.Th>Directions</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {requests.map((request, index) => (
                  <Table.Tr key={request.id ?? index}>
                    <Table.Td>
                      <Text fw={700}>{getMedicationRequestDisplay(request)}</Text>
                    </Table.Td>
                    <Table.Td>
                      {request.dosageInstruction?.[0]?.text}
                      <br />
                      <Text size="sm" c="dimmed">
                        {request.dosageInstruction?.[0]?.patientInstruction}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {request.dispenseRequest?.quantity?.value} {request.dispenseRequest?.quantity?.unit}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {requests.length === 0 && <Text c="dimmed">No active prescriptions found for this encounter.</Text>}
            <Divider mt="xl" />
            <Group justify="flex-end">
              <Stack gap={2} w={240}>
                <Divider />
                <Text size="sm" ta="center">
                  Prescriber signature
                </Text>
              </Stack>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
