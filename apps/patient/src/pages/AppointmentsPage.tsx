// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable no-nested-ternary */
import { Badge, Button, Card, Group, Modal, Select, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import type { WithId } from '@medplum/core';
import { extractServiceTypeReferences, getReferenceString, hasSchedulingParameters, isDefined } from '@medplum/core';
import type { Appointment, HealthcareService, Patient, Schedule } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconCalendarEvent, IconCalendarPlus } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { PortalPage } from '../components/PortalPage';
import { usePortalSearch } from '../hooks';
import { formatPortalDate, getAppointmentTitle, getReferenceLabel } from '../lib/portal';
import type { PortalSchedulingOption } from '../lib/scheduling';
import { bookPatientAppointment, cancelPatientAppointment, findAvailableAppointments } from '../lib/scheduling';

export function AppointmentsPage({ patient }: { patient: Patient & { id: string } }): JSX.Element {
  const medplum = useMedplum();
  const [bookingOpened, booking] = useDisclosure(false);
  const [rescheduling, setRescheduling] = useState<WithId<Appointment>>();
  const query = useMemo(() => `actor=Patient/${patient.id}&_sort=-date&_count=100`, [patient.id]);
  const appointments = usePortalSearch<WithId<Appointment>>('Appointment', query);
  const cancel = async (appointment: WithId<Appointment>): Promise<void> => {
    try {
      await medplum.post(medplum.fhirUrl('Appointment', appointment.id, '$cancel'), {});
      appointments.reload();
      showNotification({ color: 'teal', message: 'Appointment cancelled.' });
    } catch (error) {
      showNotification({ color: 'red', message: error instanceof Error ? error.message : 'Cancellation failed.' });
    }
  };

  const handleBooked = async (): Promise<void> => {
    if (rescheduling) {
      try {
        await medplum.post(medplum.fhirUrl('Appointment', rescheduling.id, '$cancel'), {});
        showNotification({ color: 'teal', message: 'Your appointment has been rescheduled.' });
      } catch {
        showNotification({
          color: 'orange',
          message:
            'The new appointment was booked, but the previous visit could not be cancelled. Please contact the clinic.',
        });
      }
    } else {
      showNotification({ color: 'teal', message: 'Your appointment is booked.' });
    }
    setRescheduling(undefined);
    booking.close();
    appointments.reload();
  };

  return (
    <PortalPage
      title="Appointments"
      description="Book, review, reschedule, or cancel your clinic visits."
      action={
        <Button leftSection={<IconCalendarPlus size={18} />} onClick={booking.open}>
          Book appointment
        </Button>
      }
    >
      {appointments.loading ? (
        <LoadingState />
      ) : appointments.error ? (
        <ErrorState error={appointments.error} />
      ) : appointments.data.length === 0 ? (
        <EmptyState
          title="No appointments yet"
          message="Your upcoming and past clinic visits will appear here."
          action={<Button onClick={booking.open}>Book your first appointment</Button>}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {appointments.data.map((appointment) => {
            const upcoming =
              !!appointment.start &&
              new Date(appointment.start) > new Date() &&
              ['booked', 'pending', 'proposed'].includes(appointment.status);
            const clinician = appointment.participant.find((item) =>
              item.actor?.reference?.startsWith('Practitioner/')
            )?.actor;
            return (
              <Card key={appointment.id} withBorder radius="lg" padding="lg">
                <Group justify="space-between" align="flex-start">
                  <ThemeIcon radius="xl" variant="light" color="teal" size="lg">
                    <IconCalendarEvent size={20} />
                  </ThemeIcon>
                  <Badge color={upcoming ? 'teal' : 'gray'} variant="light">
                    {appointment.status}
                  </Badge>
                </Group>
                <Text fw={750} size="lg" mt="lg">
                  {getAppointmentTitle(appointment)}
                </Text>
                <Text c="dimmed" mt={4}>
                  {formatPortalDate(appointment.start, true)}
                </Text>
                <Text size="sm" mt="sm">
                  {getReferenceLabel(clinician)}
                </Text>
                {upcoming && (
                  <Group mt="lg">
                    <Button
                      variant="light"
                      onClick={() => {
                        setRescheduling(appointment);
                        booking.open();
                      }}
                    >
                      Reschedule
                    </Button>
                    <Button color="red" variant="subtle" onClick={() => cancel(cancelPatientAppointment(appointment))}>
                      Cancel
                    </Button>
                  </Group>
                )}
              </Card>
            );
          })}
        </SimpleGrid>
      )}
      <BookingModal
        opened={bookingOpened}
        onClose={() => {
          setRescheduling(undefined);
          booking.close();
        }}
        patient={patient}
        onBooked={handleBooked}
      />
    </PortalPage>
  );
}

