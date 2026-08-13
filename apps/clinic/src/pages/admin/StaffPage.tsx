// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import type { InviteRequest, WithId } from '@medplum/core';
import { createReference, isOperationOutcome } from '@medplum/core';
import type { AccessPolicy, Location, ProjectMembership } from '@medplum/fhirtypes';
import { ResourceName, useMedplum } from '@medplum/react';
import { IconEdit, IconUserPlus, IconUsersGroup } from '@tabler/icons-react';
import type { FormEvent, JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  applyClinicBuddyMembershipAccess,
  buildClinicBuddyAccessPolicy,
  buildClinicBuddyMembershipSettings,
  CLINICBUDDY_ACCESS_POLICY_IDENTIFIER,
  formatRole,
} from '../../tenancy/access-policies';
import type { ClinicBuddyRole } from '../../tenancy/roles';
import { clinicBuddyRoles, getAssignedFacilityReferences, getClinicBuddyRole } from '../../tenancy/roles';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';

const assignableRoles = clinicBuddyRoles.filter((role) => role !== 'super-admin' && role !== 'patient');

interface InviteForm {
  firstName: string;
  lastName: string;
  email: string;
  role: ClinicBuddyRole;
  facilities: string[];
  sendEmail: boolean;
}

const emptyInvite: InviteForm = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'doctor',
  facilities: [],
  sendEmail: true,
};

