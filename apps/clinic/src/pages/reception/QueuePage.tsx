// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Menu,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { WithId } from '@medplum/core';
import { parseReference } from '@medplum/core';
import type { Appointment, Bundle, Reference } from '@medplum/fhirtypes';
import { ResourceName, useMedplum, useResourceModified, useSubscription } from '@medplum/react';
import {
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDotsVertical,
  IconRefresh,
  IconStethoscope,
  IconUsersGroup,
} from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { beginConsultation } from '../../reception/consultation';
import type { ClinicFlowStage } from '../../reception/queue';
import {
  clinicFlowLabels,
  getAllowedTargets,
  getAppointmentFlowStage,
  getNextClinicFlowStage,
  getStageEnteredAt,
  isTerminalStage,
  transitionAppointment,
} from '../../reception/queue';
import { showErrorNotification } from '../../utils/notifications';
import { VitalsModal } from './VitalsModal';

interface QueueColumn {
  id: string;
  title: string;
  color: string;
  icon: JSX.Element;
  stages: ClinicFlowStage[];
}

const columns: QueueColumn[] = [
  {
    id: 'arrivals',
    title: 'Arrivals',
    color: 'blue',
    icon: <IconUsersGroup size={20} />,
    stages: ['scheduled', 'arrived'],
  },
  {
    id: 'preparation',
    title: 'Preparation',
    color: 'orange',
    icon: <IconClock size={20} />,
    stages: ['checked-in', 'vitals', 'waiting'],
  },
  {
    id: 'care',
    title: 'Care & billing',
    color: 'teal',
    icon: <IconStethoscope size={20} />,
    stages: ['consultation', 'billing'],
  },
  {
    id: 'complete',
    title: 'Closed',
    color: 'gray',
    icon: <IconClock size={20} />,
    stages: ['completed', 'cancelled', 'no-show', 'left-without-consultation'],
  },
];

export function QueuePage(): JSX.Element {
  const medplum = useMedplum();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [appointments, setAppointments] = useState<WithId<Appointment>[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string>();
  const [vitalsAppointment, setVitalsAppointment] = useState<WithId<Appointment>>();
  const [, setClockTick] = useState(0);
  const range = useMemo(() => ({ start: startOfDay(day), end: addDays(startOfDay(day), 1) }), [day]);

  const loadAppointments = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const results = await medplum.searchResources('Appointment', [
        ['_count', '200'],
        ['date', `ge${range.start.toISOString()}`],
        ['date', `lt${range.end.toISOString()}`],
        ['_sort', 'date'],
      ]);
      setAppointments(results);
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setLoading(false);
    }
  }, [medplum, range.end, range.start]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading is synchronized with the selected queue day
    loadAppointments().catch(showErrorNotification);
  }, [loadAppointments]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => loadAppointments().catch(showErrorNotification), 30_000);
    const clockTimer = window.setInterval(() => setClockTick((value) => value + 1), 60_000);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadAppointments]);

  useResourceModified('Appointment', (event) => {
    if (event.operation === 'delete') {
      setAppointments((current) => current.filter((appointment) => appointment.id !== event.id));
      return;
    }
    if (event.resource?.id) {
      setAppointments((current) => replaceAppointment(current, event.resource as WithId<Appointment>, range));
    }
  });

  useSubscription(
    `Appointment?date=ge${range.start.toISOString()}&date=lt${range.end.toISOString()}`,
    (_bundle: Bundle) => loadAppointments().catch(showErrorNotification),
    { onError: showErrorNotification }
  );

  const handleTransition = async (appointment: WithId<Appointment>, target: ClinicFlowStage): Promise<void> => {
    setUpdatingId(appointment.id);
    try {
      if (target === 'consultation') {
        const result = await beginConsultation(medplum, appointment);
        setAppointments((current) => replaceAppointment(current, result.appointment, range));
        return;
      }
      const saved = await medplum.updateResource(transitionAppointment(appointment, target));
      setAppointments((current) => replaceAppointment(current, saved, range));
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setUpdatingId(undefined);
    }
  };

  return (
    <Container fluid py="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end">
          <div>
            <Text tt="uppercase" fw={700} size="xs" c="teal.7" lts="0.12em">
              Reception
            </Text>
            <Title order={2}>Clinic flow board</Title>
            <Text c="dimmed">Live progress from arrival through consultation and billing.</Text>
          </div>
          <Group gap="xs">
            <ActionIcon variant="default" size="lg" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
              <IconChevronLeft size={18} />
            </ActionIcon>
            <Button variant="default" onClick={() => setDay(startOfDay(new Date()))}>
              {formatDay(day)}
            </Button>
            <ActionIcon variant="default" size="lg" aria-label="Next day" onClick={() => setDay(addDays(day, 1))}>
              <IconChevronRight size={18} />
            </ActionIcon>
            <ActionIcon variant="light" size="lg" aria-label="Refresh queue" onClick={() => loadAppointments()}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>
        </Group>

        {loading && appointments.length === 0 ? (
          <Center py="6rem">
            <Loader />
          </Center>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="md">
            {columns.map((column) => {
              const columnAppointments = appointments.filter((appointment) =>
                column.stages.includes(getAppointmentFlowStage(appointment))
              );
              return (
                <Paper key={column.id} withBorder radius="lg" p="sm" bg="var(--mantine-color-gray-0)">
                  <Group justify="space-between" mb="sm" px="xs">
                    <Group gap="xs" c={`${column.color}.7`}>
                      {column.icon}
                      <Text fw={800}>{column.title}</Text>
                    </Group>
                    <Badge color={column.color} variant="light" circle>
                      {columnAppointments.length}
                    </Badge>
                  </Group>
                  <ScrollArea.Autosize mah="calc(100vh - 260px)" type="auto">
                    <Stack gap="sm">
                      {columnAppointments.map((appointment) => (
                        <QueueCard
                          key={appointment.id}
                          appointment={appointment}
                          loading={updatingId === appointment.id}
                          onTransition={(target) => handleTransition(appointment, target)}
                          onRecordVitals={() => setVitalsAppointment(appointment)}
                        />
                      ))}
                      {columnAppointments.length === 0 && (
                        <Center py="xl">
                          <Text size="sm" c="dimmed">
                            No patients
                          </Text>
                        </Center>
                      )}
                    </Stack>
                  </ScrollArea.Autosize>
                </Paper>
              );
            })}
          </SimpleGrid>
        )}
        <VitalsModal
          appointment={vitalsAppointment}
          opened={Boolean(vitalsAppointment)}
          onClose={() => setVitalsAppointment(undefined)}
          onSaved={(appointment) => setAppointments((current) => replaceAppointment(current, appointment, range))}
        />
      </Stack>
    </Container>
  );
}