function BookingModal(props: {
  opened: boolean;
  onClose: () => void;
  patient: Patient & { id: string };
  onBooked: () => Promise<void>;
}): JSX.Element {
  const medplum = useMedplum();
  const [options, setOptions] = useState<PortalSchedulingOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [slots, setSlots] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.opened) {
      return;
    }
    // Opening the modal starts an independent scheduling-catalog request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([
      medplum.searchResources('Schedule', 'active=true&_count=100'),
      medplum.searchResources('HealthcareService', 'active=true&_count=100'),
    ])
      .then(([schedules, services]) => {
        const byReference = new Map(
          (services as WithId<HealthcareService>[])
            .filter(hasSchedulingParameters)
            .map((service) => [getReferenceString(service), service])
        );
        const next = (schedules as WithId<Schedule>[]).flatMap((schedule) =>
          extractServiceTypeReferences(schedule.serviceType)
            .map((reference) => byReference.get(reference.reference ?? ''))
            .filter(isDefined)
            .map((service) => ({ schedule, service }))
        );
        setOptions(next);
        setSelected(next[0] ? `${next[0].schedule.id}|${next[0].service.id}` : null);
      })
      .catch((error: unknown) =>
        showNotification({
          color: 'red',
          message: error instanceof Error ? error.message : 'Could not load appointment types.',
        })
      )
      .finally(() => setLoading(false));
  }, [medplum, props.opened]);

  const selectedOption = options.find((option) => `${option.schedule.id}|${option.service.id}` === selected);
  const findSlots = useCallback(async (): Promise<void> => {
    if (!selectedOption) {
      return;
    }
    setLoading(true);
    try {
      const start = new Date(Date.now() + 30 * 60 * 1000);
      const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
      setSlots(await findAvailableAppointments(medplum, selectedOption, start, end));
    } catch (error) {
      showNotification({
        color: 'red',
        message: error instanceof Error ? error.message : 'Could not find appointment times.',
      });
    } finally {
      setLoading(false);
    }
  }, [medplum, selectedOption]);

  const book = async (slot: Appointment): Promise<void> => {
    setLoading(true);
    try {
      await bookPatientAppointment(medplum, slot, props.patient);
      await props.onBooked();
    } catch (error) {
      showNotification({ color: 'red', message: error instanceof Error ? error.message : 'Booking failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Book an appointment" size="lg">
      <Stack>
        <Select
          label="Appointment type"
          data={options.map((option) => ({
            value: `${option.schedule.id}|${option.service.id}`,
            label: `${option.service.name ?? 'Clinic visit'} · ${option.schedule.actor[0]?.display ?? 'Available clinician'}`,
          }))}
          value={selected}
          onChange={(value) => {
            setSelected(value);
            setSlots([]);
          }}
          disabled={loading}
          searchable
        />
        <Button onClick={findSlots} loading={loading} disabled={!selectedOption}>
          Find available times
        </Button>
        {slots.map((slot) => (
          <Card key={`${slot.start}-${slot.end}`} withBorder radius="md">
            <Group justify="space-between">
              <Text fw={650}>{formatPortalDate(slot.start, true)}</Text>
              <Button size="xs" onClick={() => book(slot)} disabled={loading}>
                Book
              </Button>
            </Group>
          </Card>
        ))}
        {!loading && options.length === 0 && (
          <Text c="dimmed" size="sm">
            Online appointment types have not been configured by this clinic yet.
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
