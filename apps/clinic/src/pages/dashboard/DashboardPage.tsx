// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { formatHumanName, getReferenceString, parseReference } from '@medplum/core';
import type {
  Appointment,
  Claim,
  DiagnosticReport,
  Encounter,
  Invoice,
  Patient,
  Reference,
  Task,
} from '@medplum/fhirtypes';
import { ResourceName, useMedplum, useMedplumProfile } from '@medplum/react';
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCash,
  IconChartBar,
  IconClock,
  IconFileAlert,
  IconSearch,
  IconStethoscope,
  IconUsers,
} from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { getResultWorkflow } from '../../clinical/results';
import {
  calculateAppointmentMetrics,
  calculateDoctorUtilization,
  calculateNoShowRate,
  getDashboardVariant,
  sumInvoiceTotals,
} from '../../dashboard/metrics';
import { clinicFlowLabels, getAppointmentFlowStage } from '../../reception/queue';
import { getClinicBuddyRole } from '../../tenancy/roles';
import { showErrorNotification } from '../../utils/notifications';

interface DashboardData {
  appointments: Appointment[];
  patients: Patient[];
  invoices: Invoice[];
  claims: Claim[];
  encounters: Encounter[];
  results: DiagnosticReport[];
  tasks: Task[];
}

const emptyData: DashboardData = {
  appointments: [],
  patients: [],
  invoices: [],
  claims: [],
  encounters: [],
  results: [],
  tasks: [],
};

export function DashboardPage(): JSX.Element {
  const medplum = useMedplum();
  const profile = useMedplumProfile();
  const membership = medplum.getProjectMembership();
  const role = membership ? getClinicBuddyRole(membership) : 'doctor';
  const variant = getDashboardVariant(role);
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => getDayRange(new Date()), []);

  const loadDashboard = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const appointmentParams: [string, string][] = [
        ['date', `ge${today.start}`],
        ['date', `lt${today.end}`],
        ['_count', '200'],
        ['_sort', 'date'],
      ];
      const profileReference = profile ? getReferenceString(profile) : undefined;
      if (variant === 'doctor' && profileReference) {
        appointmentParams.push(['actor', profileReference]);
      }

      const appointments = await medplum.searchResources('Appointment', appointmentParams);
      if (variant === 'reception') {
        const [patients, invoices] = await Promise.all([
          medplum.searchResources('Patient', [
            ['_lastUpdated', `ge${today.start}`],
            ['_count', '100'],
          ]),
          medplum.searchResources('Invoice', [
            ['status', 'draft,issued'],
            ['_count', '100'],
          ]),
        ]);
        setData({ ...emptyData, appointments, patients, invoices });
      } else if (variant === 'doctor') {
        const owner = profile ? getReferenceString(profile) : undefined;
        const [encounters, results, tasks, patients] = await Promise.all([
          medplum.searchResources('Encounter', [
            ['status', 'in-progress'],
            ...(owner ? ([['participant', owner]] as [string, string][]) : []),
            ['_count', '100'],
          ]),
          medplum.searchResources('DiagnosticReport', [
            ['status', 'preliminary,final,amended,corrected'],
            ['_count', '100'],
            ['_sort', '-issued'],
          ]),
          medplum.searchResources('Task', [
            ['status', 'requested,ready,received,accepted,in-progress'],
            ...(owner ? ([['owner', owner]] as [string, string][]) : []),
            ['_count', '100'],
          ]),
          medplum.searchResources('Patient', [
            ['_sort', '-_lastUpdated'],
            ['_count', '5'],
          ]),
        ]);
        setData({ ...emptyData, appointments, encounters, results, tasks, patients });
      } else {
        const [patients, invoices, claims] = await Promise.all([
          medplum.searchResources('Patient', [
            ['_lastUpdated', `ge${today.start}`],
            ['_count', '200'],
          ]),
          medplum.searchResources('Invoice', [
            ['_count', '200'],
            ['_sort', '-date'],
          ]),
          medplum.searchResources('Claim', [
            ['status', 'active'],
            ['_count', '100'],
          ]),
        ]);
        setData({ ...emptyData, appointments, patients, invoices, claims });
      }
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setLoading(false);
    }
  }, [medplum, profile, today.end, today.start, variant]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dashboard state follows the active tenant and role
    loadDashboard().catch(showErrorNotification);
  }, [loadDashboard]);

  if (loading && data.appointments.length === 0) {
    return (
      <Container py="6rem">
        <Group justify="center">
          <Loader />
        </Group>
      </Container>
    );
  }

  const name = profile?.resourceType === 'Practitioner' ? formatHumanName(profile.name?.[0]) : undefined;
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-end">
          <div>
            <Text tt="uppercase" fw={800} size="xs" c="teal.7" lts="0.14em">
              {variant} workspace
            </Text>
            <Title order={1}>{name ? `Good day, ${name}` : 'Clinic overview'}</Title>
            <Text c="dimmed">{formatDashboardDate(new Date())}</Text>
          </div>
          <Button variant="light" onClick={() => loadDashboard()}>
            Refresh
          </Button>
        </Group>

        {variant === 'reception' && <ReceptionDashboard data={data} />}
        {variant === 'doctor' && <DoctorDashboard data={data} />}
        {variant === 'administrator' && <AdministratorDashboard data={data} />}
      </Stack>
    </Container>
  );
}