function QueueCard(props: {
  appointment: WithId<Appointment>;
  loading: boolean;
  onTransition: (target: ClinicFlowStage) => Promise<void>;
  onRecordVitals: () => void;
}): JSX.Element {
  const { appointment } = props;
  const stage = getAppointmentFlowStage(appointment);
  const patient = findParticipant(appointment, 'Patient');
  const practitioner = findParticipant(appointment, 'Practitioner');
  const location = findParticipant(appointment, 'Location');
  const next = getNextClinicFlowStage(stage);
  const otherTargets = getAllowedTargets(stage).filter((target) => target !== next);

  return (
    <Card withBorder radius="md" padding="md" shadow="xs">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div>
            {patient?.reference ? (
              <Text component={Link} to={`/${patient.reference}`} fw={800}>
                {patient.display || <ResourceName value={patient} />}
              </Text>
            ) : (
              <Text fw={800}>Unassigned patient</Text>
            )}
            <Text size="xs" c="dimmed">
              {formatAppointmentTime(appointment.start)}
              {practitioner?.display ? ` · ${practitioner.display}` : ''}
            </Text>
          </div>
          {otherTargets.length > 0 && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" aria-label="More queue actions">
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {otherTargets.map((target) => (
                  <Menu.Item
                    key={target}
                    color={target === 'cancelled' || target === 'no-show' ? 'red' : undefined}
                    onClick={() => props.onTransition(target)}
                  >
                    {clinicFlowLabels[target]}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>

        <Group gap="xs">
          <Badge variant="light" color={isTerminalStage(stage) ? 'gray' : 'teal'}>
            {clinicFlowLabels[stage]}
          </Badge>
          {!isTerminalStage(stage) && (
            <Text size="xs" c="dimmed">
              {formatElapsed(getStageEnteredAt(appointment) ?? appointment.start)}
            </Text>
          )}
        </Group>

        {location?.display && (
          <Text size="xs" c="dimmed">
            {location.display}
          </Text>
        )}

        {stage === 'vitals' && (
          <Button fullWidth size="xs" onClick={props.onRecordVitals}>
            Record vitals
          </Button>
        )}
        {stage !== 'vitals' && next && (
          <Button fullWidth size="xs" loading={props.loading} onClick={() => props.onTransition(next)}>
            {clinicFlowLabels[next]}
          </Button>
        )}
      </Stack>
    </Card>
  );
}

function findParticipant(appointment: Appointment, resourceType: string): Reference | undefined {
  return appointment.participant.find((participant) => {
    if (!participant.actor?.reference) {
      return false;
    }
    return parseReference(participant.actor)[0] === resourceType;
  })?.actor;
}

function replaceAppointment(
  current: WithId<Appointment>[],
  appointment: WithId<Appointment>,
  range: { start: Date; end: Date }
): WithId<Appointment>[] {
  const start = appointment.start ? new Date(appointment.start) : undefined;
  const belongsToDay = start && start >= range.start && start < range.end;
  const withoutAppointment = current.filter((item) => item.id !== appointment.id);
  return belongsToDay ? [...withoutAppointment, appointment].sort(compareAppointmentTime) : withoutAppointment;
}

function compareAppointmentTime(left: Appointment, right: Appointment): number {
  return (left.start ?? '').localeCompare(right.start ?? '');
}

function startOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDay(value: Date): string {
  const today = startOfDay(new Date()).getTime();
  if (value.getTime() === today) {
    return 'Today';
  }
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(value);
}

function formatAppointmentTime(value: string | undefined): string {
  if (!value) {
    return 'Time not set';
  }
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatElapsed(value: string | undefined): string {
  if (!value) {
    return 'Just now';
  }
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  return minutes < 1 ? 'Just now' : `${minutes} min`;
}
