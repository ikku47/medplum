// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Badge, Container, Group, Loader, Paper, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import type { AuditEvent } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconHistory } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { showErrorNotification } from '../../utils/notifications';

const actionLabels: Record<string, string> = {
  C: 'Create',
  R: 'Read',
  U: 'Update',
  D: 'Delete',
  E: 'Execute',
};

export function AuditTrailPage(): JSX.Element {
  const medplum = useMedplum();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    async function loadEvents(): Promise<void> {
      try {
        const result = await medplum.searchResources('AuditEvent', { _count: '200', _sort: '-recorded' });
        if (active) {
          setEvents(result);
        }
      } catch (error) {
        showErrorNotification(error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadEvents().catch(showErrorNotification);
    return () => {
      active = false;
    };
  }, [medplum]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      if (action && event.action !== action) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return [getActor(event), getEventName(event), getEntity(event), event.outcomeDesc]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [action, events, query]);

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Group gap="md">
          <IconHistory size={36} color="var(--mantine-primary-color-filled)" />
          <div>
            <Title order={2}>Audit trail</Title>
            <Text c="dimmed">Server-recorded access and changes for this clinic tenant.</Text>
          </div>
        </Group>
        <Paper withBorder radius="lg" p="md">
          <Group mb="md" align="flex-end">
            <TextInput
              label="Search activity"
              placeholder="User, patient, resource or event"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Select
              label="Action"
              placeholder="All actions"
              clearable
              value={action}
              onChange={setAction}
              data={Object.entries(actionLabels).map(([value, label]) => ({ value, label }))}
            />
          </Group>
          {loading ? (
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          ) : (
            <Table.ScrollContainer minWidth={900}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>When</Table.Th>
                    <Table.Th>Actor</Table.Th>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>Event</Table.Th>
                    <Table.Th>Resource / patient</Table.Th>
                    <Table.Th>Outcome</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredEvents.map((event) => (
                    <Table.Tr key={event.id ?? `${event.recorded}-${getEntity(event)}`}>
                      <Table.Td>{formatDateTime(event.recorded)}</Table.Td>
                      <Table.Td>{getActor(event)}</Table.Td>
                      <Table.Td>{event.action ? (actionLabels[event.action] ?? event.action) : 'Event'}</Table.Td>
                      <Table.Td>{getEventName(event)}</Table.Td>
                      <Table.Td>{getEntity(event)}</Table.Td>
                      <Table.Td>
                        <Badge color={!event.outcome || event.outcome === '0' ? 'teal' : 'red'} variant="light">
                          {!event.outcome || event.outcome === '0' ? 'Success' : (event.outcomeDesc ?? 'Failed')}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
          {!loading && filteredEvents.length === 0 && (
            <Text c="dimmed" ta="center" py="xl">
              No audit activity matches these filters.
            </Text>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}

function getActor(event: AuditEvent): string {
  const agent = event.agent?.find((item) => item.requestor) ?? event.agent?.[0];
  return agent?.who?.display ?? agent?.who?.reference ?? agent?.name ?? 'System';
}

function getEventName(event: AuditEvent): string {
  return (
    event.type?.display ?? event.type?.code ?? event.subtype?.[0]?.display ?? event.subtype?.[0]?.code ?? 'Activity'
  );
}

function getEntity(event: AuditEvent): string {
  const entity = event.entity?.[0];
  return entity?.what?.display ?? entity?.what?.reference ?? entity?.name ?? '—';
}

function formatDateTime(value: string | undefined): string {
  return value
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';
}