function ReceptionDashboard({ data }: { data: DashboardData }): JSX.Element {
  const navigate = useNavigate();
  const metrics = calculateAppointmentMetrics(data.appointments);
  const [patientQuery, setPatientQuery] = useState('');
  const outstanding = data.invoices.filter((invoice) => invoice.status === 'issued' || invoice.status === 'draft');

  return (
    <>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <MetricCard label="Today's appointments" value={metrics.total} icon={<IconCalendarEvent />} />
        <MetricCard label="Waiting patients" value={metrics.waiting} color="orange" icon={<IconClock />} />
        <MetricCard label="Checked in" value={metrics.checkedIn} color="blue" icon={<IconUsers />} />
        <MetricCard label="Late patients" value={metrics.late} color="red" icon={<IconAlertTriangle />} />
        <MetricCard label="No-shows" value={metrics.noShows} color="gray" icon={<IconUsers />} />
        <MetricCard label="New registrations" value={data.patients.length} color="cyan" icon={<IconUsers />} />
        <MetricCard label="Pending payments" value={outstanding.length} color="yellow" icon={<IconCash />} />
      </SimpleGrid>
      <Paper withBorder radius="lg" p="lg">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (patientQuery.trim()) {
              Promise.resolve(navigate(`/Patient?name=${encodeURIComponent(patientQuery.trim())}`)).catch(
                showErrorNotification
              );
            }
          }}
        >
          <TextInput
            label="Quick patient search"
            placeholder="Name, mobile number or MRN"
            value={patientQuery}
            onChange={(event) => setPatientQuery(event.currentTarget.value)}
            leftSection={<IconSearch size={17} />}
            rightSectionWidth={92}
            rightSection={
              <Button type="submit" size="compact-sm" mr="xs">
                Search
              </Button>
            }
          />
        </form>
      </Paper>
      <AppointmentPanel appointments={data.appointments} title="Today's clinic flow" />
    </>
  );
}

function DoctorDashboard({ data }: { data: DashboardData }): JSX.Element {
  const metrics = calculateAppointmentMetrics(data.appointments);
  const current = data.appointments.find((appointment) => getAppointmentFlowStage(appointment) === 'consultation');
  return (
    <>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <MetricCard label="Today's schedule" value={metrics.total} icon={<IconCalendarEvent />} />
        <MetricCard label="Waiting queue" value={metrics.waiting} color="orange" icon={<IconClock />} />
        <MetricCard
          label="Pending results"
          value={data.results.filter((report) => getResultWorkflow(report).reviewStatus === 'new').length}
          color="blue"
          icon={<IconFileAlert />}
        />
        <MetricCard label="Unsigned notes" value={data.encounters.length} color="red" icon={<IconStethoscope />} />
        <MetricCard label="Follow-up reminders" value={data.tasks.length} color="yellow" icon={<IconAlertTriangle />} />
      </SimpleGrid>
      <Paper withBorder radius="lg" p="lg">
        <Text size="xs" tt="uppercase" fw={800} c="teal.7">
          Current patient
        </Text>
        {current ? <AppointmentRow appointment={current} /> : <Text c="dimmed">No consultation in progress.</Text>}
      </Paper>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <AppointmentPanel appointments={data.appointments} title="Today's schedule" />
        <PatientPanel patients={data.patients} title="Recent patients" />
      </SimpleGrid>
    </>
  );
}

