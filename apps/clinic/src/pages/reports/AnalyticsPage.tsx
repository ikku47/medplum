// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Card, Container, Group, Loader, SegmentedControl, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import type { Appointment, Condition, MedicationRequest, Procedure, ServiceRequest } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { CountRow } from '../../reporting/analytics';
import { buildClinicalReport, buildOperationalReport } from '../../reporting/analytics';
import { showErrorNotification } from '../../utils/notifications';

type ReportView = 'operational' | 'clinical';

export function AnalyticsPage(): JSX.Element {
  const medplum = useMedplum();
  const [view, setView] = useState<ReportView>('operational');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [medications, setMedications] = useState<MedicationRequest[]>([]);
  const [orders, setOrders] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const result = await Promise.all([
          medplum.searchResources('Appointment', { _count: '1000', _sort: '-date' }),
          medplum.searchResources('Condition', { _count: '1000', _sort: '-_lastUpdated' }),
          medplum.searchResources('Procedure', { _count: '1000', _sort: '-_lastUpdated' }),
          medplum.searchResources('MedicationRequest', { _count: '1000', _sort: '-_lastUpdated' }),
          medplum.searchResources('ServiceRequest', { _count: '1000', _sort: '-_lastUpdated' }),
        ]);
        if (active) {
          setAppointments(result[0]);
          setConditions(result[1]);
          setProcedures(result[2]);
          setMedications(result[3]);
          setOrders(result[4]);
        }
      } catch (error) {
        showErrorNotification(error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    load().catch(showErrorNotification);
    return () => {
      active = false;
    };
  }, [medplum]);

  const operational = useMemo(() => buildOperationalReport(appointments), [appointments]);
  const clinical = useMemo(
    () => buildClinicalReport({ conditions, procedures, medications, orders }),
    [conditions, medications, orders, procedures]
  );

  if (loading) {
    return (
      <Group justify="center" py="6rem">
        <Loader />
      </Group>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <div>
          <Text tt="uppercase" fw={800} size="xs" c="teal.7" lts="0.14em">
            Reporting
          </Text>
          <Title order={1}>Clinic analytics</Title>
          <Text c="dimmed">Operational throughput and clinical activity from tenant-owned FHIR records.</Text>
        </div>
        <SegmentedControl
          value={view}
          onChange={(value) => setView(value as ReportView)}
          data={[
            { value: 'operational', label: 'Operational' },
            { value: 'clinical', label: 'Clinical' },
          ]}
        />
        {view === 'operational' ? (
          <>
            <SimpleGrid cols={{ base: 2, lg: 6 }}>
              <Metric label="Patient volume" value={operational.patientVolume.toString()} />
              <Metric label="Completed" value={operational.completed.toString()} color="teal" />
              <Metric label="Cancelled" value={operational.cancelled.toString()} color="orange" />
              <Metric label="No-show" value={operational.noShow.toString()} color="red" />
              <Metric label="No-show rate" value={`${operational.noShowRate.toFixed(1)}%`} />
              <Metric
                label="Average wait"
                value={
                  operational.averageWaitMinutes === undefined
                    ? 'No data'
                    : `${operational.averageWaitMinutes.toFixed(0)} min`
                }
              />
            </SimpleGrid>
            <Breakdown title="Provider utilization" rows={operational.providers} />
          </>
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Metric label="Laboratory orders" value={clinical.labOrders.toString()} />
              <Metric label="Imaging orders" value={clinical.imagingOrders.toString()} />
              <Metric label="Referrals" value={clinical.referrals.toString()} />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, lg: 3 }}>
              <Breakdown title="Diagnoses" rows={clinical.diagnoses} />
              <Breakdown title="Procedures" rows={clinical.procedures} />
              <Breakdown title="Medications" rows={clinical.medications} />
            </SimpleGrid>
          </>
        )}
      </Stack>
    </Container>
  );
}

function Metric(props: { label: string; value: string; color?: string }): JSX.Element {
  return (
    <Card withBorder radius="lg">
      <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
        {props.label}
      </Text>
      <Text fz="1.6rem" fw={900} c={props.color}>
        {props.value}
      </Text>
    </Card>
  );
}

function Breakdown(props: { title: string; rows: CountRow[] }): JSX.Element {
  return (
    <Card withBorder radius="lg">
      <Title order={3} mb="md">
        {props.title}
      </Title>
      <Table>
        <Table.Tbody>
          {props.rows.slice(0, 15).map((row) => (
            <Table.Tr key={row.label}>
              <Table.Td>{row.label}</Table.Td>
              <Table.Td ta="right" fw={700}>
                {row.count}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {props.rows.length === 0 && <Text c="dimmed">No data.</Text>}
    </Card>
  );
}
