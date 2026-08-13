// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Badge, Button, Card, Grid, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import type {
  Appointment,
  Communication,
  DiagnosticReport,
  Encounter,
  Invoice,
  MedicationRequest,
  Patient,
} from '@medplum/fhirtypes';
import {
  IconCalendarEvent,
  IconCreditCard,
  IconHeartbeat,
  IconMail,
  IconPill,
  IconReportMedical,
} from '@tabler/icons-react';
import type { JSX } from 'react';
import { Link } from 'react-router';
import { usePortalSearch } from '../hooks';
import {
  formatInr,
  formatPortalDate,
  getAppointmentTitle,
  getInvoiceOutstanding,
  getMedicationName,
  getPatientName,
  getResultTitle,
} from '../lib/portal';

export function HomePage({ patient }: { patient: Patient & { id: string } }): JSX.Element {
  const patientRef = `Patient/${patient.id}`;
  const today = new Date().toISOString();
  const appointments = usePortalSearch<Appointment>(
    'Appointment',
    `actor=${patientRef}&date=ge${today}&status=booked,pending,proposed&_sort=date&_count=1`
  );
  const encounters = usePortalSearch<Encounter>('Encounter', `patient=${patientRef}&_sort=-date&_count=1`);
  const medications = usePortalSearch<MedicationRequest>(
    'MedicationRequest',
    `subject=${patientRef}&status=active&_sort=-authoredon&_count=1`
  );
  const results = usePortalSearch<DiagnosticReport>(
    'DiagnosticReport',
    `subject=${patientRef}&status=final,amended,corrected&_sort=-date&_count=1`
  );
  const invoices = usePortalSearch<Invoice>('Invoice', `subject=${patientRef}&status=issued&_sort=-date&_count=50`);
  const messages = usePortalSearch<Communication>('Communication', `recipient=${patientRef}&_sort=-sent&_count=10`);
  const appointment = appointments.data[0];
  const encounter = encounters.data[0];
  const medication = medications.data[0];
  const result = results.data[0];
  const outstanding = invoices.data.reduce((total, invoice) => total + getInvoiceOutstanding(invoice), 0);

  return (
    <div className="home-hero">
      <div className="home-hero-glow" />
      <Stack gap={28} className="home-content">
        <div>
          <Text tt="uppercase" fw={800} size="xs" className="eyebrow">
            Your health, in one place
          </Text>
          <Title order={1} mt={6} className="home-title">
            Namaste, {getPatientName(patient).split(' ')[0]}
          </Title>
          <Text c="dimmed" mt="xs" maw={620}>
            Review your care, keep appointments on track, and securely reach your clinic team.
          </Text>
        </div>

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Card className="feature-card" padding="xl" radius="xl">
              <Group justify="space-between" align="flex-start">
                <ThemeIcon size={46} radius="xl" color="teal" variant="light">
                  <IconCalendarEvent size={24} />
                </ThemeIcon>
                {appointment && <Badge color="teal">Upcoming</Badge>}
              </Group>
              <Title order={2} mt="xl">
                {appointment ? getAppointmentTitle(appointment) : 'No upcoming appointment'}
              </Title>
              <Text c="dimmed" mt={6}>
                {appointment
                  ? formatPortalDate(appointment.start, true)
                  : 'Book your next clinic visit when you are ready.'}
              </Text>
              <Button component={Link} to="/appointments" mt="xl" radius="xl">
                {appointment ? 'Manage appointment' : 'Book an appointment'}
              </Button>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Card className="balance-card" padding="xl" radius="xl">
              <ThemeIcon size={46} radius="xl" color="orange" variant="light">
                <IconCreditCard size={24} />
              </ThemeIcon>
              <Text mt="xl" c="dimmed" fw={600}>
                Outstanding balance
              </Text>
              <Title order={2} mt={2}>
                {formatInr(outstanding)}
              </Title>
              <Text size="sm" c="dimmed" mt={6}>
                {outstanding > 0 ? 'Payment is due on your issued invoices.' : 'You are all settled.'}
              </Text>
              <Button component={Link} to="/billing" variant="light" color="orange" mt="xl" radius="xl">
                View billing
              </Button>
            </Card>
          </Grid.Col>
        </Grid>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          <SummaryCard
            icon={IconHeartbeat}
            title="Recent visit"
            value={encounter ? formatPortalDate(encounter.period?.start) : 'No visits yet'}
            href="/health-record"
          />
          <SummaryCard
            icon={IconPill}
            title="Medication"
            value={medication ? getMedicationName(medication) : 'No active medication'}
            href="/medications"
          />
          <SummaryCard
            icon={IconReportMedical}
            title="Latest result"
            value={result ? getResultTitle(result) : 'No results yet'}
            href="/results"
          />
          <SummaryCard
            icon={IconMail}
            title="Notifications"
            value={`${messages.data.length} recent message${messages.data.length === 1 ? '' : 's'}`}
            href="/messages"
          />
        </SimpleGrid>
      </Stack>
    </div>
  );
}

function SummaryCard(props: { icon: typeof IconHeartbeat; title: string; value: string; href: string }): JSX.Element {
  return (
    <Card component={Link} to={props.href} withBorder padding="lg" radius="lg" className="summary-card">
      <Group gap="sm">
        <ThemeIcon variant="light" color="teal" radius="xl">
          <props.icon size={18} />
        </ThemeIcon>
        <Text size="sm" c="dimmed" fw={600}>
          {props.title}
        </Text>
      </Group>
      <Text fw={750} mt="md" lineClamp={2}>
        {props.value}
      </Text>
    </Card>
  );
}