function AdministratorDashboard({ data }: { data: DashboardData }): JSX.Element {
  const metrics = calculateAppointmentMetrics(data.appointments);
  const paid = data.invoices.filter((invoice) => invoice.status === 'balanced');
  const outstanding = data.invoices.filter((invoice) => invoice.status === 'draft' || invoice.status === 'issued');
  const utilization = calculateDoctorUtilization(metrics);
  const noShowRate = calculateNoShowRate(metrics);
  return (
    <>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <MetricCard label="Appointments" value={metrics.total} icon={<IconCalendarEvent />} />
        <MetricCard label="Revenue" value={formatInr(sumInvoiceTotals(paid))} color="teal" icon={<IconCash />} />
        <MetricCard label="Patient volume" value={data.patients.length} color="cyan" icon={<IconUsers />} />
        <MetricCard label="Outstanding invoices" value={outstanding.length} color="yellow" icon={<IconFileAlert />} />
        <MetricCard label="Insurance claims" value={data.claims.length} color="blue" icon={<IconFileAlert />} />
        <MetricCard
          label="Operational alerts"
          value={metrics.late + metrics.noShows + outstanding.length}
          color="red"
          icon={<IconAlertTriangle />}
        />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <RateCard label="Doctor utilization" value={utilization} color="teal" />
        <RateCard label="No-show rate" value={noShowRate} color="orange" />
      </SimpleGrid>
      <AppointmentPanel appointments={data.appointments} title="Today's operations" />
    </>
  );
}

function MetricCard(props: { label: string; value: number | string; icon: JSX.Element; color?: string }): JSX.Element {
  const color = props.color ?? 'teal';
  return (
    <Card withBorder radius="lg" p="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            {props.label}
          </Text>
          <Text fz="1.7rem" fw={900} mt={4}>
            {props.value}
          </Text>
        </div>
        <Badge variant="light" color={color} size="xl" circle>
          {props.icon}
        </Badge>
      </Group>
    </Card>
  );
}

function RateCard(props: { label: string; value: number; color: string }): JSX.Element {
  return (
    <Paper withBorder radius="lg" p="lg">
      <Group justify="space-between">
        <Group gap="xs">
          <IconChartBar size={19} />
          <Text fw={800}>{props.label}</Text>
        </Group>
        <Text fw={900}>{props.value.toFixed(1)}%</Text>
      </Group>
      <Progress value={props.value} color={props.color} mt="md" radius="xl" />
    </Paper>
  );
}

function AppointmentPanel({ appointments, title }: { appointments: Appointment[]; title: string }): JSX.Element {
  return (
    <Paper withBorder radius="lg" p="lg">
      <Group justify="space-between" mb="md">
        <Title order={3}>{title}</Title>
        <Button component={Link} to="/reception/queue" variant="subtle" size="compact-sm">
          Open flow board
        </Button>
      </Group>
      <Stack gap="xs">
        {appointments.slice(0, 8).map((appointment, index) => (
          <AppointmentRow key={appointment.id ?? `${appointment.start}-${index}`} appointment={appointment} />
        ))}
        {appointments.length === 0 && <Text c="dimmed">No appointments scheduled.</Text>}
      </Stack>
    </Paper>
  );
}

function AppointmentRow({ appointment }: { appointment: Appointment }): JSX.Element {
  const patient = findParticipant(appointment, 'Patient');
  const stage = getAppointmentFlowStage(appointment);
  return (
    <Group justify="space-between" p="sm" bg="var(--mantine-color-gray-0)" style={{ borderRadius: 10 }}>
      <Group gap="sm">
        <Text fw={800} w={64}>
          {formatTime(appointment.start)}
        </Text>
        {patient?.reference ? (
          <Text component={Link} to={`/${patient.reference}`} fw={700}>
            {patient.display || <ResourceName value={patient} />}
          </Text>
        ) : (
          <Text fw={700}>Unassigned patient</Text>
        )}
      </Group>
      <Badge variant="light">{clinicFlowLabels[stage]}</Badge>
    </Group>
  );
}

function PatientPanel({ patients, title }: { patients: Patient[]; title: string }): JSX.Element {
  return (
    <Paper withBorder radius="lg" p="lg">
      <Title order={3} mb="md">
        {title}
      </Title>
      <Stack gap="xs">
        {patients.map((patient) => {
          const name = patient.name?.[0] ? formatHumanName(patient.name[0]) : 'Unnamed patient';
          return patient.id ? (
            <Text key={patient.id} component={Link} to={`/Patient/${patient.id}`}>
              {name}
            </Text>
          ) : (
            <Text key={name}>{name}</Text>
          );
        })}
        {patients.length === 0 && <Text c="dimmed">No recent patients.</Text>}
      </Stack>
    </Paper>
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

function getDayRange(date: Date): { start: string; end: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatTime(value: string | undefined): string {
  return value ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
}

function formatDashboardDate(value: Date): string {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(value);
}

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}