export function StaffPage(): JSX.Element {
  const medplum = useMedplum();
  const project = medplum.getProject();
  const projectId = project?.id;
  const [memberships, setMemberships] = useState<WithId<ProjectMembership>[]>([]);
  const [facilities, setFacilities] = useState<WithId<Location>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteOpened, setInviteOpened] = useState(false);
  const [invite, setInvite] = useState<InviteForm>(emptyInvite);
  const [editing, setEditing] = useState<WithId<ProjectMembership>>();
  const [editRole, setEditRole] = useState<ClinicBuddyRole>('doctor');
  const [editFacilities, setEditFacilities] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    if (!projectId) {
      return;
    }
    try {
      const [loadedMemberships, loadedFacilities] = await Promise.all([
        medplum.searchResources('ProjectMembership', { project: `Project/${projectId}`, _count: '200' }),
        medplum.searchResources('Location', { status: 'active', _count: '100' }),
      ]);
      setMemberships(
        loadedMemberships.filter((membership) => membership.profile?.reference?.startsWith('Practitioner/'))
      );
      setFacilities(loadedFacilities);
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setLoading(false);
    }
  }, [medplum, projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- staff state follows the authenticated tenant
    load().catch(showErrorNotification);
  }, [load]);

  const ensurePolicy = async (role: ClinicBuddyRole): Promise<WithId<AccessPolicy>> => {
    const tag = `${CLINICBUDDY_ACCESS_POLICY_IDENTIFIER}|${role}`;
    const existing = await medplum.searchOne('AccessPolicy', { _tag: tag });
    return existing?.id ? existing : medplum.createResource(buildClinicBuddyAccessPolicy(role));
  };

  const submitInvite = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!projectId) {
      showErrorNotification('No active clinic project was found.');
      return;
    }
    setSaving(true);
    try {
      const policy = await ensurePolicy(invite.role);
      const membership = buildClinicBuddyMembershipSettings(invite.role, createReference(policy), invite.facilities);
      const response = await medplum.invite(projectId, {
        resourceType: 'Practitioner',
        firstName: invite.firstName.trim(),
        lastName: invite.lastName.trim(),
        email: invite.email.trim(),
        sendEmail: invite.sendEmail,
        scope: 'project',
        membership,
      } satisfies InviteRequest);
      if (isOperationOutcome(response)) {
        throw new Error(
          response.issue?.[0]?.details?.text ?? 'The staff account was created but the invitation failed.'
        );
      }
      setMemberships((current) => [response as WithId<ProjectMembership>, ...current]);
      setInvite(emptyInvite);
      setInviteOpened(false);
      showSuccessNotification({ title: 'Staff member invited', message: `${invite.firstName} ${invite.lastName}` });
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (membership: WithId<ProjectMembership>): void => {
    setEditing(membership);
    setEditRole(getClinicBuddyRole(membership));
    setEditFacilities(getAssignedFacilityReferences(membership));
    setEditActive(membership.active !== false);
  };

  const saveMembership = async (): Promise<void> => {
    if (!editing) {
      return;
    }
    setSaving(true);
    try {
      const policy = await ensurePolicy(editRole);
      const saved = await medplum.updateResource({
        ...applyClinicBuddyMembershipAccess(editing, editRole, createReference(policy), editFacilities),
        active: editActive,
      });
      setMemberships((current) => current.map((membership) => (membership.id === saved.id ? saved : membership)));
      setEditing(undefined);
      showSuccessNotification({ title: 'Staff access updated', message: formatRole(editRole) });
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  const facilityOptions = facilities.map((facility) => ({
    value: `Location/${facility.id}`,
    label: facility.name ?? facility.id,
  }));
  const roleOptions = assignableRoles.map((role) => ({ value: role, label: formatRole(role) }));

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <IconUsersGroup size={36} color="var(--mantine-primary-color-filled)" />
            <div>
              <Title order={2}>Staff & access</Title>
              <Text c="dimmed">Invite clinic staff and assign least-privilege roles and facility scope.</Text>
            </div>
          </Group>
          <Button leftSection={<IconUserPlus size={17} />} onClick={() => setInviteOpened(true)}>
            Invite staff
          </Button>
        </Group>
        <Paper withBorder radius="lg" p="md">
          {loading ? (
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          ) : (
            <Table.ScrollContainer minWidth={760}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Staff member</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Facilities</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {memberships.map((membership) => (
                    <Table.Tr key={membership.id}>
                      <Table.Td fw={600}>
                        <ResourceName value={membership.profile} />
                      </Table.Td>
                      <Table.Td>{formatRole(getClinicBuddyRole(membership))}</Table.Td>
                      <Table.Td>{getAssignedFacilityReferences(membership).length || 'All clinic facilities'}</Table.Td>
                      <Table.Td>
                        <Badge color={membership.active === false ? 'gray' : 'teal'}>
                          {membership.active === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Button
                          variant="subtle"
                          size="xs"
                          leftSection={<IconEdit size={15} />}
                          onClick={() => openEdit(membership)}
                        >
                          Access
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
          {!loading && memberships.length === 0 && (
            <Text c="dimmed" ta="center" py="xl">
              No practitioner memberships found.
            </Text>
          )}
        </Paper>
      </Stack>

      <Modal opened={inviteOpened} onClose={() => setInviteOpened(false)} title="Invite staff member">
        <form onSubmit={submitInvite}>
          <Stack>
            <Group grow>
              <TextInput
                required
                label="First name"
                value={invite.firstName}
                onChange={(event) => setInvite((current) => ({ ...current, firstName: event.currentTarget.value }))}
              />
              <TextInput
                required
                label="Last name"
                value={invite.lastName}
                onChange={(event) => setInvite((current) => ({ ...current, lastName: event.currentTarget.value }))}
              />
            </Group>
            <TextInput
              required
              type="email"
              label="Work email"
              value={invite.email}
              onChange={(event) => setInvite((current) => ({ ...current, email: event.currentTarget.value }))}
            />
            <Select
              required
              label="ClinicBuddy role"
              data={roleOptions}
              value={invite.role}
              onChange={(value) => value && setInvite((current) => ({ ...current, role: value as ClinicBuddyRole }))}
            />
            <MultiSelect
              label="Facility scope"
              description="Leave empty for all facilities in this clinic project."
              data={facilityOptions}
              value={invite.facilities}
              onChange={(facilities) => setInvite((current) => ({ ...current, facilities }))}
            />
            <Checkbox
              label="Send invitation email"
              checked={invite.sendEmail}
              onChange={(event) => setInvite((current) => ({ ...current, sendEmail: event.currentTarget.checked }))}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setInviteOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Invite
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={Boolean(editing)} onClose={() => setEditing(undefined)} title="Update staff access">
        <Stack>
          <Select
            required
            label="ClinicBuddy role"
            data={roleOptions}
            value={editRole}
            onChange={(value) => value && setEditRole(value as ClinicBuddyRole)}
          />
          <MultiSelect
            label="Facility scope"
            description="Leave empty for all facilities in this clinic project."
            data={facilityOptions}
            value={editFacilities}
            onChange={setEditFacilities}
          />
          <Switch
            label="Active staff account"
            description="Inactive memberships cannot sign in to this clinic project."
            checked={editActive}
            onChange={(event) => setEditActive(event.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditing(undefined)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => saveMembership()}>
              Save access
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
