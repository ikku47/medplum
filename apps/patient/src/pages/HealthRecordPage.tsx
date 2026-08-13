// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable no-nested-ternary */
import { Badge, Card, Grid, Group, List, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import type { AllergyIntolerance, Condition, Encounter, Observation, Patient } from '@medplum/fhirtypes';
import type { IconActivityHeartbeat } from '@tabler/icons-react';
import { IconAlertTriangle, IconHeartbeat, IconStethoscope } from '@tabler/icons-react';
import type { JSX } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { PortalPage } from '../components/PortalPage';
import { usePortalSearch } from '../hooks';
import { formatPortalDate } from '../lib/portal';

export function HealthRecordPage({ patient }: { patient: Patient & { id: string } }): JSX.Element {
  const ref = `Patient/${patient.id}`;
  const encounters = usePortalSearch<Encounter>('Encounter', `patient=${ref}&_sort=-date&_count=50`);
  const conditions = usePortalSearch<Condition>('Condition', `patient=${ref}&_sort=-recorded-date&_count=100`);
  const allergies = usePortalSearch<AllergyIntolerance>('AllergyIntolerance', `patient=${ref}&_count=100`);
  const vitals = usePortalSearch<Observation>(
    'Observation',
    `subject=${ref}&category=vital-signs&_sort=-date&_count=8`
  );
  const loading = encounters.loading || conditions.loading || allergies.loading || vitals.loading;
  const error = encounters.error ?? conditions.error ?? allergies.error ?? vitals.error;

  return (
    <PortalPage
      title="Health record"
      description="A patient-friendly view of your visits, conditions, allergies, and recent observations."
    >
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <Stack gap="xl">
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <RecordSummary icon={IconStethoscope} label="Recorded visits" value={encounters.data.length.toString()} />
            <RecordSummary
              icon={IconHeartbeat}
              label="Active conditions"
              value={conditions.data
                .filter((item) => item.clinicalStatus?.coding?.some((coding) => coding.code === 'active'))
                .length.toString()}
            />
            <RecordSummary icon={IconAlertTriangle} label="Allergies" value={allergies.data.length.toString()} />
          </SimpleGrid>
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Card withBorder radius="lg" padding="lg">
                <Text fw={750} size="lg" mb="md">
                  Visit history
                </Text>
                {encounters.data.length === 0 ? (
                  <EmptyState title="No visits recorded" message="Completed clinic visits will appear here." />
                ) : (
                  <Stack gap={0}>
                    {encounters.data.map((encounter) => (
                      <Group key={encounter.id} className="record-row" justify="space-between" py="md" wrap="nowrap">
                        <div>
                          <Text fw={650}>{encounter.type?.[0]?.text ?? 'Outpatient visit'}</Text>
                          <Text size="sm" c="dimmed">
                            {formatPortalDate(encounter.period?.start, true)}
                          </Text>
                        </div>
                        <Badge variant="light" color={encounter.status === 'finished' ? 'teal' : 'gray'}>
                          {encounter.status}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Stack>
                <Card withBorder radius="lg" padding="lg">
                  <Text fw={750}>Conditions</Text>
                  <List mt="md" spacing="sm">
                    {conditions.data.map((condition) => (
                      <List.Item key={condition.id}>
                        {condition.code?.text ?? condition.code?.coding?.[0]?.display ?? 'Condition'}
                      </List.Item>
                    ))}
                    {conditions.data.length === 0 && (
                      <Text size="sm" c="dimmed">
                        No conditions recorded.
                      </Text>
                    )}
                  </List>
                </Card>
                <Card withBorder radius="lg" padding="lg">
                  <Text fw={750}>Allergies</Text>
                  <List mt="md" spacing="sm">
                    {allergies.data.map((allergy) => (
                      <List.Item key={allergy.id}>
                        {allergy.code?.text ?? allergy.code?.coding?.[0]?.display ?? 'Allergy'}
                      </List.Item>
                    ))}
                    {allergies.data.length === 0 && (
                      <Text size="sm" c="dimmed">
                        No allergies recorded.
                      </Text>
                    )}
                  </List>
                </Card>
              </Stack>
            </Grid.Col>
          </Grid>
          {vitals.data.length > 0 && (
            <Card withBorder radius="lg" padding="lg">
              <Text fw={750} size="lg">
                Recent observations
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mt="md">
                {vitals.data.map((observation) => (
                  <div key={observation.id}>
                    <Text size="sm" c="dimmed">
                      {observation.code.text ?? observation.code.coding?.[0]?.display ?? 'Observation'}
                    </Text>
                    <Text fw={750}>
                      {observation.valueQuantity
                        ? `${observation.valueQuantity.value ?? ''} ${observation.valueQuantity.unit ?? ''}`
                        : (observation.valueString ?? 'Recorded')}
                    </Text>
                  </div>
                ))}
              </SimpleGrid>
            </Card>
          )}
        </Stack>
      )}
    </PortalPage>
  );
}

function RecordSummary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof IconActivityHeartbeat;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <Card withBorder radius="lg">
      <Group>
        <ThemeIcon color="teal" variant="light" radius="xl" size="lg">
          <Icon size={20} />
        </ThemeIcon>
        <div>
          <Text size="sm" c="dimmed">
            {label}
          </Text>
          <Text fw={800} size="xl">
            {value}
          </Text>
        </div>
      </Group>
    </Card>
  );
}
