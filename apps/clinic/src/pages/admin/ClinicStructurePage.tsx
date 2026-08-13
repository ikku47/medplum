// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import type { WithId } from '@medplum/core';
import { createReference } from '@medplum/core';
import type { HealthcareService, Location, Organization } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconBuildingCommunity, IconCalendarCog, IconPlus } from '@tabler/icons-react';
import type { FormEvent, JSX } from 'react';
import { useEffect, useState } from 'react';
import type { ClinicLocationKind } from '../../tenancy/clinic-configuration';
import {
  buildAppointmentType,
  buildClinicSubLocation,
  CLINICBUDDY_APPOINTMENT_TYPE,
  CLINICBUDDY_LOCATION_KIND,
  getAppointmentDuration,
} from '../../tenancy/clinic-configuration';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';

export function ClinicStructurePage(): JSX.Element {
  const medplum = useMedplum();
  const [organization, setOrganization] = useState<WithId<Organization>>();
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<WithId<HealthcareService>[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationOpened, setLocationOpened] = useState(false);
  const [appointmentOpened, setAppointmentOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationKind, setLocationKind] = useState<ClinicLocationKind>('department');
  const [parent, setParent] = useState<string | null>(null);
  const [appointmentName, setAppointmentName] = useState('');
  const [appointmentCode, setAppointmentCode] = useState('');
  const [duration, setDuration] = useState(30);
  const [appointmentLocations, setAppointmentLocations] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const organizations = await medplum.searchResources('Organization', { active: 'true', _count: '20' });
        const clinic = organizations[0];
        if (!clinic?.id) {
          throw new Error('Configure the clinic organization before adding departments or appointment types.');
        }
        const [loadedLocations, loadedServices] = await Promise.all([
          medplum.searchResources('Location', { organization: `Organization/${clinic.id}`, _count: '200' }),
          medplum.searchResources('HealthcareService', { organization: `Organization/${clinic.id}`, _count: '200' }),
        ]);
        if (active) {
          setOrganization(clinic);
          setLocations(loadedLocations);
          setAppointmentTypes(
            loadedServices.filter((service) =>
              service.type?.some((type) =>
                type.coding?.some((coding) => coding.system === CLINICBUDDY_APPOINTMENT_TYPE)
              )
            )
          );
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

  const saveLocation = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!organization) {
      return;
    }
    setSaving(true);
    try {
      const saved = await medplum.createResource(
        buildClinicSubLocation({
          name: locationName,
          kind: locationKind,
          organization: createReference(organization),
          parent: parent ? { reference: parent } : undefined,
        })
      );
      setLocations((current) => [...current, saved]);
      setLocationName('');
      setParent(null);
      setLocationOpened(false);
      showSuccessNotification({ title: `${locationKind} added`, message: saved.name ?? 'Clinic structure updated.' });
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  const saveAppointmentType = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!organization) {
      return;
    }
    setSaving(true);
    try {
      const saved = await medplum.createResource(
        buildAppointmentType({
          name: appointmentName,
          code: appointmentCode,
          durationMinutes: duration,
          organization: createReference(organization),
          locations: appointmentLocations.map((reference) => ({ reference })),
        })
      );
      setAppointmentTypes((current) => [...current, saved]);
      setAppointmentName('');
      setAppointmentCode('');
      setDuration(30);
      setAppointmentLocations([]);
      setAppointmentOpened(false);
      showSuccessNotification({ title: 'Appointment type added', message: saved.name ?? 'Scheduling updated.' });
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (resource: WithId<Location> | WithId<HealthcareService>): Promise<void> => {
    try {
      if (resource.resourceType === 'Location') {
        const saved = await medplum.updateResource({
          ...resource,
          status: resource.status === 'active' ? 'suspended' : 'active',
        });
        setLocations((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      } else {
        const saved = await medplum.updateResource({ ...resource, active: resource.active === false });
        setAppointmentTypes((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      }
    } catch (error) {
      showErrorNotification(error);
    }
  };

  const locationOptions = locations.map((location) => ({
    value: `Location/${location.id}`,
    label: location.name ?? location.id,
  }));
  const clinicLocations = locations.filter((location) =>
    location.type?.some((type) => type.coding?.some((coding) => coding.system === CLINICBUDDY_LOCATION_KIND))
  );

  if (loading) {
    return (
      <Group justify="center" py="6rem">
        <Loader />
      </Group>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Group gap="md">
          <IconBuildingCommunity size={36} color="var(--mantine-primary-color-filled)" />
          <div>
            <Title order={2}>Clinic structure & scheduling</Title>
            <Text c="dimmed">Departments, rooms and reusable appointment types.</Text>
          </div>
        </Group>
        <Tabs defaultValue="locations">
          <Tabs.List>
            <Tabs.Tab value="locations" leftSection={<IconBuildingCommunity size={16} />}>
              Departments & rooms
            </Tabs.Tab>
            <Tabs.Tab value="appointments" leftSection={<IconCalendarCog size={16} />}>
              Appointment types
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="locations" pt="lg">
            <Stack>
              <Group justify="flex-end">
                <Button leftSection={<IconPlus size={16} />} onClick={() => setLocationOpened(true)}>
                  Add location
                </Button>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {clinicLocations.map((location) => (
                  <Card key={location.id} withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text fw={700}>{location.name}</Text>
                        <Text size="sm" c="dimmed">
                          {location.type?.[0]?.text} ·{' '}
                          {location.partOf?.display ?? location.partOf?.reference ?? 'Clinic root'}
                        </Text>
                      </div>
                      <Badge color={location.status === 'active' ? 'teal' : 'gray'}>{location.status}</Badge>
                    </Group>
                    <Button variant="subtle" size="xs" mt="sm" onClick={() => toggle(location)}>
                      {location.status === 'active' ? 'Suspend' : 'Activate'}
                    </Button>
                  </Card>
                ))}
              </SimpleGrid>
              {clinicLocations.length === 0 && (
                <Text c="dimmed" ta="center">
                  No departments or rooms configured.
                </Text>
              )}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="appointments" pt="lg">
            <Stack>
              <Group justify="flex-end">
                <Button leftSection={<IconPlus size={16} />} onClick={() => setAppointmentOpened(true)}>
                  Add appointment type
                </Button>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {appointmentTypes.map((service) => (
                  <Card key={service.id} withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text fw={700}>{service.name}</Text>
                        <Text size="sm" c="dimmed">
                          {service.type?.[0]?.coding?.[0]?.code} · {getAppointmentDuration(service)} minutes
                        </Text>
                      </div>
                      <Badge color={service.active === false ? 'gray' : 'teal'}>
                        {service.active === false ? 'inactive' : 'active'}
                      </Badge>
                    </Group>
                    <Button variant="subtle" size="xs" mt="sm" onClick={() => toggle(service)}>
                      {service.active === false ? 'Activate' : 'Deactivate'}
                    </Button>
                  </Card>
                ))}
              </SimpleGrid>
              {appointmentTypes.length === 0 && (
                <Text c="dimmed" ta="center">
                  No ClinicBuddy appointment types configured.
                </Text>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
      <Modal opened={locationOpened} onClose={() => setLocationOpened(false)} title="Add department or room">
        <form onSubmit={saveLocation}>
          <Stack>
            <Select
              label="Type"
              data={[
                { value: 'department', label: 'Department' },
                { value: 'room', label: 'Room' },
              ]}
              value={locationKind}
              onChange={(value) => setLocationKind((value as ClinicLocationKind) ?? 'department')}
            />
            <TextInput
              required
              label="Name"
              value={locationName}
              onChange={(event) => setLocationName(event.currentTarget.value)}
            />
            <Select
              label="Parent facility or department"
              required={locationKind === 'room'}
              clearable
              searchable
              data={locationOptions}
              value={parent}
              onChange={setParent}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setLocationOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Add
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Modal opened={appointmentOpened} onClose={() => setAppointmentOpened(false)} title="Add appointment type">
        <form onSubmit={saveAppointmentType}>
          <Stack>
            <TextInput
              required
              label="Name"
              placeholder="New patient consultation"
              value={appointmentName}
              onChange={(event) => setAppointmentName(event.currentTarget.value)}
            />
            <TextInput
              required
              label="Code"
              placeholder="NEW-CONSULT"
              value={appointmentCode}
              onChange={(event) => setAppointmentCode(event.currentTarget.value)}
            />
            <NumberInput
              required
              label="Default duration"
              suffix=" min"
              min={5}
              max={480}
              value={duration}
              onChange={(value) => setDuration(Number(value))}
            />
            <Select
              label="Primary location"
              clearable
              searchable
              data={locationOptions}
              value={appointmentLocations[0] ?? null}
              onChange={(value) => setAppointmentLocations(value ? [value] : [])}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setAppointmentOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Add
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
